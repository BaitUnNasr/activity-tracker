"use client";

import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";

import { cn, hashIndex } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { IconChip } from "@/src/components/page-ui";
import { CalendarWeekToggle } from "@/src/components/calendar-week-toggle";
import { useCollapsibleCalendar } from "@/src/hooks/use-collapsible-calendar";
import type { TasksPageData } from "../actions";
import type { LeaveType } from "../leave";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocalEntry = { task: string; category: string; answer: string; hours: number };
export type LocalDay = {
  halfDay: boolean;
  onLeave: boolean;
  leaveType: LeaveType | null;
  entries: LocalEntry[];
};

// ─── Leave types ──────────────────────────────────────────────────────────────

export const LEAVE_TYPE_OPTIONS: { value: LeaveType; label: string; hint: string }[] = [
  { value: "casual", label: "Casual leave", hint: "Short-notice personal time off" },
  { value: "earned", label: "Earned leave", hint: "Accrued paid leave" },
  { value: "unpaid", label: "Unpaid leave", hint: "Leave without pay" },
];

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  casual: "Casual leave",
  earned: "Earned leave",
  unpaid: "Unpaid leave",
};

export type DayStatus =
  | "complete"
  | "partial"
  | "missing"
  | "half"
  | "leave"
  | "holiday"
  | "weekend"
  | "future"
  | "today-empty";

// ─── Constants ────────────────────────────────────────────────────────────────

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const TASK_COLORS = [
  "#9bc81f", "#5b8def", "#e0a35c", "#e0698f",
  "#39b3a6", "#8b7ce0", "#c98a3a", "#d94f4f",
];

type StatusMeta = {
  cellBg: string;
  cellBorder: string;
  cellText: string;
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  dotColor: string;
};

export const STATUS_META: Record<DayStatus, StatusMeta> = {
  complete: { cellBg: "bg-green-50 dark:bg-green-950/20", cellBorder: "border-green-200 dark:border-green-800", cellText: "text-green-700 dark:text-green-400", label: "Logged", badgeBg: "bg-green-50 dark:bg-green-950/30", badgeBorder: "border-green-200 dark:border-green-800", badgeText: "text-green-700 dark:text-green-400", dotColor: "bg-green-500" },
  partial: { cellBg: "bg-amber-50 dark:bg-amber-950/20", cellBorder: "border-amber-200 dark:border-amber-800", cellText: "text-amber-700 dark:text-amber-400", label: "Under target", badgeBg: "bg-amber-50 dark:bg-amber-950/30", badgeBorder: "border-amber-200 dark:border-amber-800", badgeText: "text-amber-700 dark:text-amber-400", dotColor: "bg-amber-500" },
  missing: { cellBg: "bg-red-50 dark:bg-red-950/20", cellBorder: "border-red-200 dark:border-red-800", cellText: "text-red-700 dark:text-red-400", label: "Not logged", badgeBg: "bg-red-50 dark:bg-red-950/30", badgeBorder: "border-red-200 dark:border-red-800", badgeText: "text-red-700 dark:text-red-400", dotColor: "bg-red-500" },
  half: { cellBg: "bg-amber-50 dark:bg-amber-950/20", cellBorder: "border-amber-200 dark:border-amber-800", cellText: "text-amber-700 dark:text-amber-400", label: "Half day", badgeBg: "bg-amber-50 dark:bg-amber-950/30", badgeBorder: "border-amber-200 dark:border-amber-800", badgeText: "text-amber-700 dark:text-amber-400", dotColor: "bg-amber-500" },
  leave: { cellBg: "bg-sky-50 dark:bg-sky-950/20", cellBorder: "border-sky-200 dark:border-sky-800", cellText: "text-sky-700 dark:text-sky-400", label: "Leave", badgeBg: "bg-sky-50 dark:bg-sky-950/30", badgeBorder: "border-sky-200 dark:border-sky-800", badgeText: "text-sky-700 dark:text-sky-400", dotColor: "bg-sky-500" },
  holiday: { cellBg: "bg-indigo-50 dark:bg-indigo-950/20", cellBorder: "border-indigo-200 dark:border-indigo-800", cellText: "text-indigo-700 dark:text-indigo-400", label: "Holiday", badgeBg: "bg-indigo-50 dark:bg-indigo-950/30", badgeBorder: "border-indigo-200 dark:border-indigo-800", badgeText: "text-indigo-700 dark:text-indigo-400", dotColor: "bg-indigo-500" },
  weekend: { cellBg: "bg-muted", cellBorder: "border-border", cellText: "text-muted-foreground", label: "Sunday", badgeBg: "bg-muted", badgeBorder: "border-border", badgeText: "text-muted-foreground", dotColor: "bg-muted-foreground/40" },
  future: { cellBg: "bg-background", cellBorder: "border-border", cellText: "text-muted-foreground", label: "Upcoming", badgeBg: "bg-muted", badgeBorder: "border-border", badgeText: "text-muted-foreground", dotColor: "bg-muted-foreground/40" },
  "today-empty": { cellBg: "bg-background", cellBorder: "border-foreground", cellText: "text-foreground", label: "Today · not logged", badgeBg: "bg-background", badgeBorder: "border-border", badgeText: "text-muted-foreground", dotColor: "bg-foreground" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtHrs(n: number): string {
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function fmtLong(s: string): string {
  return parseISO(s).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

export function taskColor(task: string): string {
  return TASK_COLORS[hashIndex(task, TASK_COLORS.length)];
}

export function buildHolidayMap(holidays: { name: string; startDate: string; endDate: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  holidays.forEach((h) => {
    const cur = parseISO(h.startDate);
    while (toDateStr(cur) <= h.endDate) {
      map.set(toDateStr(cur), h.name);
      cur.setDate(cur.getDate() + 1);
    }
  });
  return map;
}

export function buildServerMap(data: TasksPageData): Map<string, LocalDay> {
  const map = new Map<string, LocalDay>();
  const byDate = new Map<string, LocalEntry[]>();
  data.entries.forEach((e) => {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push({ task: e.task, category: e.category, answer: e.answer, hours: e.hours });
  });
  const allDates = new Set([...byDate.keys(), ...data.dayMetas.map((m) => m.date)]);
  allDates.forEach((date) => {
    const meta = data.dayMetas.find((m) => m.date === date);
    map.set(date, {
      halfDay: meta?.halfDay ?? false,
      onLeave: meta?.onLeave ?? false,
      leaveType: meta?.leaveType ?? null,
      entries: byDate.get(date) ?? [],
    });
  });
  return map;
}

export function getDayStatus(
  dateStr: string,
  holidayMap: Map<string, string>,
  dayData: LocalDay | undefined,
  today: string,
  dailyTarget: number,
): DayStatus {
  if (holidayMap.has(dateStr)) return "holiday";
  const dow = parseISO(dateStr).getDay();
  if (dow === 0) return "weekend"; // Sunday only — Mon–Sat are working days
  // Leave (incl. earned leave planned ahead) shows before the future check so
  // upcoming leave days render as leave, not blank "future" cells.
  if (dayData?.onLeave) return "leave";
  if (dateStr > today) return "future";
  const total = dayData?.entries.reduce((s, e) => s + e.hours, 0) ?? 0;
  const target = dayData?.halfDay ? dailyTarget / 2 : dailyTarget;
  if (!dayData || total === 0) return dateStr === today ? "today-empty" : "missing";
  if (dayData.halfDay) return "half";
  if (total >= target) return "complete";
  return "partial";
}

// ─── Calendar card ────────────────────────────────────────────────────────────

export function CalendarCard({
  viewYear, viewMonth, selected, today,
  holidayMap, serverMap, localDay, dailyTarget,
  onSelectDate, onStepMonth, onGoToday,
}: {
  viewYear: number; viewMonth: number; selected: string; today: string;
  holidayMap: Map<string, string>; serverMap: Map<string, LocalDay>;
  localDay: LocalDay; dailyTarget: number;
  onSelectDate: (d: string) => void; onStepMonth: (dir: number) => void; onGoToday: () => void;
}) {
  const startDow = new Date(viewYear, viewMonth, 1).getDay();
  const dim = new Date(viewYear, viewMonth + 1, 0).getDate();
  const totalCells = Math.ceil((startDow + dim) / 7) * 7;

  const cells: { inMonth: boolean; dn: number; i: number }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dn = i - startDow + 1;
    cells.push({ inMonth: dn >= 1 && dn <= dim, dn, i });
  }

  const { expanded, setExpanded, isRowHidden, handleStep, clearWeekAnchor } =
    useCollapsibleCalendar({ viewYear, viewMonth, selected, today, onStepMonth });

  return (
    <Card className="gap-0">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2.5 text-xl font-bold">
          <IconChip size="sm"><CalendarDays className="h-3.5 w-3.5 text-foreground" /></IconChip>
          {MONTHS[viewMonth]} {viewYear}
        </CardTitle>
        <CardDescription>Pick a day to log or review your tasks.</CardDescription>
        <CardAction>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-sm" onClick={() => handleStep(-1)} className="rounded-full">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { clearWeekAnchor(); onGoToday(); }}
              className="rounded-full px-3 text-xs font-medium"
            >
              Today
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => handleStep(1)} className="rounded-full">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="py-1.5 text-center text-[11px] font-medium text-muted-foreground tracking-wide">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {cells.map(({ inMonth, dn, i }) => {
            if (!inMonth) return <div key={i} className={cn(isRowHidden(i) && "hidden lg:block")} />;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dn).padStart(2, "0")}`;
            const dayData = dateStr === selected ? localDay : serverMap.get(dateStr);
            const status = getDayStatus(dateStr, holidayMap, dayData, today, dailyTarget);
            const meta = STATUS_META[status];
            const isSelected = dateStr === selected;
            const isToday = dateStr === today;
            const entryTotal = dayData?.entries.reduce((s, e) => s + e.hours, 0) ?? 0;
            const holidayName = holidayMap.get(dateStr);

            return (
              <button
                key={i}
                onClick={() => { clearWeekAnchor(); onSelectDate(dateStr); }}
                title={holidayName}
                className={cn(
                  "relative h-[60px] sm:h-[72px] w-full rounded-xl border-[1.5px] p-1.5 sm:p-2 text-left flex-col justify-between transition-all overflow-hidden hover:brightness-[0.97]",
                  isRowHidden(i) ? "hidden lg:flex" : "flex",
                  meta.cellBg,
                  isSelected
                    ? "border-foreground/50 ring-2 ring-foreground/20 ring-offset-1 ring-offset-background"
                    : meta.cellBorder,
                )}
              >
                {/* Half-day diagonal tint */}
                {dayData?.halfDay && (
                  <span className="absolute inset-0 bg-gradient-to-br from-transparent to-amber-500/10 pointer-events-none" />
                )}
                {/* Today ring */}
                {isToday && !isSelected && (
                  <span className="absolute inset-0 ring-2 ring-inset ring-brand rounded-[10px] pointer-events-none" />
                )}

                <div className="flex justify-between items-start relative">
                  <span className={cn(
                    "text-[13px] leading-none font-medium",
                    isToday
                      ? "bg-foreground text-background rounded-full w-[22px] h-[22px] flex items-center justify-center font-bold text-[12px]"
                      : meta.cellText,
                  )}>
                    {dn}
                  </span>
                  {status === "complete" && <Check className={cn("h-3 w-3 shrink-0", meta.cellText)} />}
                  {status === "missing" && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                  {dayData?.halfDay && <span className={cn("text-[11px] font-extrabold shrink-0", meta.cellText)}>½</span>}
                  {status === "leave" && <span className={cn("text-[11px] font-extrabold shrink-0", meta.cellText)}>L</span>}
                </div>

                <div className="absolute left-2 right-2 bottom-2">
                  {status === "leave" && (
                    <span className={cn("text-[10px] font-semibold", meta.cellText)}>Leave</span>
                  )}
                  {status === "holiday" && (
                    <span className={cn("text-[10px] font-semibold truncate block", meta.cellText)}>
                      {holidayName}
                    </span>
                  )}
                  {(status === "complete" || status === "partial" || status === "half") && (
                    <span className={cn("text-[11px] font-bold tabular-nums", meta.cellText)}>
                      {fmtHrs(entryTotal)}{dayData?.halfDay ? " · ½" : ""}
                    </span>
                  )}
                  {status === "missing" && (
                    <span className={cn("text-[10px] font-semibold", meta.cellText)}>Not logged</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Mobile week/month toggle */}
        <CalendarWeekToggle expanded={expanded} onToggle={() => setExpanded(!expanded)} />

        {/* Legend — hidden on mobile while collapsed to keep the page compact */}
        <div className={cn(
          "flex-wrap gap-x-4 gap-y-2 mt-5 pt-4 border-t border-dashed border-border",
          expanded ? "flex" : "hidden lg:flex",
        )}>
          {[
            { color: "bg-green-500", label: "Logged" },
            { color: "bg-amber-500", label: "Under target" },
            { color: "bg-red-500", label: "Not logged" },
            { color: "bg-sky-500", label: "Leave" },
            { color: "bg-indigo-500", label: "Holiday" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-[3px] shrink-0", color)} />
              {label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">½</span>
            Half day
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Day badge ────────────────────────────────────────────────────────────────

export function DayBadge({ status }: { status: DayStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11.5px] font-semibold shrink-0",
      m.badgeBg, m.badgeBorder, m.badgeText,
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", m.dotColor)} />
      {m.label}
    </span>
  );
}

// ─── Read-only task row ──────────────────────────────────────────────────────

// Renders straight from the entry: it carries its own task name, so a row still
// shows correctly after the task is deleted, renamed or hidden from this user.
export function ReadOnlyTaskRow({ entry }: { entry: LocalEntry }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/50 border border-border/60 rounded-xl">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: taskColor(entry.task) }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-foreground truncate">{entry.task}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {entry.category ? `${entry.category} · ${entry.answer}` : entry.answer}
        </div>
      </div>
      <span className="text-sm font-semibold tabular-nums text-muted-foreground shrink-0">
        {fmtHrs(entry.hours)}
      </span>
    </div>
  );
}

// ─── Locked notice ────────────────────────────────────────────────────────────

export function LockedNotice({ holidayName, isFuture }: { holidayName?: string; isFuture?: boolean }) {
  if (isFuture) {
    return (
      <div className="rounded-3xl border px-6 py-8 text-center bg-muted border-border">
        <div className="text-base font-bold text-muted-foreground">Upcoming</div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Task input is only available for today.
        </p>
      </div>
    );
  }
  const isHoliday = !!holidayName;
  return (
    <div className={cn(
      "rounded-3xl border px-6 py-8 text-center",
      isHoliday
        ? "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800"
        : "bg-muted border-border",
    )}>
      <div className={cn("text-base font-bold", isHoliday ? "text-indigo-700 dark:text-indigo-400" : "text-muted-foreground")}>
        {isHoliday ? holidayName : "Sunday"}
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {isHoliday ? "Company holiday — no task input required." : "No task input required on Sundays."}
      </p>
    </div>
  );
}

// ─── Leave active card ────────────────────────────────────────────────────────

export function LeaveActiveCard({
  active,
  onRemove,
  removeLabel = "Remove leave",
  leaveType,
}: {
  active: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  leaveType?: LeaveType | null;
}) {
  return (
    <div className={cn(
      "rounded-3xl border px-6 py-8 text-center",
      "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800",
    )}>
      <div className="text-base font-bold text-sky-700 dark:text-sky-400">
        {active ? "On Leave" : "Was on Leave"}
      </div>
      {leaveType && (
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs font-semibold text-sky-700 dark:text-sky-400">
          {LEAVE_TYPE_LABEL[leaveType]}
        </div>
      )}
      <p className="mt-1.5 text-sm text-muted-foreground">
        No tasks required for this day.
      </p>
      {onRemove && (
        <Button
          onClick={onRemove}
          variant="outline"
          className="mt-4 rounded-full text-xs border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-950/40"
        >
          {removeLabel}
        </Button>
      )}
    </div>
  );
}
