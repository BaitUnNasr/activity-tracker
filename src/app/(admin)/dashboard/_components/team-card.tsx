"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Search, Users, X } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import type { DaySummary, TeamMember } from "../data";
import { fmtHrs } from "./dashboard-ui";

const behind = (d: DaySummary | null) => d?.status === "partial" || d?.status === "missing";
const score = (m: TeamMember) => Number(behind(m.today)) + Number(behind(m.yesterday));
const initials = (name: string) =>
  name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

type Tab = "all" | "missing" | "partial" | "done";

// A member lands in the worst state across the two days shown.
const bucket = (m: TeamMember): Exclude<Tab, "all"> => {
  const s = [m.today?.status, m.yesterday?.status];
  return s.includes("missing") ? "missing" : s.includes("partial") ? "partial" : "done";
};

// Today / yesterday cell on a team row: dot + hours vs target (or why none is expected).
function DayChip({ label, day }: { label: string; day: DaySummary | null }) {
  const off =
    !day ? "—"
    : day.status === "holiday" ? "Holiday"
    : day.status === "off" ? "Day off"
    : day.status === "leave" ? "On leave"
    : null;
  const dot =
    day?.status === "complete" ? "bg-emerald-500"
    : day?.status === "partial" ? "bg-amber-500"
    : day?.status === "missing" ? "bg-destructive"
    : "bg-muted-foreground/40";

  return (
    <div className="w-[7.5rem] min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1.5 mt-0.5 text-xs tabular-nums whitespace-nowrap">
        <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
        {off ? (
          <span className="text-muted-foreground">{off}</span>
        ) : (
          <>
            <b className="font-semibold text-foreground">{fmtHrs(day!.logged)}</b>
            <span className="text-muted-foreground">/ {fmtHrs(day!.target)}</span>
          </>
        )}
      </div>
    </div>
  );
}

// "Today: 8 done · 2 partial · 1 not logged" pill for one day across the team.
function CountsPill({ label, days }: { label: string; days: (DaySummary | null)[] }) {
  const n = (s: DaySummary["status"]) => days.filter((d) => d?.status === s).length;
  const parts = [
    { count: n("complete"), text: "done", dot: "bg-emerald-500", cls: "text-emerald-700 dark:text-emerald-400" },
    { count: n("partial"), text: "partial", dot: "bg-amber-500", cls: "text-amber-700 dark:text-amber-400" },
    { count: n("missing"), text: "not logged", dot: "bg-destructive", cls: "text-destructive" },
    { count: n("leave"), text: "on leave", dot: "bg-muted-foreground/40", cls: "text-muted-foreground" },
  ].filter((p) => p.count > 0);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      {parts.length === 0 ? (
        <span className="text-muted-foreground">nothing expected</span>
      ) : (
        parts.map((p) => (
          <span key={p.text} className={cn("inline-flex items-center gap-1 font-semibold", p.cls)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />
            {p.count} {p.text}
          </span>
        ))
      )}
    </span>
  );
}

function TeamRow({ m, todayLabel, yesterdayLabel }: { m: TeamMember; todayLabel: string; yesterdayLabel: string }) {
  const u = m.user;
  return (
    <Link
      href={`/users/${u.id}/activity`}
      aria-label={`View ${u.name}'s activity`}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 border-b border-border/60 last:border-b-0 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:bg-muted/60"
    >
      <div className="flex items-center gap-3 flex-1 min-w-[14rem]">
        <Avatar className="h-9 w-9 shrink-0 ring-1 ring-foreground/10">
          <AvatarFallback className="bg-brand text-foreground text-xs font-bold">{initials(u.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{u.name}</span>
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 shrink-0",
                u.type === "F"
                  ? "bg-brand/15 ring-brand/30 text-foreground"
                  : "bg-muted ring-border text-foreground/70",
              )}
            >
              {u.type === "F" ? "Full-time" : "Trainee"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {u.designation} · {u.branch}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 pl-12 sm:pl-0">
        <DayChip label={todayLabel} day={m.today} />
        <DayChip label={yesterdayLabel} day={m.yesterday} />
      </div>
      <ChevronRight aria-hidden className="hidden sm:block h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
    </Link>
  );
}

export function TeamCard({
  team, scope, todayLabel, yesterdayLabel,
}: {
  team: TeamMember[];
  scope: string;
  todayLabel: string;
  yesterdayLabel: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const rows = team
    .filter((m) => tab === "all" || bucket(m) === tab)
    .filter((m) => !q || m.user.name.toLowerCase().includes(q) || (m.user.designation ?? "").toLowerCase().includes(q))
    .sort((a, b) => score(b) - score(a)); // stable: attention first, then by name

  const count = (t: Tab) => team.filter((m) => t === "all" || bucket(m) === t).length;
  const tabs: [Tab, string][] = [
    ["all", "All"],
    ["missing", "Not Logged"],
    ["partial", "Partial"],
    ["done", "Done"],
  ];

  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-9 w-9 shrink-0 rounded-xl bg-brand/20 ring-1 ring-brand/30 grid place-items-center">
            <Users className="h-4 w-4 text-foreground" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">My team</h2>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground ring-1 ring-border">
                {team.length} {team.length === 1 ? "member" : "members"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">Timesheet submission status {scope}</p>
          </div>
        </div>
        <Link
          href="/backlog"
          className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors"
        >
          View Backlog <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pb-3">
        <CountsPill label={todayLabel} days={team.map((m) => m.today)} />
        <CountsPill label={yesterdayLabel} days={team.map((m) => m.yesterday)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
        <div className="inline-flex rounded-lg bg-muted p-0.5">
          {tabs.map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-semibold transition-colors",
                tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {text} ({count(key)})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 w-full sm:w-64">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by member name or role…"
            className="flex-1 min-w-0 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" aria-label="Clear filter" onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-border max-h-[560px] overflow-y-auto [scrollbar-width:thin]">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            {team.length === 0
              ? "No one reports to you yet."
              : q ? "No matches. Try a different filter."
              : "No one here."}
          </p>
        ) : (
          rows.map((m) => (
            <TeamRow key={m.user.id} m={m} todayLabel={todayLabel} yesterdayLabel={yesterdayLabel} />
          ))
        )}
      </div>
    </section>
  );
}
