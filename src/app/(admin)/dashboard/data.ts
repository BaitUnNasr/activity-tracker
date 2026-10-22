import { and, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db/client";
import { holidayMaster, scheduleMaster, taskDayMeta, taskEntry } from "@/src/db/schema";
import { fetchVisibleUsers, isAdminRole, VISIBLE_DESIGNATIONS } from "@/src/lib/access";
import { activeSchedule, addDays, baseHours, targetFor, toDateStr } from "@/src/lib/day-target";
import type { SessionUser } from "@/src/lib/session";
import type { LeaveType } from "../tasks/leave";

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

export type UnderTargetRow = {
  user: DashboardUserRow;
  hoursLogged: number;
  target: number;
};

export type DayStatus = "complete" | "partial" | "missing" | "leave" | "holiday" | "off";

export type DaySummary = {
  date: string;
  status: DayStatus;
  logged: number;
  target: number; // 0 on days with nothing expected (holiday / Sunday / leave)
  halfDay: boolean;
  leaveType: LeaveType | null;
  holidayName: string | null;
  tasks: { name: string; hours: number }[]; // per task, only filled for "mine"
};

export type TeamMember = {
  user: DashboardUserRow;
  today: DaySummary | null; // null = account didn't exist yet
  yesterday: DaySummary | null;
};

export type DashboardData = {
  today: string;
  yesterday: string; // previous working day
  nextHoliday: { name: string; startDate: string; daysUntil: number } | null;
  mine: { today: DaySummary; yesterday: DaySummary } | null; // null for Admin (does not log)
  team: TeamMember[] | null; // null when the viewer has no subordinates
};

// The previous working day: skips Sundays and holidays (so Monday → Saturday).
function previousWorkingDay(today: string, isHoliday: (d: string) => boolean): string {
  let d = addDays(today, -1);
  for (let i = 0; i < 31 && (new Date(`${d}T00:00:00`).getDay() === 0 || isHoliday(d)); i++) {
    d = addDays(d, -1);
  }
  return d;
}

export async function fetchDashboardData(viewer: SessionUser): Promise<DashboardData> {
  const today = toDateStr(new Date());
  const isAdmin = isAdminRole(viewer.designation);
  const hasTeam =
    isAdmin || (VISIBLE_DESIGNATIONS[viewer.designation ?? ""]?.length ?? 0) > 0;

  const [holidays, schedules, teamUsers] = await Promise.all([
    db.select().from(holidayMaster),
    db.select().from(scheduleMaster),
    hasTeam ? fetchVisibleUsers(viewer) : Promise.resolve([]),
  ]);

  const holidayOn = (d: string) => holidays.find((h) => h.startDate <= d && h.endDate >= d);
  const yesterday = previousWorkingDay(today, (d) => !!holidayOn(d));

  const team = teamUsers.filter((u) => u.isActive && u.id !== viewer.id);
  const ids = [...(isAdmin ? [] : [viewer.id]), ...team.map((u) => u.id)];

  const [entries, metas] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({
              userId: taskEntry.userId,
              date: taskEntry.date,
              task: taskEntry.task,
              hours: sql<string>`sum(${taskEntry.hours})`,
            })
            .from(taskEntry)
            .where(and(inArray(taskEntry.userId, ids), inArray(taskEntry.date, [yesterday, today])))
            .groupBy(taskEntry.userId, taskEntry.date, taskEntry.task),
          db
            .select()
            .from(taskDayMeta)
            .where(and(inArray(taskDayMeta.userId, ids), inArray(taskDayMeta.date, [yesterday, today]))),
        ]);

  const metaOf = new Map(metas.map((m) => [`${m.userId}|${m.date}`, m]));

  function summarize(userId: string, type: string, date: string, withTasks: boolean): DaySummary {
    const holiday = holidayOn(date);
    const meta = metaOf.get(`${userId}|${date}`);
    const tasks = entries
      .filter((e) => e.userId === userId && e.date === date)
      .map((e) => ({ name: e.task, hours: Number(e.hours) }));
    const logged = tasks.reduce((s, t) => s + t.hours, 0);
    const base = {
      date,
      logged,
      halfDay: meta?.halfDay ?? false,
      leaveType: (meta?.leaveType as LeaveType | null) ?? null,
      holidayName: holiday?.name ?? null,
      tasks: withTasks ? tasks : [],
    };

    if (holiday) return { ...base, status: "holiday", target: 0 };
    if (new Date(`${date}T00:00:00`).getDay() === 0) return { ...base, status: "off", target: 0 };
    if (meta?.onLeave) return { ...base, status: "leave", target: 0 };

    const target = targetFor(baseHours(activeSchedule(schedules, date), type), meta);
    // Whole minutes — summed float hours drift (7.4999 vs 7.5).
    const l = Math.round(logged * 60);
    const status = l === 0 ? "missing" : l >= Math.round(target * 60) ? "complete" : "partial";
    return { ...base, status, target };
  }

  const nextHolidayRow = holidays
    .filter((h) => h.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const nextStart = nextHolidayRow && nextHolidayRow.startDate > today ? nextHolidayRow.startDate : today;

  return {
    today,
    yesterday,
    nextHoliday: nextHolidayRow
      ? {
          name: nextHolidayRow.name,
          startDate: nextStart,
          daysUntil: Math.round(
            (new Date(`${nextStart}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000,
          ),
        }
      : null,
    mine: isAdmin
      ? null
      : {
          today: summarize(viewer.id, viewer.type, today, true),
          yesterday: summarize(viewer.id, viewer.type, yesterday, true),
        },
    team: hasTeam
      ? team
          .map((u) => {
            const joined = toDateStr(u.createdAt);
            return {
              user: u,
              today: joined > today ? null : summarize(u.id, u.type, today, false),
              yesterday: joined > yesterday ? null : summarize(u.id, u.type, yesterday, false),
            };
          })
          .sort((a, b) => a.user.name.localeCompare(b.user.name))
      : null,
  };
}
