import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  List,
  Plus,
  Target,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Card, CardContent } from "@/src/components/ui/card";
import type { PersonalDashboardData } from "../actions";
import type { SessionUser } from "@/src/lib/session";
import { CardHead, StatusPill } from "./dashboard-ui";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function fmtHrs(n: number) {
  const h = Math.floor(n), m = Math.round((n - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function daysUntil(dateStr: string, today: string) {
  return Math.round(
    (new Date(dateStr + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000,
  );
}

// Fixed, theme-stable data-viz palette — never the --brand token (it flips to dark olive
// in dark mode and would make bars/strokes invisible). Vivid in both themes.
const TASK_COLORS = [
  "bg-lime-400",
  "bg-sky-500",
  "bg-amber-400",
  "bg-teal-500",
  "bg-orange-500",
  "bg-violet-500",
  "bg-pink-500",
] as const;
const TASK_STROKE_COLORS = [
  "#a3e635", "#0ea5e9", "#fbbf24", "#14b8a6", "#f97316", "#8b5cf6", "#ec4899",
];
const taskColor = (id: number) => TASK_COLORS[id % TASK_COLORS.length];
const taskStroke = (id: number) => TASK_STROKE_COLORS[id % TASK_STROKE_COLORS.length];

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WORKING = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

// ─── Root ─────────────────────────────────────────────────────────────────────

export function PersonalSection({
  data,
  sessionUser,
  showHolidays = true,
  showGreeting = false,
}: {
  data: PersonalDashboardData;
  sessionUser: SessionUser;
  showHolidays?: boolean;
  showGreeting?: boolean;
}) {
  const {
    today, dailyTarget, todayHalfDay, todayOnLeave, currentSchedule, upcomingHolidays,
    todayTasks, todayTotal, weekData, weekTotal,
    monthLogged, monthTarget, streak,
  } = data;

  const firstName = sessionUser.name.split(" ")[0];
  const todayLabel = new Date(today + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Optional greeting header */}
      {showGreeting && (
        <header className="relative isolate flex flex-wrap items-end justify-between gap-4 mt-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 right-0 -z-10 h-72 w-[65%] blur-3xl opacity-60"
            style={{
              background:
                "radial-gradient(60% 80% at 85% 0%, color-mix(in oklab, var(--brand) 30%, transparent), transparent 72%)",
            }}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <StatusPill tone="active">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/80" />
                {sessionUser.designation ?? "Team member"}
              </StatusPill>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted ring-1 ring-border text-xs font-medium text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {todayLabel}
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {"Here's your task progress and what's coming up."}
            </p>
          </div>
          <Link href="/tasks">
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand text-foreground text-sm font-bold ring-1 ring-foreground/10 shadow-sm hover:brightness-105 transition-all active:scale-[0.98]">
              <Plus className="h-4 w-4" />
              Log today&apos;s tasks
            </button>
          </Link>
        </header>
      )}

      {/* Section divider when embedded (mid-tier) */}
      {!showGreeting && (
        <div className="flex items-center gap-3 pt-1">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 px-3 py-1 rounded-full bg-muted ring-1 ring-border">
            My activity
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-6 items-start">
        <div className="flex flex-col gap-6">
          <TodayProgressCard todayTasks={todayTasks} todayTotal={todayTotal} dailyTarget={dailyTarget} halfDay={todayHalfDay} onLeave={todayOnLeave} today={today} />
          <WeekCard weekData={weekData} weekTotal={weekTotal} dailyTarget={dailyTarget} />
        </div>
        <div className="flex flex-col gap-6">
          <StatsRow weekTotal={weekTotal} streak={streak} monthLogged={monthLogged} monthTarget={monthTarget} />
          <MyScheduleCard schedule={currentSchedule} userType={sessionUser.type} />
          {showHolidays && <HolidaysCard holidays={upcomingHolidays} today={today} />}
        </div>
      </div>
    </div>
  );
}

// ─── Today's Progress Card ────────────────────────────────────────────────────

function TodayProgressCard({
  todayTasks, todayTotal, dailyTarget, halfDay, onLeave, today,
}: Pick<PersonalDashboardData, "todayTasks" | "todayTotal" | "dailyTarget" | "today"> & {
  halfDay: boolean;
  onLeave: boolean;
}) {
  // Half-day halves the target; on-leave days require no logging.
  const target = halfDay ? dailyTarget / 2 : dailyTarget;
  const pct = target > 0 ? Math.min(1, todayTotal / target) : 0;
  const remaining = Math.max(0, target - todayTotal);
  const done = remaining === 0;
  const dateLabel = new Date(today + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const caption = onLeave
    ? `On leave · ${dateLabel}`
    : `${halfDay ? "Half-day target" : "Daily target"} ${fmtHrs(target)} · ${dateLabel}`;

  return (
    <Card className={cn("gap-0 py-0")}>
      <div className="pt-6">
        <CardHead
          icon={<Target className="h-4 w-4 text-foreground" />}
          title="Today's task progress"
          description={caption}
          right={
            onLeave
              ? <StatusPill tone="muted">On leave</StatusPill>
              : halfDay
                ? <StatusPill tone="active"><span className="text-[11px] font-extrabold leading-none">½</span>Half day</StatusPill>
                : done
                  ? <StatusPill tone="active"><span className="h-1.5 w-1.5 rounded-full bg-foreground/80" />Target met</StatusPill>
                  : <StatusPill tone="muted">In progress</StatusPill>
          }
        />
      </div>
      <CardContent className="py-6">
        {onLeave ? (
          <div className="rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/20 px-6 py-8 text-center">
            <div className="text-base font-bold text-sky-700 dark:text-sky-400">On leave today</div>
            <p className="mt-1.5 text-sm text-muted-foreground">No tasks are required for this day.</p>
          </div>
        ) : (
          <div className="flex gap-6 items-center flex-wrap sm:flex-nowrap">
            {/* Ring */}
            <ProgressRing pct={pct} logged={todayTotal} target={target} taskColors={todayTasks.map((t) => taskStroke(t.taskId))} />

            {/* Breakdown */}
            <div className="flex-1 min-w-0 w-full">
              {/* Stacked bar */}
              <div className="h-3.5 rounded-full bg-muted ring-1 ring-border overflow-hidden flex">
                {todayTasks.map((t) => (
                  <div
                    key={t.taskId}
                    title={t.name}
                    className={cn("h-full", taskColor(t.taskId))}
                    style={{ width: `${Math.min(100, (t.hours / target) * 100)}%` }}
                  />
                ))}
              </div>

              <div className="flex justify-between mt-3 mb-4">
                <span className="text-xs text-muted-foreground">
                  <b className="text-foreground font-bold tabular-nums">{fmtHrs(todayTotal)}</b> logged
                </span>
                <span className={cn(
                  "text-xs font-bold",
                  done ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
                )}>
                  {done ? "All hours logged" : `${fmtHrs(remaining)} to target`}
                </span>
              </div>

              {/* Task list */}
              {todayTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">No tasks logged yet today.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {todayTasks.map((t) => (
                    <li key={t.taskId} className="flex items-center gap-3 py-2.5">
                      <span className={cn("w-2.5 h-2.5 rounded-[3px] shrink-0", taskColor(t.taskId))} />
                      <span className="flex-1 text-sm font-semibold text-foreground truncate">{t.name}</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">{fmtHrs(t.hours)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressRing({
  pct, logged, target, taskColors,
}: {
  pct: number; logged: number; target: number; taskColors: string[];
}) {
  const size = 148, sw = 13, r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(pct, 1));
  const strokeColor = taskColors[0] ?? "#84cc16"; // lime-500 fallback (visible in both themes)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-border" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={strokeColor} strokeWidth={sw}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold tracking-tight text-foreground leading-none tabular-nums">
          {Math.round(pct * 100)}%
        </div>
        <div className="text-xs text-muted-foreground mt-1.5 tabular-nums">
          {fmtHrs(logged)} / {fmtHrs(target)}
        </div>
      </div>
    </div>
  );
}

// ─── This Week Card ───────────────────────────────────────────────────────────

function WeekCard({
  weekData, weekTotal, dailyTarget,
}: Pick<PersonalDashboardData, "weekData" | "weekTotal" | "dailyTarget">) {
  const maxH = Math.max(dailyTarget * 1.2, ...weekData.map((d) => d.hours), 1);
  const first = weekData[0], last = weekData[6];
  const rangeLabel = `${new Date(first.dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(last.dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · per day`;

  return (
    <Card className={cn("gap-0 py-0")}>
      <div className="pt-6">
        <CardHead
          icon={<List className="h-4 w-4 text-foreground" />}
          title="This week"
          description={rangeLabel}
          right={
            <span className="text-xs text-muted-foreground">
              <b className="text-foreground font-bold tabular-nums">{fmtHrs(weekTotal)}</b> total
            </span>
          }
        />
      </div>
      <CardContent className="py-6">
        <div className="flex gap-2.5 items-end h-32 px-1">
          {weekData.map((d) => {
            const off = d.status === "weekend" || d.status === "holiday" || d.status === "future";
            const hPct = off ? 0 : Math.max(d.hours / maxH, 0.05);
            return (
              <div key={d.dow} className="flex-1 flex flex-col items-center gap-2 h-full">
                <div className="flex-1 w-full flex items-end justify-center">
                  {off ? (
                    <div className="w-full h-full rounded-xl border-2 border-dashed border-border grid place-items-center">
                      <span
                        className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider"
                        style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap" }}
                      >
                        {d.status === "holiday" ? "Holiday" : "Off"}
                      </span>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "w-full rounded-xl flex items-start justify-center pt-2",
                        d.status === "complete" && "bg-lime-400",
                        d.status === "today" && "bg-lime-400 ring-2 ring-lime-600 ring-offset-2 ring-offset-card",
                        d.status === "partial" && "bg-amber-400",
                        d.status === "future" && "bg-muted",
                      )}
                      style={{ height: `${hPct * 100}%` }}
                    >
                      {d.hours > 0 && (
                        <span className={cn(
                          "text-[11px] font-bold tabular-nums",
                          d.status === "partial" ? "text-amber-950" : "text-lime-950",
                        )}>
                          {d.hours}h
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className={cn(
                  "text-[11px]",
                  d.status === "today" ? "font-bold text-foreground" : "font-medium text-muted-foreground",
                )}>
                  {d.dow}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border flex-wrap">
          <LegendItem className="bg-lime-400" label="Target met" />
          <LegendItem className="bg-amber-400" label="Under target" />
          <LegendItem className="bg-lime-400 ring-2 ring-lime-600" label="Today" />
          <LegendItem dashed label="Off / Holiday" />
        </div>
      </CardContent>
    </Card>
  );
}

function LegendItem({ className, label, dashed }: { className?: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("w-2.5 h-2.5 rounded-[3px]", dashed ? "border-2 border-dashed border-border" : className)} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({
  weekTotal, streak, monthLogged, monthTarget,
}: Pick<PersonalDashboardData, "weekTotal" | "streak" | "monthLogged" | "monthTarget">) {
  const tiles = [
    { icon: <Clock className="h-4 w-4" />, value: fmtHrs(weekTotal), label: "Logged this week" },
    { icon: <Flame className="h-4 w-4" />, value: String(streak), label: "Day logging streak" },
    { icon: <CheckCircle2 className="h-4 w-4" />, value: `${monthLogged}h`, label: `of ${monthTarget}h this month` },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className={cn("rounded-2xl ring-1 ring-border bg-card p-4")}>
          <div className="h-8 w-8 rounded-lg bg-muted ring-1 ring-border grid place-items-center text-foreground/70">
            {t.icon}
          </div>
          <div className="text-[1.75rem] font-bold tracking-tight text-foreground mt-3 leading-none tabular-nums">
            {t.value}
          </div>
          <div className="text-xs text-muted-foreground mt-1.5 leading-snug">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── My Schedule Card ─────────────────────────────────────────────────────────

function MyScheduleCard({
  schedule, userType,
}: {
  schedule: PersonalDashboardData["currentSchedule"];
  userType: string;
}) {
  const target = schedule ? (userType === "F" ? schedule.fulltimeHours : schedule.traineeHours) : 7;
  const startLabel = schedule
    ? new Date(schedule.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <Card className={cn("gap-0 py-0")}>
      <div className="pt-6">
        <CardHead
          icon={<Clock className="h-4 w-4 text-foreground" />}
          title="My schedule"
          description={schedule ? `${startLabel} — ongoing` : undefined}
          right={
            schedule
              ? <StatusPill tone="active"><span className="h-1.5 w-1.5 rounded-full bg-foreground/80" />Active</StatusPill>
              : <StatusPill tone="muted">None</StatusPill>
          }
        />
      </div>
      <CardContent className="py-6">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-[2rem] leading-none font-bold tracking-tight text-foreground tabular-nums">{fmtHrs(target)}</span>
          <span className="text-xs text-muted-foreground">
            daily · {fmtHrs(target / 2)} half{schedule ? ` · ${schedule.name}` : ""}
          </span>
        </div>
        <div className="flex gap-1.5">
          {ALL_DAYS.map((d) => (
            <div
              key={d}
              className={cn(
                "flex-1 text-center text-[11px] font-bold py-2 rounded-lg",
                WORKING.has(d)
                  ? "bg-brand text-foreground ring-1 ring-foreground/10"
                  : "bg-background text-muted-foreground ring-1 ring-border",
              )}
            >
              {d[0]}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Holidays Card ────────────────────────────────────────────────────────────

function HolidaysCard({
  holidays, today,
}: {
  holidays: PersonalDashboardData["upcomingHolidays"];
  today: string;
}) {
  const shown = holidays.slice(0, 4);
  return (
    <Card className={cn("gap-0 py-0")}>
      <div className="pt-6">
        <CardHead
          icon={<CalendarDays className="h-4 w-4 text-foreground" />}
          title="Upcoming holidays"
          description="Next office closures"
        />
      </div>
      <CardContent className="py-4">
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No upcoming holidays</p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((h) => {
              const dt = new Date(h.startDate + "T00:00:00");
              const mon = dt.toLocaleDateString("en-US", { month: "short" });
              const dow = dt.toLocaleDateString("en-US", { weekday: "long" });
              const dd = daysUntil(h.startDate, today);
              return (
                <li key={h.id} className="flex items-center gap-3.5 py-3.5 first:pt-0">
                  <div className="h-12 w-12 shrink-0 rounded-2xl bg-brand/15 ring-1 ring-brand/30 flex flex-col items-center justify-center gap-0.5">
                    <span className="text-[10px] font-bold text-foreground/70 tracking-wide uppercase leading-none">{mon}</span>
                    <span className="text-base font-extrabold text-foreground leading-none tabular-nums">{dt.getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{h.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{dow}</p>
                  </div>
                  <span className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap",
                    dd === 0
                      ? "bg-brand text-foreground ring-1 ring-foreground/10"
                      : "bg-muted text-foreground/70 ring-1 ring-border",
                  )}>
                    {dd === 0 ? "Today" : `in ${dd}d`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
