"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { taskAnswerOption, taskMaster } from "@/src/db/schema";
import { getErrorMessage } from "@/src/lib/utils";

export type AnswerOption = {
  id: number;
  label: string;
  sortOrder: number;
  designations: string[] | null;
};

export type TaskRow = {
  id: number;
  name: string;
  isActive: boolean;
  answers: AnswerOption[];
};

export type ActionResult =
  | { success: true }
  | { success: false; message: string };

export async function fetchTasks(): Promise<TaskRow[]> {
  const [tasks, answers] = await Promise.all([
    db.select().from(taskMaster).orderBy(asc(taskMaster.id)),
    db.select().from(taskAnswerOption).orderBy(asc(taskAnswerOption.sortOrder), asc(taskAnswerOption.id)),
  ]);

  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    isActive: t.isActive,
    answers: answers
      .filter((a) => a.taskId === t.id)
      .map((a) => ({ id: a.id, label: a.label, sortOrder: a.sortOrder, designations: a.designations ?? null })),
  }));
}

export async function createTask(name: string): Promise<ActionResult> {
  try {
    await db.insert(taskMaster).values({ name: name.trim() });
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function updateTask(id: number, name: string): Promise<ActionResult> {
  try {
    await db.update(taskMaster).set({ name: name.trim() }).where(eq(taskMaster.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function deleteTask(id: number): Promise<ActionResult> {
  try {
    await db.delete(taskMaster).where(eq(taskMaster.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function createAnswerOption(taskId: number, label: string, designations: string[] | null = null): Promise<ActionResult> {
  try {
    await db.insert(taskAnswerOption).values({ taskId, label: label.trim(), sortOrder: 0, designations: designations?.length ? designations : null });
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function updateAnswerOption(id: number, label: string, designations: string[] | null = null): Promise<ActionResult> {
  try {
    await db
      .update(taskAnswerOption)
      .set({ label: label.trim(), designations: designations?.length ? designations : null })
      .where(eq(taskAnswerOption.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function deleteAnswerOption(id: number): Promise<ActionResult> {
  try {
    await db.delete(taskAnswerOption).where(eq(taskAnswerOption.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}
