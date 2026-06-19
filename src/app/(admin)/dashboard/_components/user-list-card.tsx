"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, ChevronRight, Clock } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import { Card } from "@/src/components/ui/card";
import type { DashboardUserRow, UnderTargetRow } from "../actions";
import { CardHead } from "./dashboard-ui";

// ─── Shared ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function fmtHrs(n: number) {
  const h = Math.floor(n), m = Math.round((n - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function TypeBadge({ type }: { type: string }) {
  return type === "F" ? (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand/15 ring-1 ring-brand/30 text-foreground">
      Full-time
    </span>
  ) : (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted ring-1 ring-border text-foreground/70">
      Trainee
    </span>
  );
}

function CountBadge({ count, tone }: { count: number; tone: "destructive" | "amber" }) {
  const active = count > 0;
  return (
    <span
      className={cn(
        "text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ring-1",
        !active && "bg-muted text-foreground/70 ring-border",
        active && tone === "destructive" && "bg-destructive/10 text-destructive ring-destructive/20",
        active && tone === "amber" && "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/25",
      )}
    >
      {count} {count === 1 ? "person" : "people"}
    </span>
  );
}

function PersonRow({ id, name, type, designation, branch, right }: {
  id: string;
  name: string;
  type: string;
  designation: string | null;
  branch: string | null;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 px-6 py-3.5 border-b border-border/60 last:border-b-0 hover:bg-muted/40 transition-colors">
      <Avatar className="h-10 w-10 shrink-0 ring-1 ring-foreground/10">
        <AvatarFallback className="bg-brand text-foreground text-xs font-bold">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">{name}</span>
          <TypeBadge type={type} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
          <span className="truncate">{designation}</span>
          <span className="opacity-40">·</span>
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{branch}</span>
        </div>
      </div>
      {right}
      <Link
        href={`/users/${id}/activity`}
        aria-label={`View ${name}'s activity`}
        className="h-8 w-8 rounded-lg shrink-0 grid place-items-center border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function FooterToggle({ expanded, total, onToggle }: { expanded: boolean; total: number; onToggle: () => void }) {
  const hidden = total - CAP;
  return (
    <button
      onClick={onToggle}
      className="w-full py-3.5 border-t border-border flex items-center justify-center gap-2 text-xs font-semibold text-foreground/70 hover:bg-muted/40 hover:text-foreground transition-colors"
    >
      {expanded ? "Show less" : hidden > 0 ? `View all ${total}` : "View all"}
      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded ? "-rotate-90" : "rotate-90")} />
    </button>
  );
}

const CAP = 4;

// ─── Not Logged Card ──────────────────────────────────────────────────────────

export function NotLoggedCard({ users, today }: { users: DashboardUserRow[]; today: string }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? users : users.slice(0, CAP);

  const dateLabel = new Date(today + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <Card className={cn("gap-0 py-0")}>
      <div className="pt-6">
        <CardHead
          icon={<AlertTriangle className="h-4 w-4 text-white" />}
          iconClassName="bg-destructive ring-destructive/30"
          title="Not logged today"
          description={`No entry for ${dateLabel}`}
          right={<CountBadge count={users.length} tone="destructive" />}
        />
      </div>
      <div>
        {users.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            Everyone has logged today
          </div>
        ) : (
          visible.map((u) => (
            <PersonRow key={u.id} id={u.id} name={u.name} type={u.type} designation={u.designation} branch={u.branch} />
          ))
        )}
      </div>
      {users.length > CAP && (
        <FooterToggle expanded={expanded} total={users.length} onToggle={() => setExpanded((v) => !v)} />
      )}
    </Card>
  );
}

// ─── Under Target Card ────────────────────────────────────────────────────────

function TargetBar({ logged, target }: { logged: number; target: number }) {
  const pct = Math.min(1, logged / target);
  return (
    <div className="flex items-center gap-2.5 justify-end">
      <div className="w-16 sm:w-20">
        <div className="h-2 rounded-full bg-muted ring-1 ring-border overflow-hidden">
          <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
      <span className="text-xs font-semibold text-foreground whitespace-nowrap tabular-nums">
        {fmtHrs(logged)}{" "}
        <span className="text-muted-foreground font-normal">/ {fmtHrs(target)}</span>
      </span>
    </div>
  );
}

export function UnderTargetCard({ rows }: { rows: UnderTargetRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, CAP);

  return (
    <Card className={cn("gap-0 py-0")}>
      <div className="pt-6">
        <CardHead
          icon={<Clock className="h-4 w-4 text-amber-950" />}
          iconClassName="bg-amber-400 ring-amber-500/40"
          title="Under target"
          description="Logged below scheduled hours"
          right={<CountBadge count={rows.length} tone="amber" />}
        />
      </div>
      <div>
        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            All users are on target
          </div>
        ) : (
          visible.map(({ user: u, hoursLogged, target }) => (
            <PersonRow
              key={u.id}
              id={u.id}
              name={u.name}
              type={u.type}
              designation={u.designation}
              branch={u.branch}
              right={
                <div className="shrink-0">
                  <TargetBar logged={hoursLogged} target={target} />
                </div>
              }
            />
          ))
        )}
      </div>
      {rows.length > CAP && (
        <FooterToggle expanded={expanded} total={rows.length} onToggle={() => setExpanded((v) => !v)} />
      )}
    </Card>
  );
}
