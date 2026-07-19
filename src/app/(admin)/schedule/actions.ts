"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { scheduleMaster } from "@/src/db/schema";
import { getErrorMessage } from "@/src/lib/utils";

export type ScheduleRow = {
  id: number;
  name: string;
  startDate: string;        // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD, or null = open-ended (ongoing)
  fulltimeHours: number;
  traineeHours: number;
};

export type ActionResult = { success: true } | { success: false; message: string };
export type CreateResult = { success: true; id: number } | { success: false; message: string };

// Sorts after every real date, so a null (open-ended) end behaves as +infinity.
const OPEN_END = "9999-12-31";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

// Returns the first existing schedule whose date range overlaps [start, end],
// treating a null end (either side) as open-ended. An open-ended schedule thus
// blocks any new/edited schedule that would run on or after its start date.
async function findOverlapping(
  start: string,
  end: string | null,
  excludeId?: number,
): Promise<{ name: string } | null> {
  const candEnd = end ?? OPEN_END;
  const rows = await db
    .select({ id: scheduleMaster.id, name: scheduleMaster.name, startDate: scheduleMaster.startDate, endDate: scheduleMaster.endDate })
    .from(scheduleMaster);
  for (const r of rows) {
    if (r.id === excludeId) continue;
    const rEnd = r.endDate ?? OPEN_END;
    if (start <= rEnd && candEnd >= r.startDate) return { name: r.name };
  }
  return null;
}

export async function createSchedule(input: Omit<ScheduleRow, "id">): Promise<CreateResult> {
  if (input.endDate !== null && input.endDate < input.startDate) {
    return { success: false, message: "End date must be on or after start date" };
  }
  // A defined end date on a schedule that already covers today must be today or
  // later — you cannot cap an active/ongoing schedule in the past.
  if (input.endDate !== null && input.startDate <= todayStr() && input.endDate < todayStr()) {
    return { success: false, message: "End date must be today or later" };
  }
  const overlap = await findOverlapping(input.startDate, input.endDate);
  if (overlap) {
    return {
      success: false,
      message: `Overlaps with "${overlap.name}". Give the ongoing schedule an end date before adding a later one.`,
    };
  }
  try {
    const [row] = await db
      .insert(scheduleMaster)
      .values({
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        fulltimeHours: input.fulltimeHours,
        traineeHours: input.traineeHours,
      })
      .returning({ id: scheduleMaster.id });
    revalidatePath("/schedule");
    return { success: true, id: row.id };
  } catch (err) {
    return { success: false, message: getErrorMessage(err) };
  }
}

export async function updateSchedule(
  id: number,
  patch: Partial<Omit<ScheduleRow, "id">>,
): Promise<ActionResult> {
  const [current] = await db
    .select({ startDate: scheduleMaster.startDate, endDate: scheduleMaster.endDate })
    .from(scheduleMaster)
    .where(eq(scheduleMaster.id, id));
  if (!current) return { success: false, message: "Schedule not found" };

  const effStart = patch.startDate ?? current.startDate;
  const effEnd = patch.endDate !== undefined ? patch.endDate : current.endDate;

  if (effEnd !== null && effEnd < effStart) {
    return { success: false, message: "End date must be on or after start date" };
  }
  // Capping a schedule that covers today (active or ongoing) must not move its
  // end into the past.
  if (effEnd !== null && effStart <= todayStr() && effEnd < todayStr()) {
    return { success: false, message: "End date cannot be moved before today for an active schedule" };
  }
  const overlap = await findOverlapping(effStart, effEnd, id);
  if (overlap) {
    return {
      success: false,
      message: `Overlaps with "${overlap.name}". Give the ongoing schedule an end date first.`,
    };
  }
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
