"use server";

import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/src/db/client";
import {
  branchMaster,
  designationMaster,
  holidayMaster,
  scheduleMaster,
  taskDayMeta,
  taskEntry,
  taskMaster,
  user,
  userBranchLink,
  userDesignationLink,
} from "@/src/db/schema";
import type { SessionUser } from "@/src/lib/session";
import { VISIBLE_DESIGNATIONS } from "@/src/lib/access";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type DashboardUserRow = {
  id: string;
  name: string;
  email: string;
  employeeCode: string;
  type: string;
  isActive: boolean;
  designation: string | null;
  branch: string | null;
};

export type DashboardScheduleRow = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  fulltimeHours: number;
  traineeHours: number;
};

export type DashboardHolidayRow = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
};

export type UnderTargetRow = {
  user: DashboardUserRow;
  hoursLogged: number;
  target: number;
};

// ─── Admin dashboard types ────────────────────────────────────────────────────

export type AdminDashboardData = {
  users: DashboardUserRow[];
  upcomingHolidays: DashboardHolidayRow[];
  currentSchedule: DashboardScheduleRow | null;
  notLoggedToday: DashboardUserRow[];
  underTargetToday: UnderTargetRow[];
  today: string;
};

// ─── Personal dashboard types ─────────────────────────────────────────────────

export type WeekDay = {
  dow: string;
  d: number;
  dateStr: string;
  hours: number;
  status: "complete" | "partial" | "today" | "holiday" | "weekend" | "future";
};

export type PersonalDashboardData = {
  today: string;
  dailyTarget: number;
  todayHalfDay: boolean;
  todayOnLeave: boolean;
  currentSchedule: DashboardScheduleRow | null;
  upcomingHolidays: DashboardHolidayRow[];
  todayTasks: { taskId: number; name: string; hours: number }[];
  todayTotal: number;
  weekData: WeekDay[];
  weekTotal: number;
  monthLogged: number;
  monthTarget: number;
  streak: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Monday of the week containing `today`
function getWeekStart(today: string): string {
  const d = new Date(today + "T00:00:00");
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(today, diff);
}

// Count Mon–Fri days between two dates inclusive
function countWorkingDays(from: string, to: string): number {
  let count = 0;
  const cur = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ─── Admin fetch ──────────────────────────────────────────────────────────────

export async function fetchAdminDashboardData(
  sessionUser: SessionUser,
): Promise<AdminDashboardData> {
  const designation = sessionUser.designation;
  const isAdmin = designation === "Admin";
  const visibleDesignations = VISIBLE_DESIGNATIONS[designation ?? ""] ?? [];
  const today = getToday();

  const whereClause = isAdmin
    ? undefined
    : and(
        inArray(designationMaster.name, visibleDesignations),
        eq(branchMaster.name, sessionUser.branch ?? ""),
      );

  const [users, holidays, schedules, todayEntries] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        employeeCode: user.employeeCode,
        type: user.type,
        isActive: user.isActive,
        designation: designationMaster.name,
        branch: branchMaster.name,
      })
      .from(user)
      .leftJoin(
        userDesignationLink,
        and(
          eq(userDesignationLink.userId, user.id),
          isNull(userDesignationLink.endDate),
        ),
      )
      .leftJoin(
        designationMaster,
        eq(userDesignationLink.designationId, designationMaster.id),
      )
      .leftJoin(
        userBranchLink,
        and(
          eq(userBranchLink.userId, user.id),
          isNull(userBranchLink.endDate),
        ),
      )
      .leftJoin(branchMaster, eq(userBranchLink.branchId, branchMaster.id))
      .where(whereClause),

    db
      .select({
        id: holidayMaster.id,
        name: holidayMaster.name,
        startDate: holidayMaster.startDate,
        endDate: holidayMaster.endDate,
      })
      .from(holidayMaster)
      .where(gte(holidayMaster.endDate, today))
      .orderBy(holidayMaster.startDate),

    db.select().from(scheduleMaster),

    db
      .select({
        userId: taskEntry.userId,
        totalHours: sql<string>`coalesce(sum(${taskEntry.hours}), 0)`,
      })
      .from(taskEntry)
      .where(eq(taskEntry.date, today))
      .groupBy(taskEntry.userId),
  ]);

  const activeSchedule =
    schedules.find((s) => s.startDate <= today && s.endDate >= today) ?? null;
  const currentSchedule: DashboardScheduleRow | null = activeSchedule
    ? {
        id: activeSchedule.id,
        name: activeSchedule.name,
        startDate: activeSchedule.startDate,
        endDate: activeSchedule.endDate,
        fulltimeHours: activeSchedule.fulltimeHours ?? 8,
        traineeHours: activeSchedule.traineeHours ?? 5,
      }
    : null;

  const hoursMap = new Map<string, number>(
    todayEntries.map((e) => [e.userId, Number(e.totalHours)]),
  );

  const activeUsers = users.filter((u) => u.isActive);
  const notLoggedToday = activeUsers.filter((u) => !hoursMap.has(u.id));
  const underTargetToday: UnderTargetRow[] = activeUsers
    .filter((u) => hoursMap.has(u.id))
    .map((u) => {
      const hoursLogged = hoursMap.get(u.id)!;
      const target = currentSchedule
        ? u.type === "F"
          ? currentSchedule.fulltimeHours
          : currentSchedule.traineeHours
        : 7;
      return { user: u, hoursLogged, target };
    })
    .filter(({ hoursLogged, target }) => hoursLogged < target);

  return {
    users,
    upcomingHolidays: holidays,
    currentSchedule,
    notLoggedToday,
    underTargetToday,
    today,
  };
}

// ─── Personal fetch ───────────────────────────────────────────────────────────

export async function fetchPersonalDashboardData(
  sessionUser: SessionUser,
): Promise<PersonalDashboardData> {
  const today = getToday();
  const weekStart = getWeekStart(today);
  const weekEnd = addDays(weekStart, 6);
  const monthStart = today.slice(0, 7) + "-01";
  const thirtyDaysAgo = addDays(today, -30);

  const [schedules, allHolidays, todayEntriesRaw, weekEntriesRaw, monthTotalRaw, recentDatesRaw, taskMasters, todayMetaRaw] =
    await Promise.all([
      db.select().from(scheduleMaster),

      db
        .select({
          id: holidayMaster.id,
          name: holidayMaster.name,
          startDate: holidayMaster.startDate,
          endDate: holidayMaster.endDate,
        })
        .from(holidayMaster)
        .orderBy(holidayMaster.startDate),

      db
        .select({ taskId: taskEntry.taskId, hours: taskEntry.hours })
        .from(taskEntry)
        .where(
          and(eq(taskEntry.userId, sessionUser.id), eq(taskEntry.date, today)),
        ),

      db
        .select({
          date: taskEntry.date,
          totalHours: sql<string>`sum(${taskEntry.hours})`,
        })
        .from(taskEntry)
        .where(
          and(
            eq(taskEntry.userId, sessionUser.id),
            gte(taskEntry.date, weekStart),
            lte(taskEntry.date, weekEnd),
          ),
        )
        .groupBy(taskEntry.date),

      db
        .select({ totalHours: sql<string>`coalesce(sum(${taskEntry.hours}), 0)` })
        .from(taskEntry)
        .where(
          and(
            eq(taskEntry.userId, sessionUser.id),
            gte(taskEntry.date, monthStart),
            lte(taskEntry.date, today),
          ),
        ),

      db
        .select({ date: taskEntry.date })
        .from(taskEntry)
        .where(
          and(
            eq(taskEntry.userId, sessionUser.id),
            gte(taskEntry.date, thirtyDaysAgo),
          ),
        )
        .groupBy(taskEntry.date)
        .orderBy(desc(taskEntry.date)),

      db.select({ id: taskMaster.id, name: taskMaster.name }).from(taskMaster),

      db
        .select({ halfDay: taskDayMeta.halfDay, onLeave: taskDayMeta.onLeave })
        .from(taskDayMeta)
        .where(and(eq(taskDayMeta.userId, sessionUser.id), eq(taskDayMeta.date, today)))
        .limit(1),
    ]);

  const todayHalfDay = todayMetaRaw[0]?.halfDay ?? false;
  const todayOnLeave = todayMetaRaw[0]?.onLeave ?? false;

  // Active schedule
  const activeSchedule =
    schedules.find((s) => s.startDate <= today && s.endDate >= today) ?? null;
  const currentSchedule: DashboardScheduleRow | null = activeSchedule
    ? {
        id: activeSchedule.id,
        name: activeSchedule.name,
        startDate: activeSchedule.startDate,
        endDate: activeSchedule.endDate,
        fulltimeHours: activeSchedule.fulltimeHours ?? 8,
        traineeHours: activeSchedule.traineeHours ?? 5,
      }
    : null;
  const dailyTarget = currentSchedule
    ? sessionUser.type === "F"
      ? currentSchedule.fulltimeHours
      : currentSchedule.traineeHours
    : 7;

  // Upcoming holidays (endDate >= today)
  const upcomingHolidays = allHolidays.filter((h) => h.endDate >= today);

  // Today's tasks
  const taskMap = new Map(taskMasters.map((t) => [t.id, t.name]));
  const todayTasks = todayEntriesRaw.map((e) => ({
    taskId: e.taskId,
    name: taskMap.get(e.taskId) ?? "Unknown",
    hours: e.hours,
  }));
  const todayTotal = todayTasks.reduce((s, t) => s + t.hours, 0);

  // Week data (Mon–Sun)
  const weekDayHours = new Map(
    weekEntriesRaw.map((e) => [e.date, Number(e.totalHours)]),
  );
  const ALL_DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekData: WeekDay[] = ALL_DOWS.map((dow, i) => {
    const dateStr = addDays(weekStart, i);
    const dt = new Date(dateStr + "T00:00:00");
    const d = dt.getDate();
    const isWeekend = i >= 5;
    const isToday = dateStr === today;
    const isFuture = dateStr > today;
    const isHoliday = allHolidays.some(
      (h) => h.startDate <= dateStr && h.endDate >= dateStr,
    );
    const hours = weekDayHours.get(dateStr) ?? 0;

    let status: WeekDay["status"];
    if (isWeekend) status = "weekend";
    else if (isHoliday) status = "holiday";
    else if (isToday) status = "today";
    else if (isFuture) status = "future";
    else if (hours >= dailyTarget) status = "complete";
    else if (hours > 0) status = "partial";
    else status = "future"; // past day with no log

    return { dow, d, dateStr, hours, status };
  });
  const weekTotal = weekData.reduce((s, d) => s + d.hours, 0);

  // Month stats
  const monthLogged = Math.round(Number(monthTotalRaw[0]?.totalHours ?? 0) * 10) / 10;
  const workingDays = countWorkingDays(monthStart, today);
  const monthTarget = Math.round(workingDays * dailyTarget * 10) / 10;

  // Streak (consecutive working days with any log going back from today/yesterday)
  const loggedDates = new Set(recentDatesRaw.map((r) => r.date));
  let streak = 0;
  // Start from today if logged, else from yesterday
  const streakCur = new Date(today + "T00:00:00");
  if (!loggedDates.has(today)) streakCur.setDate(streakCur.getDate() - 1);
  for (let i = 0; i < 30; i++) {
    const dateStr = `${streakCur.getFullYear()}-${String(streakCur.getMonth() + 1).padStart(2, "0")}-${String(streakCur.getDate()).padStart(2, "0")}`;
    const dow = streakCur.getDay();
    if (dow === 0 || dow === 6) {
      streakCur.setDate(streakCur.getDate() - 1);
      continue;
    }
    const isHoliday = allHolidays.some(
      (h) => h.startDate <= dateStr && h.endDate >= dateStr,
    );
    if (isHoliday) {
      streakCur.setDate(streakCur.getDate() - 1);
      continue;
    }
    if (loggedDates.has(dateStr)) {
      streak++;
      streakCur.setDate(streakCur.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    today,
    dailyTarget,
    todayHalfDay,
    todayOnLeave,
    currentSchedule,
    upcomingHolidays,
    todayTasks,
    todayTotal,
    weekData,
    weekTotal,
    monthLogged,
    monthTarget,
    streak,
  };
}
