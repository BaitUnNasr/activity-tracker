import Link from "next/link";
import { Clock, PartyPopper, Plus } from "lucide-react";

import { isAdminRole } from "@/src/lib/access";
import { addDays } from "@/src/lib/day-target";
import type { SessionUser } from "@/src/lib/session";
import type { DashboardData } from "../data";
import { DayCard } from "./day-card";
import { TeamCard } from "./team-card";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// Same page for every role: "My activity" unless Admin (who doesn't log),
// "My team" when the viewer has subordinates.
export function Dashboard({ data, sessionUser }: { data: DashboardData; sessionUser: SessionUser }) {
  const { today, yesterday, nextHoliday, mine, team } = data;
  const todayLabel = "Today";
  // The previous working day is the literal yesterday except after Sundays/holidays.
  const isLiteralYesterday = yesterday === addDays(today, -1);
  const yesterdayLabel = isLiteralYesterday
    ? "Yesterday"
    : new Date(`${yesterday}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  const yesterdayWord = isLiteralYesterday ? "yesterday" : yesterdayLabel;
  const scope = isAdminRole(sessionUser.designation) ? "across all branches" : `for ${sessionUser.branch ?? "your branch"}`;

  return (
    <div className="mt-4 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {greeting()}, {sessionUser.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mine && team
              ? `Your logging and your team's overview for today and ${yesterdayWord}.`
              : mine
                ? `Your logging for today and ${yesterdayWord}.`
                : `Your team's logging for today and ${yesterdayWord}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nextHoliday && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand/15 ring-1 ring-brand/30 text-xs font-medium text-foreground">
              <PartyPopper className="h-3.5 w-3.5" />
              {nextHoliday.name} · {nextHoliday.daysUntil === 0 ? "today" : `in ${nextHoliday.daysUntil}d`}
            </span>
          )}
          {mine && (
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand text-foreground text-sm font-bold ring-1 ring-foreground/10 shadow-sm hover:brightness-105 transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Log tasks
            </Link>
          )}
        </div>
      </header>

      {mine && (
        <section aria-labelledby="my-activity" className="space-y-2.5">
          <h2 id="my-activity" className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            My activity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DayCard label={todayLabel} day={mine.today} isToday />
            <DayCard label={yesterdayLabel} day={mine.yesterday} />
          </div>
        </section>
      )}

      {team && (
        <TeamCard team={team} scope={scope} todayLabel={todayLabel} yesterdayLabel={yesterdayLabel} />
      )}
    </div>
  );
}
