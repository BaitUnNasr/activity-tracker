"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/src/db/client";
import {
  backdatePermission,
  holidayMaster,
  scheduleMaster,
  taskAnswerOption,
  taskDayMeta,
  taskEntry,
  taskMaster,
} from "@/src/db/schema";
import { LEAVE_TYPES, type LeaveType } from "./leave";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskForPicker = {
  id: number;
  name: string;
  answers: { id: number; label: string }[];
};

export type EntryRow = {
  date: string;
  taskId: number;
  answer: string;
  hours: number;
};

export type DayMetaRow = {
  date: string;
  halfDay: boolean;
  onLeave: boolean;
  leaveType: LeaveType | null;
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

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchTasksPageData(
  userId: string,
  designation: string | null,
  branch: string | null,
  userType: "F" | "T",
  today: string,
): Promise<TasksPageData> {
  const [allTasks, allAnswers, holidays, schedules, entriesRaw, dayMetasRaw, backdateRaw] =
    await Promise.all([
      db.select().from(taskMaster).where(eq(taskMaster.isActive, true)).orderBy(asc(taskMaster.id)),
      db.select().from(taskAnswerOption).orderBy(asc(taskAnswerOption.sortOrder), asc(taskAnswerOption.id)),
      db.select({
        name: holidayMaster.name,
        startDate: holidayMaster.startDate,
        endDate: holidayMaster.endDate,
      }).from(holidayMaster),
      db.select().from(scheduleMaster),
      db.select().from(taskEntry).where(eq(taskEntry.userId, userId)),
      db.select().from(taskDayMeta).where(eq(taskDayMeta.userId, userId)),
      db.select({ date: backdatePermission.date }).from(backdatePermission).where(eq(backdatePermission.userId, userId)),
    ]);

  // Filter answer options by the user's current designation and branch
  const visibleAnswers = allAnswers.filter((a) => {
    const designationOk =
      !a.designations ||
      a.designations.length === 0 ||
      (designation !== null && a.designations.includes(designation));
    const branchOk =
      !a.branches ||
      a.branches.length === 0 ||
      (branch !== null && a.branches.includes(branch));
    return designationOk && branchOk;
  });

  const tasks: TaskForPicker[] = allTasks.map((t) => ({
    id: t.id,
    name: t.name,
    answers: visibleAnswers
      .filter((a) => a.taskId === t.id)
      .map((a) => ({ id: a.id, label: a.label })),
  }));

  // Daily target from the schedule that covers today (null end = open-ended)
  const activeSchedule = schedules.find(
    (s) => s.startDate <= today && (s.endDate === null || s.endDate >= today),
  );
  const dailyTarget = activeSchedule
    ? userType === "F"
      ? activeSchedule.fulltimeHours
      : activeSchedule.traineeHours
    : 7;

  return {
    tasks,
    holidays,
    dailyTarget,
    entries: entriesRaw.map((e) => ({
      date: e.date,
      taskId: e.taskId,
      answer: e.answer,
      hours: e.hours,
    })),
    dayMetas: dayMetasRaw.map((m) => ({
      date: m.date,
      halfDay: m.halfDay,
      onLeave: m.onLeave,
      leaveType: (m.leaveType as LeaveType | null) ?? null,
    })),
    backdateDates: backdateRaw.map((b) => b.date),
  };
}

// ─── Save ─────────────────────────────────────────────────────────────────────

export type SaveDayResult =
  | { success: true }
  | { success: false; message: string };

export async function saveDay(
  userId: string,
  date: string,
  halfDay: boolean,
  onLeave: boolean,
  leaveType: LeaveType | null,
  entries: { taskId: number; answer: string; hours: number }[],
): Promise<SaveDayResult> {
  if (onLeave && !LEAVE_TYPES.includes(leaveType as LeaveType)) {
    return { success: false, message: "Please choose a leave type" };
  }
  // Leave type only applies when on leave.
  const storedLeaveType = onLeave ? leaveType : null;
  try {
    // A leave on a past day can only be cleared if the user holds a backdate
    // grant for that exact day; other pre-today leaves are locked.
    if (!onLeave && date < todayKey()) {
      const [existing] = await db
        .select({ onLeave: taskDayMeta.onLeave })
        .from(taskDayMeta)
        .where(and(eq(taskDayMeta.userId, userId), eq(taskDayMeta.date, date)));
      if (existing?.onLeave && !(await hasBackdateGrant(userId, date))) {
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
            taskId: e.taskId,
            answer: e.answer,
            hours: e.hours,
          })),
        );
      }

      // Upsert or remove day meta (halfDay / onLeave are mutually exclusive)
      if (halfDay || onLeave) {
        await tx
          .insert(taskDayMeta)
          .values({ userId, date, halfDay, onLeave, leaveType: storedLeaveType })
          .onConflictDoUpdate({
            target: [taskDayMeta.userId, taskDayMeta.date],
            set: { halfDay, onLeave, leaveType: storedLeaveType },
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

// Apply earned leave across a date range. Each working day (Mon–Sat, excluding
// holidays) in [fromDate, toDate] is stored as its own task_day_meta row, so the
// user can later revoke any individual date.
export async function applyEarnedLeave(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<ApplyLeaveResult> {
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
  if (backdated.length > 0) {
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
          .values({ userId, date, halfDay: false, onLeave: true, leaveType: "earned" })
          .onConflictDoUpdate({
            target: [taskDayMeta.userId, taskDayMeta.date],
            set: { halfDay: false, onLeave: true, leaveType: "earned" },
          });
      }
    });
    revalidatePath("/tasks");
    return { success: true, dates };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Failed to apply leave" };
  }
}

// Revoke a single leave day (removes the meta row; any preserved task entries
// for that date are left untouched and become visible again).
export async function revokeLeaveDate(userId: string, date: string): Promise<SaveDayResult> {
  if (!DATE_RE.test(date)) return { success: false, message: "Invalid date" };
  // Past-day leave can only be revoked with a backdate grant for that day.
  if (date < todayKey() && !(await hasBackdateGrant(userId, date))) {
    return { success: false, message: "Backdated leave cannot be removed" };
  }
  try {
    await db
      .delete(taskDayMeta)
      .where(and(eq(taskDayMeta.userId, userId), eq(taskDayMeta.date, date)));
    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Failed to revoke leave" };
  }
}
