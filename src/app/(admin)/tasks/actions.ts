"use server";

import { and, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getSessionUser } from "@/src/lib/session";
import { db } from "@/src/db/client";
import {
  backdatePermission,
  holidayMaster,
  taskAnswerOption,
  taskCategory,
  taskDayMeta,
  taskEntry,
  taskMaster,
} from "@/src/db/schema";
import { LEAVE_TYPES, type LeaveType } from "./leave";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubCategoryForPicker = { id: number; label: string };
export type CategoryForPicker = { id: number; name: string; subcategories: SubCategoryForPicker[] };

export type TaskForPicker = {
  id: number;
  name: string;
  categories: CategoryForPicker[];
};

export type EntryRow = {
  date: string;
  task: string;
  category: string;
  answer: string;
  hours: number;
};

export type DayMetaRow = {
  date: string;
  halfDay: boolean;
  onLeave: boolean;
  leaveType: LeaveType | null;
  extraHours: number;
};

export type HolidaySpan = {
  name: string;
  startDate: string;
  endDate: string;
};

export type TasksPageData = {
  tasks: TaskForPicker[];
  holidays: HolidaySpan[];
  dailyTarget: number;
  entries: EntryRow[];
  dayMetas: DayMetaRow[];
  // Past dates a superior has granted this user permission to backdate-log.
  backdateDates: string[];
};

// ─── Save ─────────────────────────────────────────────────────────────────────

// Whose timesheet a write lands on. Only SuperAdmin may name another user, and
// SuperAdmin skips the backdate/grace rules. The target comes from the client,
// so it is honoured only after this check — never trusted on its own.
async function resolveActor(targetUserId?: string) {
  const s = await getSessionUser(await headers());
  if (!s) return null;
  const override = s.designation === "SuperAdmin";
  // SuperAdmin has no timesheet of its own — it may only act on someone else.
  if (override) return targetUserId && targetUserId !== s.id ? { userId: targetUserId, override } : null;
  return !targetUserId || targetUserId === s.id ? { userId: s.id, override } : null;
}

export type SaveDayResult =
  | { success: true }
  | { success: false; message: string };

export async function saveDay(
  date: string,
  halfDay: boolean,
  onLeave: boolean,
  leaveType: LeaveType | null,
  extraHours: number,
  entries: { task: string; category: string; answer: string; hours: number }[],
  targetUserId?: string,
): Promise<SaveDayResult> {
  const actor = await resolveActor(targetUserId);
  if (!actor) return { success: false, message: "Not authorized" };
  const { userId, override } = actor;

  if (!DATE_RE.test(date)) return { success: false, message: "Invalid date" };
  if (onLeave && !LEAVE_TYPES.includes(leaveType as LeaveType)) {
    return { success: false, message: "Please choose a leave type" };
  }
  if (!Number.isFinite(extraHours) || extraHours < 0 || extraHours > MAX_EXTRA_HOURS) {
    return { success: false, message: "Invalid extra hours" };
  }
  const lock = await dayLockReason(userId, date, override);
  if (lock) return { success: false, message: lock };
  const badEntry = await invalidEntries(userId, date, entries);
  if (badEntry) return { success: false, message: badEntry };
  // Leave type only applies when on leave; a leave day has no extra hours.
  const storedLeaveType = onLeave ? leaveType : null;
  const extra = onLeave ? 0 : extraHours;
  try {
    // A leave on a past day can only be cleared if the user holds a backdate
    // grant for that exact day; other pre-today leaves are locked.
    if (!onLeave && date < todayKey()) {
      const [existing] = await db
        .select({ onLeave: taskDayMeta.onLeave })
        .from(taskDayMeta)
        .where(and(eq(taskDayMeta.userId, userId), eq(taskDayMeta.date, date)));
      if (existing?.onLeave && !override && !(await hasBackdateGrant(userId, date))) {
        return { success: false, message: "Backdated leave cannot be removed" };
      }
    }

    await db.transaction(async (tx) => {
      // Replace all entries for this user+date
      await tx
        .delete(taskEntry)
        .where(and(eq(taskEntry.userId, userId), eq(taskEntry.date, date)));

      if (entries.length > 0) {
        await tx.insert(taskEntry).values(
          entries.map((e) => ({
            userId,
            date,
            task: e.task,
            category: e.category || null,
            answer: e.answer,
            hours: e.hours,
          })),
        );
      }

      // Upsert or remove day meta (halfDay / onLeave are mutually exclusive)
      if (halfDay || onLeave || extra > 0) {
        await tx
          .insert(taskDayMeta)
          .values({ userId, date, halfDay, onLeave, leaveType: storedLeaveType, extraHours: extra })
          .onConflictDoUpdate({
            target: [taskDayMeta.userId, taskDayMeta.date],
            set: { halfDay, onLeave, leaveType: storedLeaveType, extraHours: extra },
          });
      } else {
        await tx
          .delete(taskDayMeta)
          .where(
            and(eq(taskDayMeta.userId, userId), eq(taskDayMeta.date, date)),
          );
      }
    });

    revalidatePath("/tasks");
    revalidatePath(`/users/${userId}/activity`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Save failed",
    };
  }
}

// ─── Earned-leave range ─────────────────────────────────────────────────────────

export type ApplyLeaveResult =
  | { success: true; dates: string[] }
  | { success: false; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LEAVE_DAYS = 90;
const MAX_EXTRA_HOURS = 8;

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return toDateKey(new Date());
}

// Yesterday — the oldest date still inside the editable grace window. Anything
// before this is "backdated".
function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

// Whether the user holds an active backdate grant for a specific date.
async function hasBackdateGrant(userId: string, date: string): Promise<boolean> {
  const [g] = await db
    .select({ id: backdatePermission.id })
    .from(backdatePermission)
    .where(and(eq(backdatePermission.userId, userId), eq(backdatePermission.date, date)))
    .limit(1);
  return !!g;
}

// Server-side copy of the timesheet's isEditable rule — the client check alone is
// bypassable by POSTing straight to saveDay or /api/tasks/save. Future days,
// Sundays and holidays are locked for everyone; days before yesterday need a
// backdate grant unless SuperAdmin is editing.
async function dayLockReason(userId: string, date: string, override: boolean): Promise<string | null> {
  if (date > todayKey()) return "Upcoming days can't be logged yet";
  if (new Date(date + "T00:00:00").getDay() === 0) return "Sundays can't be logged";
  const [holiday] = await db
    .select({ name: holidayMaster.name })
    .from(holidayMaster)
    .where(and(lte(holidayMaster.startDate, date), gte(holidayMaster.endDate, date)))
    .limit(1);
  if (holiday) return "Holidays can't be logged";
  if (!override && date < yesterdayKey() && !(await hasBackdateGrant(userId, date))) {
    return "No backdate access for this day. Ask a supervisor to grant it.";
  }
  return null;
}

const MAX_DAY_HOURS = 24;

// Entries must be real task-master subcategories with sane hours. Entries already
// saved on this day are also accepted, so old custom or since-retired rows don't
// block editing the rest of the day.
async function invalidEntries(
  userId: string,
  date: string,
  entries: { task: string; category: string; answer: string; hours: number }[],
): Promise<string | null> {
  if (!Array.isArray(entries)) return "Invalid entries";
  let total = 0;
  for (const e of entries) {
    if (typeof e?.task !== "string" || typeof e.answer !== "string" || (e.category != null && typeof e.category !== "string")) {
      return "Invalid entry";
    }
    if (!Number.isFinite(e.hours) || e.hours <= 0 || e.hours > MAX_DAY_HOURS) return "Invalid hours";
    total += e.hours;
  }
  if (total > MAX_DAY_HOURS) return "Too many hours for one day";
  if (entries.length === 0) return null;

  const [options, saved] = await Promise.all([
    db
      .select({ task: taskMaster.name, category: taskCategory.name, answer: taskAnswerOption.label })
      .from(taskAnswerOption)
      .innerJoin(taskCategory, eq(taskAnswerOption.categoryId, taskCategory.id))
      .innerJoin(taskMaster, eq(taskCategory.taskId, taskMaster.id))
      .where(eq(taskMaster.isActive, true)),
    db
      .select({ task: taskEntry.task, category: taskEntry.category, answer: taskEntry.answer })
      .from(taskEntry)
      .where(and(eq(taskEntry.userId, userId), eq(taskEntry.date, date))),
  ]);
  const key = (task: string, category: string | null, answer: string) => JSON.stringify([task, category || "", answer]);
  const allowed = new Set([...options, ...saved].map((o) => key(o.task, o.category, o.answer)));
  const unknown = entries.find((e) => !allowed.has(key(e.task, e.category, e.answer)));
  return unknown ? `"${unknown.answer}" is not a task-master subcategory` : null;
}

// Apply earned leave across a date range. Each working day (Mon–Sat, excluding
// holidays) in [fromDate, toDate] is stored as its own task_day_meta row, so the
// user can later revoke any individual date.
export async function applyEarnedLeave(
  fromDate: string,
  toDate: string,
  targetUserId?: string,
): Promise<ApplyLeaveResult> {
  const actor = await resolveActor(targetUserId);
  if (!actor) return { success: false, message: "Not authorized" };
  const { userId, override } = actor;

  if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate)) {
    return { success: false, message: "Invalid date" };
  }
  if (toDate < fromDate) {
    return { success: false, message: "End date must be on or after start date" };
  }

  const holidays = await db
    .select({ startDate: holidayMaster.startDate, endDate: holidayMaster.endDate })
    .from(holidayMaster);
  const isHoliday = (d: string) => holidays.some((h) => h.startDate <= d && d <= h.endDate);

  const dates: string[] = [];
  const cur = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");
  let guard = 0;
  while (cur <= end && guard <= 400) {
    guard++;
    const ds = toDateKey(cur);
    if (cur.getDay() !== 0 && !isHoliday(ds)) dates.push(ds); // skip Sundays + holidays
    cur.setDate(cur.getDate() + 1);
  }

  if (dates.length === 0) {
    return { success: false, message: "No working days in the selected range" };
  }
  if (dates.length > MAX_LEAVE_DAYS) {
    return { success: false, message: `Range too large — up to ${MAX_LEAVE_DAYS} working days at a time` };
  }

  // Authorize every date. Today, yesterday (grace window) and future days are
  // always allowed; any backdated day must have an explicit backdate grant —
  // a range must not silently spill onto ungranted past dates.
  const yday = yesterdayKey();
  const backdated = dates.filter((d) => d < yday);
  if (backdated.length > 0 && !override) {
    const grants = await db
      .select({ date: backdatePermission.date })
      .from(backdatePermission)
      .where(eq(backdatePermission.userId, userId));
    const granted = new Set(grants.map((g) => g.date));
    const unauthorized = backdated.filter((d) => !granted.has(d));
    if (unauthorized.length > 0) {
      const preview = unauthorized.slice(0, 3).join(", ");
      const more = unauthorized.length > 3 ? ` and ${unauthorized.length - 3} more` : "";
      return {
        success: false,
        message: `No backdate access for ${preview}${more}. Ask a supervisor to grant those dates.`,
      };
    }
  }

  try {
    await db.transaction(async (tx) => {
      for (const date of dates) {
        await tx
          .insert(taskDayMeta)
          .values({ userId, date, halfDay: false, onLeave: true, leaveType: "earned", extraHours: 0 })
          .onConflictDoUpdate({
            target: [taskDayMeta.userId, taskDayMeta.date],
            set: { halfDay: false, onLeave: true, leaveType: "earned", extraHours: 0 },
          });
      }
    });
    revalidatePath("/tasks");
    revalidatePath(`/users/${userId}/activity`);
    return { success: true, dates };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Failed to apply leave" };
  }
}

// Revoke a single leave day (removes the meta row; any preserved task entries
// for that date are left untouched and become visible again).
export async function revokeLeaveDate(date: string, targetUserId?: string): Promise<SaveDayResult> {
  const actor = await resolveActor(targetUserId);
  if (!actor) return { success: false, message: "Not authorized" };
  const { userId, override } = actor;

  if (!DATE_RE.test(date)) return { success: false, message: "Invalid date" };
  // Past-day leave can only be revoked with a backdate grant for that day.
  if (date < todayKey() && !override && !(await hasBackdateGrant(userId, date))) {
    return { success: false, message: "Backdated leave cannot be removed" };
  }
  try {
    await db
      .delete(taskDayMeta)
      .where(and(eq(taskDayMeta.userId, userId), eq(taskDayMeta.date, date)));
    revalidatePath("/tasks");
    revalidatePath(`/users/${userId}/activity`);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Failed to revoke leave" };
  }
}
