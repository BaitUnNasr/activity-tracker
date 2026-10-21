import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import { fmtHrs } from "./dashboard-ui";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
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

// An employee row linking to their activity page. `right` sits beside the
// details, or on its own line below them when `stacked` (name gets full width).
export function PersonRow({ id, name, type, designation, branch, right, stacked }: {
  id: string;
  name: string;
  type: string;
  designation: string | null;
  branch: string | null;
  right?: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <Link
      href={`/users/${id}/activity`}
      aria-label={`View ${name}'s activity`}
      className="flex items-center gap-3.5 px-6 py-3.5 border-b border-border/60 last:border-b-0 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:bg-muted/60"
    >
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
        {stacked && <div className="mt-2">{right}</div>}
      </div>
      {!stacked && right}
      <span aria-hidden className="h-8 w-8 rounded-lg shrink-0 grid place-items-center border border-border bg-background text-muted-foreground">
        <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export function TargetBar({ logged, target, className }: { logged: number; target: number; className?: string }) {
  const pct = Math.min(1, logged / target);
  return (
    <div className={cn("flex items-center gap-2.5 justify-end", className)}>
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
