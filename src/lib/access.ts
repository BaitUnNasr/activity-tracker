import { headers } from "next/headers";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/src/db/client";
import {
  branchMaster,
  designationMaster,
  user,
  userBranchLink,
  userDesignationLink,
} from "@/src/db/schema";
import { getSessionUser, type SessionUser } from "./session";

// Editing master data — task master, holidays, schedule — is Admin-only.
// Returns null for everyone else, so callers can deny instead of proceeding.
// Every server action behind those pages must call this: route middleware only
// proves who the caller is, and a server action is reachable directly by POST
// regardless of which page rendered it.
export async function getAdminUser(): Promise<SessionUser | null> {
  const user = await getSessionUser(await headers());
  return user?.designation === "Admin" ? user : null;
}

// Designation hierarchy: which designations each role may view/manage.
// Empty array = Admin (sees everyone, across all branches).
export const VISIBLE_DESIGNATIONS: Record<string, string[]> = {
  Admin: [],
  Chairman: ["Management", "Supervisor", "General"],
  Management: ["Supervisor", "General"],
  Supervisor: ["General"],
};

type Scoped = { designation: string | null; branch: string | null };

/**
 * Can `viewer` view the activity of `target`?
 * Rule: Admin → anyone. Others → target's designation is strictly below the
 * viewer's (per VISIBLE_DESIGNATIONS) AND they share the same branch.
 */
export function canViewUserActivity(viewer: Scoped, target: Scoped): boolean {
  const role = viewer.designation;
  if (!role || role === "General") return false;
  if (role === "Admin") return true;

  const visible = VISIBLE_DESIGNATIONS[role] ?? [];
  if (!target.designation || !visible.includes(target.designation)) return false;

  // Non-admin roles are restricted to their own branch.
  return !!viewer.branch && viewer.branch === target.branch;
}

// Users the viewer manages, with their current designation + branch.
// Admin → everyone; others → VISIBLE_DESIGNATIONS in their own branch.
export function fetchVisibleUsers(viewer: Pick<SessionUser, "designation" | "branch">) {
  const visible = VISIBLE_DESIGNATIONS[viewer.designation ?? ""] ?? [];
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employeeCode,
      type: user.type,
      isActive: user.isActive,
      createdAt: user.createdAt,
      designation: designationMaster.name,
      branch: branchMaster.name,
    })
    .from(user)
    .leftJoin(
      userDesignationLink,
      and(eq(userDesignationLink.userId, user.id), isNull(userDesignationLink.endDate)),
    )
    .leftJoin(designationMaster, eq(userDesignationLink.designationId, designationMaster.id))
    .leftJoin(
      userBranchLink,
      and(eq(userBranchLink.userId, user.id), isNull(userBranchLink.endDate)),
    )
    .leftJoin(branchMaster, eq(userBranchLink.branchId, branchMaster.id))
    .where(
      viewer.designation === "Admin"
        ? undefined
        : and(
            inArray(designationMaster.name, visible),
            eq(branchMaster.name, viewer.branch ?? ""),
          ),
    );
}
