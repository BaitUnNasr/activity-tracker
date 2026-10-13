"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/src/db/client";
import { salaryMaster } from "@/src/db/schema";
import { getAdminUser } from "@/src/lib/access";
import { getErrorMessage } from "@/src/lib/utils";

export type ActionResult = { success: true } | { success: false; message: string };

// Sets the gross salary from `month` (YYYY-MM) onward; null clears this
// month's own row so the previous salary carries forward again.
export async function setSalary(userId: string, month: string, gross: number | null): Promise<ActionResult> {
  if (!(await getAdminUser())) return { success: false, message: "Not authorized" };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { success: false, message: "Invalid month" };
  if (gross !== null && !(Number.isFinite(gross) && gross >= 0 && gross < 1e10)) {
    return { success: false, message: "Enter a valid salary" };
  }

  const start = `${month}-01`;
  try {
    if (gross === null) {
      await db.delete(salaryMaster).where(and(eq(salaryMaster.userId, userId), eq(salaryMaster.month, start)));
    } else {
      await db
        .insert(salaryMaster)
        .values({ userId, month: start, gross })
        .onConflictDoUpdate({ target: [salaryMaster.userId, salaryMaster.month], set: { gross } });
    }
    revalidatePath("/reports");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}
