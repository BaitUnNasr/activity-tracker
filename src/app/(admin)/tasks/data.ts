// Reader for the timesheet page. Deliberately NOT a "use server" module: it
// takes the target user as arguments, so exposing it as a server action would
// let any signed-in caller read anyone else's timesheet. Its two callers both
// authorize first — /tasks passes the session user, and the supervisor activity
// view passes a target it has already checked with canViewUserActivity.

import { asc, eq } from "drizzle-orm";

import { db } from "@/src/db/client";
import {
  backdatePermission,
  holidayMaster,
  scheduleMaster,
  taskAnswerOption,
  taskCategory,
  taskDayMeta,
  taskEntry,
  taskMaster,
} from "@/src/db/schema";
import type { LeaveType } from "./leave";
import type { TaskForPicker, TasksPageData } from "./actions";

export async function fetchTasksPageData(
  userId: string,
  designation: string | null,
  branch: string | null,
  userType: "F" | "T",
  today: string,
): Promise<TasksPageData> {
  const [allTasks, allCategories, allSubs, holidays, schedules, entriesRaw, dayMetasRaw, backdateRaw] =
    await Promise.all([
      db.select().from(taskMaster).where(eq(taskMaster.isActive, true)).orderBy(asc(taskMaster.id)),
      db.select().from(taskCategory).orderBy(asc(taskCategory.sortOrder), asc(taskCategory.id)),
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

  // A row assigned to named employees belongs to exactly those users, and its
  // designation/branch lists no longer apply. Otherwise the designation and
  // branch lists must each either cover the user or be unset (all). Both
  // category and subcategory must allow for a subcategory to be visible.
  const allows = (r: {
    designations: string[] | null;
    branches: string[] | null;
    employees: string[] | null;
  }) => {
    if (r.employees?.length) return r.employees.includes(userId);
    const designationOk = !r.designations?.length || (designation !== null && r.designations.includes(designation));
    const branchOk = !r.branches?.length || (branch !== null && r.branches.includes(branch));
    return designationOk && branchOk;
  };

  const visibleCategories = allCategories.filter(allows);

  const tasks: TaskForPicker[] = allTasks
    .map((t) => ({
      id: t.id,
      name: t.name,
      categories: visibleCategories
        .filter((c) => c.taskId === t.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          subcategories: allSubs
            .filter((s) => s.categoryId === c.id && allows(s))
            .map((s) => ({ id: s.id, label: s.label })),
        }))
        .filter((c) => c.subcategories.length > 0),
    }))
    .filter((t) => t.categories.length > 0);

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
      category: e.category ?? "",
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
