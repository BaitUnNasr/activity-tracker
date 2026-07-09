"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/src/db/client";
import {
  user as userTable,
  userBranchLink,
  userDesignationLink,
  branchMaster,
  designationMaster,
} from "@/src/db/schema";
import { getSessionUser } from "@/src/lib/session";
import { canViewUserActivity } from "@/src/lib/access";
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
};

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function fetchUserActivity(targetUserId: string): Promise<UserActivityData> {
  const sessionUser = await getSessionUser(await headers());
  if (!sessionUser) redirect("/login");

  const [target] = await db
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

  if (!target) notFound();

  // Hierarchy + branch scope enforcement.
  if (!canViewUserActivity(sessionUser, { designation: target.designation, branch: target.branch })) {
    redirect("/dashboard");
  }

  const userType: "F" | "T" = target.type === "T" ? "T" : "F";
  const today = getToday();
  const data = await fetchTasksPageData(target.id, target.designation, userType, today);

  return {
    target: { id: target.id, name: target.name, type: userType, designation: target.designation, branch: target.branch },
    today,
    data,
  };
}
