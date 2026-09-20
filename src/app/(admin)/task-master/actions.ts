"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getAdminUser } from "@/src/lib/access";
import { db } from "@/src/db/client";
import {
  branchMaster,
  designationMaster,
  taskAnswerOption,
  taskCategory,
  taskMaster,
  user,
  userBranchLink,
  userDesignationLink,
} from "@/src/db/schema";
import { getErrorMessage } from "@/src/lib/utils";

export type SubCategory = {
  id: number;
  label: string;
  sortOrder: number;
  designations: string[] | null;
  branches: string[] | null;
  employees: string[] | null;
};

export type Category = {
  id: number;
  name: string;
  sortOrder: number;
  designations: string[] | null;
  branches: string[] | null;
  employees: string[] | null;
  subcategories: SubCategory[];
};

// A user that can be named in a category/subcategory `employees` list. Names
// repeat across the staff list, so the code and branch disambiguate them.
export type Employee = {
  id: string;
  name: string;
  employeeCode: string;
  branch: string | null;
  designation: string | null;
  isActive: boolean;
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

const DENIED: ActionResult = { success: false, message: "Not authorized" };

export async function fetchTasks(): Promise<TaskRow[]> {
  if (!(await getAdminUser())) redirect("/dashboard");
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
        employees: c.employees ?? null,
        subcategories: subs
          .filter((s) => s.categoryId === c.id)
          .map((s) => ({
            id: s.id,
            label: s.label,
            sortOrder: s.sortOrder,
            designations: s.designations ?? null,
            branches: s.branches ?? null,
            employees: s.employees ?? null,
          })),
      })),
  }));
}

export async function fetchBranchNames(): Promise<string[]> {
  if (!(await getAdminUser())) redirect("/dashboard");
  const branches = await db
    .select({ name: branchMaster.name })
    .from(branchMaster)
    .where(eq(branchMaster.isActive, true))
    .orderBy(asc(branchMaster.name));
  return branches.map((b) => b.name);
}

// Every user, not just the active ones: the picker offers only active staff,
// but an already-assigned user who has since been deactivated still has to
// render by name rather than as a bare id.
export async function fetchEmployees(): Promise<Employee[]> {
  if (!(await getAdminUser())) redirect("/dashboard");
  return db
    .select({
      id: user.id,
      name: user.name,
      employeeCode: user.employeeCode,
      branch: branchMaster.name,
      designation: designationMaster.name,
      isActive: user.isActive,
    })
    .from(user)
    .leftJoin(
      userBranchLink,
      and(eq(userBranchLink.userId, user.id), isNull(userBranchLink.endDate)),
    )
    .leftJoin(branchMaster, eq(userBranchLink.branchId, branchMaster.id))
    .leftJoin(
      userDesignationLink,
      and(eq(userDesignationLink.userId, user.id), isNull(userDesignationLink.endDate)),
    )
    .leftJoin(designationMaster, eq(userDesignationLink.designationId, designationMaster.id))
    .orderBy(asc(user.name));
}

// ─── Task ───────────────────────────────────────────────────────────────────

export async function createTask(name: string): Promise<ActionResult> {
  if (!(await getAdminUser())) return DENIED;
  try {
    await db.insert(taskMaster).values({ name: name.trim() });
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function updateTask(id: number, name: string): Promise<ActionResult> {
  if (!(await getAdminUser())) return DENIED;
  try {
    await db.update(taskMaster).set({ name: name.trim() }).where(eq(taskMaster.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function deleteTask(id: number): Promise<ActionResult> {
  if (!(await getAdminUser())) return DENIED;
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
  employees: string[] | null = null,
): Promise<ActionResult> {
  if (!(await getAdminUser())) return DENIED;
  try {
    await db.insert(taskCategory).values({ taskId, name: name.trim(), sortOrder: 0, designations: norm(designations), branches: norm(branches), employees: norm(employees) });
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
  employees: string[] | null = null,
): Promise<ActionResult> {
  if (!(await getAdminUser())) return DENIED;
  try {
    await db.update(taskCategory).set({ name: name.trim(), designations: norm(designations), branches: norm(branches), employees: norm(employees) }).where(eq(taskCategory.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  if (!(await getAdminUser())) return DENIED;
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
  employees: string[] | null = null,
): Promise<ActionResult> {
  if (!(await getAdminUser())) return DENIED;
  try {
    await db.insert(taskAnswerOption).values({ categoryId, label: label.trim(), sortOrder: 0, designations: norm(designations), branches: norm(branches), employees: norm(employees) });
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
  employees: string[] | null = null,
): Promise<ActionResult> {
  if (!(await getAdminUser())) return DENIED;
  try {
    await db.update(taskAnswerOption).set({ label: label.trim(), designations: norm(designations), branches: norm(branches), employees: norm(employees) }).where(eq(taskAnswerOption.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function deleteSubcategory(id: number): Promise<ActionResult> {
  if (!(await getAdminUser())) return DENIED;
  try {
    await db.delete(taskAnswerOption).where(eq(taskAnswerOption.id, id));
    revalidatePath("/task-master");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}
