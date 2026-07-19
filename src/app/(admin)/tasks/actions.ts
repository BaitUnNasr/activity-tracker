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

  // Daily target from the schedule that covers today
  const activeSchedule = schedules.find(
    (s) => s.startDate <= today && s.endDate >= today,
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
  entries: { taskId: number; answer: string; hours: number }[],
): Promise<SaveDayResult> {
  try {
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
          .values({ userId, date, halfDay, onLeave })
          .onConflictDoUpdate({
            target: [taskDayMeta.userId, taskDayMeta.date],
            set: { halfDay, onLeave },
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
