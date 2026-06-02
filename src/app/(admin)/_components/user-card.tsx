import { cn } from "@/src/lib/utils";
import { MapPin, ShieldCheck } from "lucide-react";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type HistoryEntry = {
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
};

export type TagType = "start" | "move" | "up" | "down";

// ─── Shared constants ─────────────────────────────────────────────────────────

export const DESIGNATION_RANK: Record<string, number> = {
  Admin: 0, Chairman: 1, Management: 2, Supervisor: 3, General: 4,
};

export const TAG_META: Record<TagType, { label: string; className: string }> = {
  start: { label: "Joined",   className: "bg-muted border border-border text-foreground/70" },
  move:  { label: "Transfer", className: "bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400" },
  up:    { label: "Promoted", className: "bg-brand/15 border border-brand/25 text-foreground" },
  down:  { label: "Demotion", className: "bg-destructive/10 border border-destructive/20 text-destructive" },
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function fmtMonthYear(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ─── DetailRow ────────────────────────────────────────────────────────────────

export function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-muted grid place-items-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}

// ─── HistorySection ───────────────────────────────────────────────────────────

export function HistorySection({
  branchHistory,
  designationHistory,
  branchAction,
  designationAction,
}: {
  branchHistory: HistoryEntry[];
  designationHistory: HistoryEntry[];
  branchAction?: React.ReactNode;
  designationAction?: React.ReactNode;
}) {
  const hasHistory = branchHistory.length > 0 || designationHistory.length > 0;
  if (!hasHistory && !branchAction && !designationAction) return null;

  return (
    <div className="w-full mt-4 pt-5 border-t border-dashed border-border text-left px-5 pb-2">
      <h3 className="text-sm font-bold text-foreground">Branch &amp; Designation History</h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-1">Transfers and role changes are tracked separately.</p>

      <HistoryTrack
        label="Branch Transfers"
        icon={<MapPin className="h-3.5 w-3.5" />}
        entries={branchHistory}
        entrySubtitle="Branch posting"
        tagFor={(i, total) => i === total - 1 ? "start" : "move"}
        action={branchAction}
      />

      <HistoryTrack
        label="Designation Changes"
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        entries={designationHistory}
        entrySubtitle="Designation"
        tagFor={(i, total, entries) => {
          if (i === total - 1) return "start";
          const cur  = DESIGNATION_RANK[entries[i].name]  ?? 99;
          const prev = DESIGNATION_RANK[entries[i + 1].name] ?? 99;
          return cur < prev ? "up" : cur > prev ? "down" : "move";
        }}
        action={designationAction}
      />
    </div>
  );
}

// ─── HistoryTrack ─────────────────────────────────────────────────────────────

export function HistoryTrack({
  label,
  icon,
  entries,
  entrySubtitle,
  tagFor,
  action,
}: {
  label: string;
  icon: React.ReactNode;
  entries: HistoryEntry[];
  entrySubtitle: string;
  tagFor: (i: number, total: number, entries: HistoryEntry[]) => TagType;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-3.5">
        <div className="h-6 w-6 rounded-lg bg-brand grid place-items-center text-foreground shrink-0 ring-1 ring-foreground/10 shadow-sm">
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>

      <div className="relative pl-6">
        <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-border rounded-full" />

        {entries.map((entry, i) => {
          const isCurrent = !entry.endDate;
          const tm = TAG_META[tagFor(i, entries.length, entries)];

          return (
            <div key={i} className="relative pb-4 last:pb-0">
              <span className={cn(
                "absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 shrink-0",
                isCurrent
                  ? "bg-brand border-brand shadow-[0_0_0_3px_rgba(196,245,66,0.2)]"
                  : "bg-background border-border",
              )} />

              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-muted-foreground">{fmtMonthYear(entry.startDate)}</span>
                <span className="text-[11px] text-muted-foreground">→</span>
                {isCurrent ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand/15 text-foreground">Now</span>
                ) : (
                  <span className="text-[11px] font-semibold text-muted-foreground">{fmtMonthYear(entry.endDate!)}</span>
                )}
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate leading-tight">{entry.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{entrySubtitle}</p>
                </div>
                <span className={cn(
                  "shrink-0 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full",
                  tm.className,
                )}>
                  {tm.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
