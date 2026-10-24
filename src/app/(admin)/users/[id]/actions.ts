"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db/client";
import { session, user, userBranchLink, userDesignationLink } from "@/src/db/schema";
import { getErrorMessage } from "@/src/lib/utils";
import { canGrantDesignation, canManageUser, getAdminUser } from "@/src/lib/access";

export type ActionResult = { success: true } | { success: false; message: string };

const NOT_AUTHORIZED: ActionResult = { success: false, message: "Not authorized" };

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function toggleUserStatus(userId: string, isActive: boolean): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin || !(await canManageUser(admin, userId))) return NOT_AUTHORIZED;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(user.id, userId));
      // Sign them out everywhere; the session-create hook in auth.ts stops new logins.
      if (!isActive) await tx.delete(session).where(eq(session.userId, userId));
    });
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function transferBranch(userId: string, branchId: number, startDate: string): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin || !(await canManageUser(admin, userId))) return NOT_AUTHORIZED;
  try {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ startDate: userBranchLink.startDate })
        .from(userBranchLink)
        .where(and(eq(userBranchLink.userId, userId), isNull(userBranchLink.endDate)));

      if (current && startDate <= current.startDate) {
        throw new Error("Transfer date must be after the current branch assignment start date");
      }

      if (current) {
        await tx
          .update(userBranchLink)
          .set({ endDate: addDays(startDate, -1) })
          .where(and(eq(userBranchLink.userId, userId), isNull(userBranchLink.endDate)));
      }

      await tx.insert(userBranchLink).values({ userId, branchId, startDate });
    });
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function updateDesignation(userId: string, designationId: number, startDate: string): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (
    !admin ||
    !(await canManageUser(admin, userId)) ||
    !(await canGrantDesignation(admin, designationId))
  ) {
    return NOT_AUTHORIZED;
  }
  try {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ startDate: userDesignationLink.startDate })
        .from(userDesignationLink)
        .where(and(eq(userDesignationLink.userId, userId), isNull(userDesignationLink.endDate)));

      if (current && startDate <= current.startDate) {
        throw new Error("Effective date must be after the current designation assignment start date");
      }

      if (current) {
        await tx
          .update(userDesignationLink)
          .set({ endDate: addDays(startDate, -1) })
          .where(and(eq(userDesignationLink.userId, userId), isNull(userDesignationLink.endDate)));
      }

      await tx.insert(userDesignationLink).values({ userId, designationId, startDate });
    });
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}
