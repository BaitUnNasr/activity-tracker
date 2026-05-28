"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { holidayMaster } from "@/src/db/schema";

export type HolidayRow = {
  id: number;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
};

export type ActionResult =
  | { success: true }
  | { success: false; message: string };

export async function fetchHolidays(): Promise<HolidayRow[]> {
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
  try {
    await db.insert(holidayMaster).values({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    revalidatePath("/holidays");
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Something went wrong" };
  }
}

export async function deleteHoliday(id: number): Promise<ActionResult> {
  try {
    await db.delete(holidayMaster).where(eq(holidayMaster.id, id));
    revalidatePath("/holidays");
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Something went wrong" };
  }
}
