// A day's logging target. Plain module (no "use client"/"use server") so both
// server data loaders and components can import it.

type Schedule = {
  startDate: string;
  endDate: string | null; // null = open-ended
  fulltimeHours: number;
  traineeHours: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

export const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// Schedule in effect on `date`.
export function activeSchedule<T extends Schedule>(schedules: T[], date: string): T | undefined {
  return schedules.find((s) => s.startDate <= date && (s.endDate === null || s.endDate >= date));
}

// Full-time ("F") vs trainee hours; 7h when no schedule covers the date.
export function baseHours(schedule: Schedule | undefined, type: string): number {
  if (!schedule) return 7;
  return type === "F" ? schedule.fulltimeHours : schedule.traineeHours;
}

// Same formula as the timesheet: half day halves the schedule, extra hours add on.
export function targetFor(base: number, meta?: { halfDay?: boolean; extraHours?: number }): number {
  return (meta?.halfDay ? base / 2 : base) + (meta?.extraHours ?? 0);
}
