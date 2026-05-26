import { and, eq, isNull } from "drizzle-orm";
import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

import { db } from "@/src/db/client";
import {
  branchMaster,
  designationMaster,
  userBranchLink,
  userDesignationLink,
} from "@/src/db/schema";
import { auth } from "./auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  employeeCode: string;
  type: "F" | "T";
  designation: string | null;
  branch: string | null;
};

export async function getSessionUser(
  reqHeaders: ReadonlyHeaders,
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) return null;

  const { id, name, email } = session.user;
  const raw = session.user as { employeeCode?: string; type?: string };
  const employeeCode = raw.employeeCode ?? "";
  const type = (raw.type === "F" || raw.type === "T") ? raw.type : "F";

  const [designationRow, branchRow] = await Promise.all([
    db
      .select({ name: designationMaster.name })
      .from(userDesignationLink)
      .innerJoin(
        designationMaster,
        eq(userDesignationLink.designationId, designationMaster.id),
      )
      .where(
        and(
          eq(userDesignationLink.userId, id),
          isNull(userDesignationLink.endDate),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select({ name: branchMaster.name })
      .from(userBranchLink)
      .innerJoin(branchMaster, eq(userBranchLink.branchId, branchMaster.id))
      .where(
        and(
          eq(userBranchLink.userId, id),
          isNull(userBranchLink.endDate),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  return {
    id,
    name,
    email,
    employeeCode,
    type,
    designation: designationRow?.name ?? null,
    branch: branchRow?.name ?? null,
  };
}
