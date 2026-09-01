"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/src/lib/access";
import { db } from "@/src/db/client";
import { holidayMaster } from "@/src/db/schema";
import { getErrorMessage } from "@/src/lib/utils";

export type HolidayRow = {
  id: number;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
};

export type ActionResult =
  | { success: true }
  | { success: false; message: string };

const DENIED: ActionResult = { success: false, message: "Not authorized" };

export async function fetchHolidays(): Promise<HolidayRow[]> {
  if (!(await getAdminUser())) redirect("/dashboard");
  return db
    .select({
      id: holidayMaster.id,
      name: holidayMaster.name,
      startDate: holidayMaster.startDate,
      endDate: holidayMaster.endDate,
    })
    .from(holidayMaster)
    .orderBy(holidayMaster.startDate);
}

export async function createHoliday(input: {
  name: string;
  startDate: string;
  endDate: string;
}): Promise<ActionResult> {
  if (!(await getAdminUser())) return DENIED;
  try {
    await db.insert(holidayMaster).values({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    revalidatePath("/holidays");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function deleteHoliday(id: number): Promise<ActionResult> {
  if (!(await getAdminUser())) return DENIED;
  try {
    await db.delete(holidayMaster).where(eq(holidayMaster.id, id));
    revalidatePath("/holidays");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}
