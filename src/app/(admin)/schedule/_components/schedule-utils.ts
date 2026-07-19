import { User, GraduationCap } from "lucide-react";
import type { ScheduleRow } from "../actions";

// ─── Status ───────────────────────────────────────────────────────────────────

export type Status = "active" | "upcoming" | "past";

export function getToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Sentinel used when comparing an open-ended (null) end date: it sorts after
// every real YYYY-MM-DD date, so a null end behaves as "+infinity".
export const OPEN_END = "9999-12-31";

export function statusOf(s: ScheduleRow, today: string): Status {
  if (today < s.startDate) return "upcoming";
  if (s.endDate !== null && today > s.endDate) return "past";
  return "active";
}

export const STATUS_META: Record<Status, { label: string; dotClass: string; chipClass: string }> = {
  active:   { label: "Active",   dotClass: "bg-brand",               chipClass: "bg-brand/10 border-brand/30 text-foreground" },
  upcoming: { label: "Upcoming", dotClass: "bg-indigo-400",          chipClass: "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400" },
  past:     { label: "Past",     dotClass: "bg-muted-foreground/50",  chipClass: "bg-muted border-border text-muted-foreground" },
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDateLocal(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function countDays(start: string, end: string): number {
  return Math.round((parseDateLocal(end).getTime() - parseDateLocal(start).getTime()) / 86400000) + 1;
}

/** Count Mon–Sat days (excluding Sundays) in an inclusive date range. */
export function countWorkingDays(start: string, end: string): number {
  let count = 0;
  const cur = parseDateLocal(start);
  const endDate = parseDateLocal(end);
  while (cur <= endDate) {
    if (cur.getDay() !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function fmtDateRange(start: string, end: string | null): string {
  const a = parseDateLocal(start);
  const aStr = a.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (end === null) {
    return `${aStr}, ${a.getFullYear()} – Ongoing`;
  }
  const b = parseDateLocal(end);
  const sameYear = a.getFullYear() === b.getFullYear();
  const bStr = b.toLocaleDateString("en-US", {
    month: "short", day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${aStr} – ${bStr}${sameYear ? `, ${a.getFullYear()}` : ""}`;
}

export function fmtDisplayDate(value: string): string {
  return parseDateLocal(value).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Hour helpers ─────────────────────────────────────────────────────────────

export function fmtHours(n: number): string {
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ─── Overlap detection ────────────────────────────────────────────────────────

export function findOverlap(
  schedules: ScheduleRow[],
  start: string,
  end: string | null,
  excludeId?: number,
): ScheduleRow | null {
  if (!start) return null;
  // null end = open-ended (extends to +infinity); "" = not picked yet.
  const candEnd = end === null ? OPEN_END : end;
  if (!candEnd || candEnd < start) return null;
  return schedules.find((s) => {
    if (s.id === excludeId) return false;
    const sEnd = s.endDate ?? OPEN_END;
    return start <= sEnd && candEnd >= s.startDate;
  }) ?? null;
}

// ─── Role metadata ────────────────────────────────────────────────────────────

export const ROLE_META = {
  fulltimeHours: {
    label: "Full time",
    icon: User,
    cardBorder: "border-brand/25",
    iconBg: "bg-brand/10 border-brand/20 text-foreground",
    valueBg: "bg-brand/10 border-brand/20",
    valueFg: "text-foreground",
    labelFg: "text-foreground/70",
  },
  traineeHours: {
    label: "Trainee",
    icon: GraduationCap,
    cardBorder: "border-indigo-500/25",
    iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400",
    valueBg: "bg-indigo-500/10 border-indigo-500/20",
    valueFg: "text-indigo-700 dark:text-indigo-300",
    labelFg: "text-indigo-600/70 dark:text-indigo-400/70",
  },
} as const;

export type RoleKey = keyof typeof ROLE_META;
