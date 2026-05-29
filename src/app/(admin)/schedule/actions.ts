"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { scheduleMaster } from "@/src/db/schema";
import { getErrorMessage } from "@/src/lib/utils";

export type ScheduleRow = {
  id: number;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  fulltimeHours: number;
  traineeHours: number;
};

export type ActionResult = { success: true } | { success: false; message: string };

export async function fetchSchedules(): Promise<ScheduleRow[]> {
  const rows = await db
    .select()
    .from(scheduleMaster)
    .orderBy(asc(scheduleMaster.startDate));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    startDate: r.startDate,
    endDate: r.endDate,
    fulltimeHours: r.fulltimeHours ?? 8,
    traineeHours: r.traineeHours ?? 5,
  }));
}

export async function createSchedule(input: Omit<ScheduleRow, "id">): Promise<ActionResult> {
  try {
    await db.insert(scheduleMaster).values({
      name: input.name.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      fulltimeHours: input.fulltimeHours,
      traineeHours: input.traineeHours,
    });
    revalidatePath("/schedule");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function updateSchedule(
  id: number,
  patch: Partial<Omit<ScheduleRow, "id">>,
): Promise<ActionResult> {
  try {
    await db
      .update(scheduleMaster)
      .set({
        ...(patch.name !== undefined && { name: patch.name.trim() }),
        ...(patch.startDate !== undefined && { startDate: patch.startDate }),
        ...(patch.endDate !== undefined && { endDate: patch.endDate }),
        ...(patch.fulltimeHours !== undefined && { fulltimeHours: patch.fulltimeHours }),
        ...(patch.traineeHours !== undefined && { traineeHours: patch.traineeHours }),
      })
      .where(eq(scheduleMaster.id, id));
    revalidatePath("/schedule");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function deleteSchedule(id: number): Promise<ActionResult> {
  try {
    await db.delete(scheduleMaster).where(eq(scheduleMaster.id, id));
    revalidatePath("/schedule");
    return { success: true };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}
