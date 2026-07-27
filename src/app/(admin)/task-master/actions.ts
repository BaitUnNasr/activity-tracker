"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { branchMaster, taskAnswerOption, taskCategory, taskMaster } from "@/src/db/schema";
import { getErrorMessage } from "@/src/lib/utils";

export type SubCategory = {
  id: number;
  label: string;
  sortOrder: number;
  designations: string[] | null;
  branches: string[] | null;
};

export type Category = {
  id: number;
  name: string;
  sortOrder: number;
  designations: string[] | null;
  branches: string[] | null;
  subcategories: SubCategory[];
};

export type TaskRow = {
  id: number;
  name: string;
  isActive: boolean;
  categories: Category[];
};

export type ActionResult =
  | { success: true }
  | { success: false; message: string };

const norm = (v: string[] | null | undefined) => (v?.length ? v : null);

export async function fetchTasks(): Promise<TaskRow[]> {
  const [tasks, categories, subs] = await Promise.all([
    db.select().from(taskMaster).orderBy(asc(taskMaster.id)),
    db.select().from(taskCategory).orderBy(asc(taskCategory.sortOrder), asc(taskCategory.id)),
    db.select().from(taskAnswerOption).orderBy(asc(taskAnswerOption.sortOrder), asc(taskAnswerOption.id)),
  ]);

  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    isActive: t.isActive,
    categories: categories
      .filter((c) => c.taskId === t.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        designations: c.designations ?? null,
        branches: c.branches ?? null,
        subcategories: subs
          .filter((s) => s.categoryId === c.id)
          .map((s) => ({
            id: s.id,
            label: s.label,
            sortOrder: s.sortOrder,
            designations: s.designations ?? null,
            branches: s.branches ?? null,
          })),
      })),
  }));
}

export async function fetchBranchNames(): Promise<string[]> {
  const branches = await db
    .select({ name: branchMaster.name })
    .from(branchMaster)
    .where(eq(branchMaster.isActive, true))
    .orderBy(asc(branchMaster.name));
  return branches.map((b) => b.name);
}

// ─── Task ───────────────────────────────────────────────────────────────────

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
    // FK ON DELETE CASCADE removes categories → subcategories.
    await db.delete(taskMaster).where(eq(taskMaster.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

// ─── Category ─────────────────────────────────────────────────────────────────

export async function createCategory(
  taskId: number,
  name: string,
  designations: string[] | null = null,
  branches: string[] | null = null,
): Promise<ActionResult> {
  try {
    await db.insert(taskCategory).values({ taskId, name: name.trim(), sortOrder: 0, designations: norm(designations), branches: norm(branches) });
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function updateCategory(
  id: number,
  name: string,
  designations: string[] | null = null,
  branches: string[] | null = null,
): Promise<ActionResult> {
  try {
    await db.update(taskCategory).set({ name: name.trim(), designations: norm(designations), branches: norm(branches) }).where(eq(taskCategory.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  try {
    // FK ON DELETE CASCADE removes its subcategories.
    await db.delete(taskCategory).where(eq(taskCategory.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

// ─── Subcategory ──────────────────────────────────────────────────────────────

export async function createSubcategory(
  categoryId: number,
  label: string,
  designations: string[] | null = null,
  branches: string[] | null = null,
): Promise<ActionResult> {
  try {
    await db.insert(taskAnswerOption).values({ categoryId, label: label.trim(), sortOrder: 0, designations: norm(designations), branches: norm(branches) });
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function updateSubcategory(
  id: number,
  label: string,
  designations: string[] | null = null,
  branches: string[] | null = null,
): Promise<ActionResult> {
  try {
    await db.update(taskAnswerOption).set({ label: label.trim(), designations: norm(designations), branches: norm(branches) }).where(eq(taskAnswerOption.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function deleteSubcategory(id: number): Promise<ActionResult> {
  try {
    await db.delete(taskAnswerOption).where(eq(taskAnswerOption.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}
