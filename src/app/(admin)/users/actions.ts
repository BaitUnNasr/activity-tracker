"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import { auth } from "@/src/lib/auth";
import { db } from "@/src/db/client";
import { getErrorMessage } from "@/src/lib/utils";
import {
  user,
  account,
  userDesignationLink,
  userBranchLink,
  designationMaster,
  branchMaster,
} from "@/src/db/schema";
import { getSessionUser } from "@/src/lib/session";
import { VISIBLE_DESIGNATIONS } from "@/src/lib/access";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  employeeCode: string;
  type: string;
  isActive: boolean;
  designation: string | null;
  branch: string | null;
};

export type UsersPageData = {
  users: UserRow[];
  designations: { id: number; name: string }[];
  branches: { id: number; name: string }[];
  isAdmin: boolean;
};

export async function fetchUsersPageData(): Promise<UsersPageData> {
  const sessionUser = await getSessionUser(await headers());

  if (!sessionUser || !sessionUser.designation || sessionUser.designation === "General") {
    redirect("/dashboard");
  }

  const designation = sessionUser.designation;
  const isAdmin = designation === "Admin";
  const visibleDesignations = VISIBLE_DESIGNATIONS[designation] ?? [];

  if (!isAdmin && visibleDesignations.length === 0) {
    redirect("/dashboard");
  }

  const whereClause = isAdmin
    ? undefined
    : and(
        inArray(designationMaster.name, visibleDesignations),
        eq(branchMaster.name, sessionUser.branch ?? ""),
      );

  const [users, designations, branches] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        employeeCode: user.employeeCode,
        type: user.type,
        isActive: user.isActive,
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
      .where(whereClause),

    db
      .select({ id: designationMaster.id, name: designationMaster.name })
      .from(designationMaster)
      .where(eq(designationMaster.isActive, true)),

    db
      .select({ id: branchMaster.id, name: branchMaster.name })
      .from(branchMaster)
      .where(eq(branchMaster.isActive, true)),
  ]);

  return { users, designations, branches, isAdmin };
}

export type CreateUserInput = {
  name: string;
  password: string;
  employeeCode: string;
  type: "F" | "T";
  designationId: number;
  branchId: number;
};

export type ActionResult =
  | { success: true }
  | { success: false; message: string; field?: string };

// Emails are not collected from users — this app authenticates by employee code.
// A stable internal address is derived from the person's name + employee code.
const USER_EMAIL_DOMAIN = "pulse.local";

function slugifyForEmail(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40);
}

function generateUserEmail(name: string, employeeCode: string): string {
  const namePart = slugifyForEmail(name) || "user";
  const codePart = slugifyForEmail(employeeCode) || "0";
  return `${namePart}.${codePart}@${USER_EMAIL_DOMAIN}`;
}

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, message: "Unauthorized" };

  const { name, password, employeeCode, type, designationId, branchId } = input;

  // Derived, not user-supplied.
  const email = generateUserEmail(name, employeeCode);

  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing.length > 0) {
    return {
      success: false,
      message: "A user with the same name and employee code already exists",
      field: "employeeCode",
    };
  }

  const userId = randomUUID();
  const today = new Date().toISOString().split("T")[0];

  try {
    const hashedPassword = await hashPassword(password);

    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        name,
        email: email.toLowerCase(),
        employeeCode,
        type,
        emailVerified: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(userDesignationLink).values({
        userId,
        designationId,
        startDate: today,
      });

      await tx.insert(userBranchLink).values({
        userId,
        branchId,
        startDate: today,
      });
    });

    revalidatePath("/users");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, message: getErrorMessage(err) };
  }
}
