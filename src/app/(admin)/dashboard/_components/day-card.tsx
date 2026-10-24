import Link from "next/link";
import { ArrowRight, CalendarDays, Clock } from "lucide-react";

import { cn, hashIndex } from "@/src/lib/utils";
import type { DaySummary } from "../data";
import { fmtHrs } from "./dashboard-ui";

const LEAVE_LABEL = { casual: "Casual leave", earned: "Earned leave", unpaid: "Unpaid leave", co: "Compensatory off" } as const;

// Fixed vivid dots — never the --brand token, which flips to dark olive in dark mode.
const DOTS = ["bg-lime-500", "bg-sky-500", "bg-amber-400", "bg-teal-500", "bg-orange-500", "bg-violet-500", "bg-pink-500"];

const MAX_CHIPS = 6;

function fmtDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });
}

function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ring-1",
        tone === "ok" && "bg-lime-400/20 text-foreground ring-lime-500/40",
        tone === "warn" && "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/30",
        tone === "bad" && "bg-destructive/10 text-destructive ring-destructive/25",
        tone === "muted" && "bg-muted text-muted-foreground ring-border",
      )}
    >
      {children}
    </span>
  );
}

// One day of the viewer's own activity: status, hours vs target, tasks.
export function DayCard({ label, day, isToday }: { label: string; day: DaySummary; isToday?: boolean }) {
  const { status } = day;
  const expected = day.target > 0;
  const pct = expected ? Math.min(99, Math.floor((day.logged / day.target) * 100)) : 0;
  const remaining = Math.max(0, Math.round(day.target * 60) - Math.round(day.logged * 60)) / 60;
  const Icon = isToday ? CalendarDays : Clock;

  const pill =
    status === "complete" ? <Pill tone="ok">Complete</Pill>
    : status === "partial" ? <Pill tone="warn">{isToday ? "In progress" : "Partial"} ({pct}%)</Pill>
    : status === "missing" ? <Pill tone="bad">{isToday ? "Not logged yet" : "Not logged"}</Pill>
    : status === "leave" ? <Pill tone="muted">{day.leaveType ? LEAVE_LABEL[day.leaveType] : "On leave"}</Pill>
    : <Pill tone="muted">{status === "holiday" ? "Holiday" : "Day off"}</Pill>;

  const shown = day.tasks.slice(0, MAX_CHIPS);
  const hidden = day.tasks.length - shown.length;

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-9 w-9 shrink-0 rounded-xl bg-brand/20 ring-1 ring-brand/30 grid place-items-center">
            <Icon className="h-4 w-4 text-foreground" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground leading-tight">{label}</h3>
            <p className="text-xs text-muted-foreground truncate">{fmtDate(day.date)}</p>
          </div>
        </div>
        {pill}
      </div>

      {!expected && day.logged === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {status === "holiday" ? `${day.holidayName} — no logging needed.`
            : status === "leave" ? "On leave — no logging needed."
            : "Not a working day."}
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl leading-none font-bold tracking-tight text-foreground tabular-nums">
                {fmtHrs(day.logged)}
              </span>
              {expected && (
                <span className="text-sm text-muted-foreground tabular-nums">
                  / {fmtHrs(day.target)}{day.halfDay ? " (half day)" : ""}
                </span>
              )}
            </div>
            {expected && (
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums",
                  remaining === 0
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : status === "missing"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                )}
              >
                {remaining === 0 ? "Target met" : `${fmtHrs(remaining)} to go`}
              </span>
            )}
          </div>

          {expected && (
            <div className="h-2 rounded-full bg-muted overflow-hidden mt-2.5">
              <div
                className={cn("h-full rounded-full", status === "complete" ? "bg-lime-400" : "bg-amber-400")}
                style={{ width: status === "complete" ? "100%" : `${pct}%` }}
              />
            </div>
          )}

          {shown.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-3">
              {shown.map((t) => (
                <li
                  key={t.name}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 ring-1 ring-border/60 px-2.5 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", DOTS[hashIndex(t.name, DOTS.length)])} />
                    <span className="font-medium text-foreground truncate">{t.name}</span>
                  </span>
                  <span className="font-semibold text-foreground tabular-nums shrink-0">{fmtHrs(t.hours)}</span>
                </li>
              ))}
              {hidden > 0 && (
                <li className="px-2.5 py-1.5 text-xs text-muted-foreground">+{hidden} more</li>
              )}
            </ul>
          )}
        </>
      )}

      {status !== "holiday" && status !== "off" && (
        <div className="mt-auto pt-3">
        <div className="pt-3 border-t border-border flex items-center justify-between gap-3 text-xs">
          <Link
            href={`/tasks?date=${day.date}`}
            className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:underline underline-offset-4"
          >
            {isToday && day.logged === 0 ? "Log tasks now" : "Open full timesheet"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <span className="text-muted-foreground tabular-nums">
            {day.tasks.length > 0
              ? `${day.tasks.length} ${day.tasks.length === 1 ? "task" : "tasks"} logged`
              : expected ? `Target: ${+(day.target).toFixed(2)} hrs/day` : ""}
          </span>
        </div>
        </div>
      )}
    </section>
  );
}
