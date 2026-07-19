"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/src/db/client";
import {
  user as userTable,
  userBranchLink,
  userDesignationLink,
  branchMaster,
  designationMaster,
  backdatePermission,
} from "@/src/db/schema";
import { getSessionUser } from "@/src/lib/session";
import { canViewUserActivity } from "@/src/lib/access";
import { getErrorMessage } from "@/src/lib/utils";
import { fetchTasksPageData, type TasksPageData } from "../../../tasks/actions";

export type ActivityTarget = {
  id: string;
  name: string;
  type: "F" | "T";
  designation: string | null;
  branch: string | null;
};

export type UserActivityData = {
  target: ActivityTarget;
  today: string;
  data: TasksPageData;
  grantedDates: string[];
};

export type ActionResult = { success: true } | { success: false; message: string };

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fetch the target's current designation + branch (for scope checks).
async function getTargetScope(targetUserId: string) {
  const [row] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      type: userTable.type,
      designation: designationMaster.name,
      branch: branchMaster.name,
    })
    .from(userTable)
    .leftJoin(
      userDesignationLink,
      and(eq(userDesignationLink.userId, userTable.id), isNull(userDesignationLink.endDate)),
    )
    .leftJoin(designationMaster, eq(userDesignationLink.designationId, designationMaster.id))
    .leftJoin(
      userBranchLink,
      and(eq(userBranchLink.userId, userTable.id), isNull(userBranchLink.endDate)),
    )
    .leftJoin(branchMaster, eq(userBranchLink.branchId, branchMaster.id))
    .where(eq(userTable.id, targetUserId))
    .limit(1);
  return row ?? null;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function fetchUserActivity(targetUserId: string): Promise<UserActivityData> {
  const sessionUser = await getSessionUser(await headers());
  if (!sessionUser) redirect("/login");

  const target = await getTargetScope(targetUserId);
  if (!target) notFound();

  // Hierarchy + branch scope enforcement.
  if (!canViewUserActivity(sessionUser, { designation: target.designation, branch: target.branch })) {
    redirect("/dashboard");
  }

  const userType: "F" | "T" = target.type === "T" ? "T" : "F";
  const today = getToday();

  const [data, grantedRows] = await Promise.all([
    fetchTasksPageData(target.id, target.designation, target.branch, userType, today),
    db
      .select({ date: backdatePermission.date })
      .from(backdatePermission)
      .where(eq(backdatePermission.userId, target.id))
      .orderBy(asc(backdatePermission.date)),
  ]);

  return {
    target: { id: target.id, name: target.name, type: userType, designation: target.designation, branch: target.branch },
    today,
    data,
    grantedDates: grantedRows.map((r) => r.date),
  };
}

// ─── Grant / revoke ─────────────────────────────────────────────────────────────

export async function grantBackdate(targetUserId: string, date: string): Promise<ActionResult> {
  const sessionUser = await getSessionUser(await headers());
  if (!sessionUser) return { success: false, message: "Unauthorized" };

  if (!DATE_RE.test(date)) return { success: false, message: "Invalid date" };
  // Users can edit yesterday and today themselves (grace window), so backdate
  // access is only needed for dates older than yesterday.
  const now = new Date();
  const yd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayStr = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, "0")}-${String(yd.getDate()).padStart(2, "0")}`;
  if (date >= yesterdayStr) {
    return { success: false, message: "The user can still edit this day — backdate access is only needed for older dates" };
  }
  const [y, m, d] = date.split("-").map(Number);
  if (new Date(y, m - 1, d).getDay() === 0) {
    return { success: false, message: "Sundays are non-working days" };
  }

  const target = await getTargetScope(targetUserId);
  if (!target) return { success: false, message: "User not found" };
  if (!canViewUserActivity(sessionUser, { designation: target.designation, branch: target.branch })) {
    return { success: false, message: "You are not allowed to grant this user" };
  }

  try {
    await db
      .insert(backdatePermission)
      .values({ userId: target.id, date, grantedBy: sessionUser.id })
      .onConflictDoNothing({ target: [backdatePermission.userId, backdatePermission.date] });
    revalidatePath(`/users/${targetUserId}/activity`);
    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function revokeBackdate(targetUserId: string, date: string): Promise<ActionResult> {
  const sessionUser = await getSessionUser(await headers());
  if (!sessionUser) return { success: false, message: "Unauthorized" };

  const target = await getTargetScope(targetUserId);
  if (!target) return { success: false, message: "User not found" };
  if (!canViewUserActivity(sessionUser, { designation: target.designation, branch: target.branch })) {
    return { success: false, message: "You are not allowed to manage this user" };
  }

  try {
    await db
      .delete(backdatePermission)
      .where(and(eq(backdatePermission.userId, target.id), eq(backdatePermission.date, date)));
    revalidatePath(`/users/${targetUserId}/activity`);
    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}
