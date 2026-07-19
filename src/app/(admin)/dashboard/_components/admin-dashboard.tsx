import {
  CalendarDays,
  Clock,
  Users,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Card, CardContent } from "@/src/components/ui/card";
import type { AdminDashboardData, DashboardHolidayRow, DashboardScheduleRow } from "../actions";
import type { SessionUser } from "@/src/lib/session";
import { NotLoggedCard, UnderTargetCard } from "./user-list-card";
import type { PersonalDashboardData } from "../actions";
import { PersonalSection } from "./personal-section";
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

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WORKING_DAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

// ─── Root ─────────────────────────────────────────────────────────────────────

export function AdminDashboard({
  data,
  sessionUser,
  personalData,
  showSchedule = true,
}: {
  data: AdminDashboardData;
  sessionUser: SessionUser;
  personalData?: PersonalDashboardData;
  showSchedule?: boolean;
}) {
  const { users, upcomingHolidays, currentSchedule, notLoggedToday, underTargetToday, today } = data;
  const activeUsers = users.filter((u) => u.isActive);
  const ftUsers = users.filter((u) => u.type === "F");
  const trUsers = users.filter((u) => u.type !== "F");
  const loggedToday = activeUsers.length - notLoggedToday.length;

  const firstName = sessionUser.name.split(" ")[0];
  const todayLabel = new Date(today + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="relative isolate mt-6 space-y-6">
      {/* Atmospheric brand glow — lifts the white cards off the white panel */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-0 -z-10 h-72 w-[65%] blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(60% 80% at 85% 0%, color-mix(in oklab, var(--brand) 30%, transparent), transparent 72%)",
        }}
      />

      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <StatusPill tone="active">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/80" />
              Admin overview
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
            Workforce status, schedules, and outstanding task logs at a glance.
          </p>
        </div>
      </header>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-6 items-start">
        <div className="flex flex-col gap-6">
          <UsersCard
            total={users.length}
            active={activeUsers.length}
            inactive={users.length - activeUsers.length}
            fullTime={ftUsers.length}
            ftActive={ftUsers.filter((u) => u.isActive).length}
            trainees={trUsers.length}
            trActive={trUsers.filter((u) => u.isActive).length}
            loggedToday={loggedToday}
          />
          {showSchedule && <ScheduleCard schedule={currentSchedule} />}
        </div>
        <HolidaysCard holidays={upcomingHolidays} today={today} />
      </div>

      {/* ── Tracking row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <NotLoggedCard users={notLoggedToday} today={today} />
        <UnderTargetCard rows={underTargetToday} />
      </div>

      {/* ── Personal section for mid-tier ── */}
      {personalData && (
        <PersonalSection
          data={personalData}
          sessionUser={sessionUser}
          showHolidays={false}
          showGreeting={false}
        />
      )}
    </div>
  );
}

// ─── Users Card ───────────────────────────────────────────────────────────────

function UsersCard({
  total, active, inactive, fullTime, ftActive, trainees, trActive, loggedToday,
}: {
  total: number; active: number; inactive: number;
  fullTime: number; ftActive: number; trainees: number; trActive: number;
  loggedToday: number;
}) {
  const stats = [
    { value: total, label: "Total users", dot: null as string | null, sub: null as string | null },
    { value: active, label: "Active", dot: null, sub: `${inactive} inactive` },
    { value: fullTime, label: "Full-time", dot: "bg-lime-500", sub: `${ftActive} active` },
    { value: trainees, label: "Trainees", dot: "bg-sky-500", sub: `${trActive} active` },
  ];

  return (
    <Card className={cn("gap-0 py-0")}>
      <div className="pt-6">
        <CardHead
          icon={<Users className="h-4 w-4 text-foreground" />}
          title="Users"
          description="Workforce headcount & status"
          right={
            <StatusPill tone="active">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/80" />
              {loggedToday} logged today
            </StatusPill>
          }
        />
      </div>
      <CardContent className="py-6">
        <div className="flex items-stretch divide-x divide-border">
          {stats.map((s) => (
            <div key={s.label} className="flex-1 px-5 first:pl-0 last:pr-0 min-w-0">
              <div className="text-[2.5rem] leading-none font-bold tracking-tight text-foreground tabular-nums">
                {s.value}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground mt-2.5">
                {s.dot && <span className={cn("h-2 w-2 rounded-full shrink-0", s.dot)} />}
                {s.label}
              </div>
              {s.sub && <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Schedule Card ────────────────────────────────────────────────────────────

function WeekStrip() {
  return (
    <div className="flex gap-1.5 mt-4">
      {ALL_DAYS.map((d) => (
        <div
          key={d}
          className={cn(
            "flex-1 text-center text-[11px] font-bold py-2 rounded-lg",
            WORKING_DAYS.has(d)
              ? "bg-brand text-foreground ring-1 ring-foreground/10"
              : "bg-background text-muted-foreground ring-1 ring-border",
          )}
        >
          {d[0]}
        </div>
      ))}
    </div>
  );
}

function ScheduleCard({ schedule }: { schedule: DashboardScheduleRow | null }) {
  const startLabel = schedule
    ? new Date(schedule.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const endLabel = schedule
    ? schedule.endDate === null
      ? "Ongoing"
      : new Date(schedule.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <Card className={cn("gap-0 py-0")}>
      <div className="pt-6">
        <CardHead
          icon={<Clock className="h-4 w-4 text-foreground" />}
          title="Current schedule"
          description={schedule ? `${startLabel} — ${endLabel}` : undefined}
          right={
            schedule
              ? <StatusPill tone="active"><span className="h-1.5 w-1.5 rounded-full bg-foreground/80" />Active</StatusPill>
              : <StatusPill tone="muted">None</StatusPill>
          }
        />
      </div>
      <CardContent className="py-6">
        {schedule ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full-time */}
            <div className="rounded-2xl bg-muted/60 ring-1 ring-border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-foreground truncate">{schedule.name}</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Full-time</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-3">
                <span className="text-[2rem] leading-none font-bold tracking-tight text-foreground tabular-nums">{fmtHrs(schedule.fulltimeHours)}</span>
                <span className="text-xs text-muted-foreground">daily · {fmtHrs(schedule.fulltimeHours / 2)} half</span>
              </div>
              <WeekStrip />
            </div>
            {/* Trainee */}
            <div className="rounded-2xl bg-muted/60 ring-1 ring-border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-foreground truncate">{schedule.name}</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Trainee</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-3">
                <span className="text-[2rem] leading-none font-bold tracking-tight text-foreground tabular-nums">{fmtHrs(schedule.traineeHours)}</span>
                <span className="text-xs text-muted-foreground">daily</span>
              </div>
              <WeekStrip />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">No active schedule for today.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Holidays Card ────────────────────────────────────────────────────────────

function HolidaysCard({ holidays, today }: { holidays: DashboardHolidayRow[]; today: string }) {
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
        {holidays.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No upcoming holidays</p>
        ) : (
          <ul className="divide-y divide-border">
            {holidays.map((h) => {
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
