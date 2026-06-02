"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/src/components/ui/empty";
import { HeaderGlow, IconChip } from "@/src/components/page-ui";
import {
  createSchedule,
  deleteSchedule,
  updateSchedule,
  type ScheduleRow,
  type CreateResult,
} from "../actions";
import {
  addDays,
  countDays,
  countWorkingDays,
  fmtDateRange,
  fmtDisplayDate,
  fmtHours,
  getToday,
  ROLE_META,
  STATUS_META,
  statusOf,
} from "./schedule-utils";
import { AddScheduleModal, EditScheduleModal, DeleteConfirmModal } from "./schedule-modals";

// ─── Main client ──────────────────────────────────────────────────────────────

export function ScheduleMasterClient({ initialSchedules }: { initialSchedules: ScheduleRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const today = getToday();

  const [schedules, setSchedules] = useState<ScheduleRow[]>(initialSchedules);
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const active = initialSchedules.find((s) => statusOf(s, today) === "active");
    if (active) return active.id;
    const upcoming = initialSchedules.find((s) => statusOf(s, today) === "upcoming");
    return upcoming?.id ?? initialSchedules[0]?.id ?? null;
  });
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduleRow | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => { setSchedules(initialSchedules); }, [initialSchedules]);

  const selectedSchedule = schedules.find((s) => s.id === selectedId) ?? null;
  const selectedStatus = selectedSchedule ? statusOf(selectedSchedule, today) : null;
  const isActive = selectedStatus === "active";

  const visibleSchedules = schedules
    .filter((s) => statusOf(s, today) !== "past")
    .filter((s) => !query.trim() || s.name.toLowerCase().includes(query.trim().toLowerCase()));

  const activeCount = schedules.filter((s) => statusOf(s, today) === "active").length;

  const handleAddSchedule = (newId: number) => {
    setShowAdd(false);
    setSelectedId(newId);
    toast.success("Schedule created.");
    router.refresh();
  };

  const handleEdit = async (
    patch: Partial<Omit<ScheduleRow, "id">>,
  ): Promise<{ success: boolean; message?: string }> => {
    if (!selectedId) return { success: false, message: "No schedule selected" };
    setSchedules((prev) => prev.map((s) => s.id === selectedId ? { ...s, ...patch } : s));
    const result = await updateSchedule(selectedId, patch);
    router.refresh();
    return result;
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    setRemovingId(id);
    const next = schedules.filter((s) => s.id !== id);
    if (selectedId === id) {
      const nextNonPast = next.find((s) => statusOf(s, today) !== "past");
      setSelectedId(nextNonPast?.id ?? null);
    }
    setTimeout(() => {
      setSchedules(next);
      setRemovingId(null);
      startTransition(async () => {
        const result = await deleteSchedule(id);
        if (!result.success) {
          toast.error(result.message ?? "Failed to delete");
          router.refresh();
        } else {
          toast.success("Schedule deleted.");
        }
      });
    }, 220);
  };

  return (
    <>
      <div className="relative isolate flex flex-wrap items-end justify-between gap-4">
        <HeaderGlow />
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Schedule Master
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Set working hours for full-time staff and trainees across date ranges.
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 active:scale-[0.98] gap-2 h-auto py-2.5 px-5"
        >
          <Plus className="h-4 w-4" />
          Add schedule
        </Button>
      </div>

      <div className={cn(
        "mt-6 grid grid-cols-1 gap-5 items-start",
        selectedSchedule && "lg:grid-cols-[340px_minmax(0,1fr)]",
      )}>
        {/* Left: schedule list */}
        <Card className="gap-0">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <IconChip size="sm"><CalendarDays className="h-3.5 w-3.5 text-foreground" /></IconChip>
              All schedules
              <Badge variant="outline">{visibleSchedules.length}</Badge>
            </CardTitle>
            <CardDescription>Current and upcoming only.</CardDescription>
          </CardHeader>

          <CardContent className="px-3 pt-3 pb-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search schedules…"
                className="pl-8 rounded-xl bg-muted border-border text-sm h-8 focus-visible:ring-brand/30 focus-visible:border-brand/40"
              />
              {query && (
                <Button variant="ghost" size="icon-xs" onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {visibleSchedules.length === 0 ? (
              <Empty className="border-0 py-8">
                <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle className="text-sm">{query ? "No matches" : "No schedules yet"}</EmptyTitle>
                  <EmptyDescription>{query ? "Try a different search." : "Add your first schedule above."}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {buildDisplayItems(visibleSchedules, today, activeCount, query).map((item, idx) =>
                  item.kind === "gap" ? (
                    <GapIndicator key={`gap-${idx}`} start={item.start} end={item.end} />
                  ) : (
                    <li key={item.s.id}>
                      <button
                        onClick={() => setSelectedId(item.s.id)}
                        className={cn(
                          "w-full text-left rounded-2xl border-[1.5px] p-3.5 transition-all duration-150 cursor-pointer",
                          item.s.id === selectedId
                            ? "bg-brand/5 border-brand/40 shadow-[0_0_0_3px_rgba(var(--brand-rgb,196,245,66),0.15)]"
                            : "bg-card border-border hover:border-border/80",
                          removingId === item.s.id && "opacity-0 -translate-x-3",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-sm font-semibold text-foreground truncate">{item.s.name}</span>
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10.5px] font-semibold shrink-0",
                            STATUS_META[statusOf(item.s, today)].chipClass,
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_META[statusOf(item.s, today)].dotClass)} />
                            {STATUS_META[statusOf(item.s, today)].label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2.5">
                          {fmtDateRange(item.s.startDate, item.s.endDate)}
                        </p>
                        <div className="flex gap-4">
                          <RoleMini label="Full time" hours={item.s.fulltimeHours} dotClass="bg-brand" />
                          <div className="w-px bg-border" />
                          <RoleMini label="Trainee" hours={item.s.traineeHours} dotClass="bg-indigo-400" />
                        </div>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right: editor */}
        {selectedSchedule && (
          <ScheduleEditor
            schedule={selectedSchedule}
            today={today}
            isActive={isActive}
            onRequestEdit={() => setShowEdit(true)}
            onRequestDelete={() => setPendingDelete(selectedSchedule)}
          />
        )}
      </div>

      {showEdit && selectedSchedule && (
        <EditScheduleModal
          schedule={selectedSchedule}
          existingSchedules={schedules}
          isActive={isActive}
          today={today}
          onClose={() => setShowEdit(false)}
          onSave={handleEdit}
        />
      )}

      {showAdd && (
        <AddScheduleModal
          existingSchedules={schedules}
          onClose={() => setShowAdd(false)}
          onAdd={async (input) => {
            const result: CreateResult = await createSchedule(input);
            if (result.success) {
              handleAddSchedule(result.id);
            } else {
              toast.error(result.message ?? "Failed to create schedule");
            }
          }}
        />
      )}

      {pendingDelete && (
        <DeleteConfirmModal
          name={pendingDelete.name}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}

// ─── Gap detection ────────────────────────────────────────────────────────────

type DisplayItem =
  | { kind: "schedule"; s: ScheduleRow }
  | { kind: "gap"; start: string; end: string };

function buildDisplayItems(
  visible: ScheduleRow[],
  today: string,
  activeCount: number,
  query: string,
): DisplayItem[] {
  if (query.trim()) return visible.map((s) => ({ kind: "schedule", s }));

  const items: DisplayItem[] = [];

  if (visible.length > 0 && activeCount === 0) {
    const gapEnd = addDays(visible[0].startDate, -1);
    if (today <= gapEnd) items.push({ kind: "gap", start: today, end: gapEnd });
  }

  visible.forEach((s, i) => {
    items.push({ kind: "schedule", s });
    const next = visible[i + 1];
    if (next) {
      const gapStart = addDays(s.endDate, 1);
      const gapEnd   = addDays(next.startDate, -1);
      if (gapStart <= gapEnd) items.push({ kind: "gap", start: gapStart, end: gapEnd });
    }
  });

  return items;
}

function GapIndicator({ start, end }: { start: string; end: string }) {
  const days = countDays(start, end);
  return (
    <li className="px-0.5">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/8 border border-dashed border-amber-500/35 dark:border-amber-500/25">
        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 truncate">
          {days} uncovered {days === 1 ? "day" : "days"}
        </span>
        <span className="text-[11px] text-amber-600/60 dark:text-amber-400/60 ml-auto shrink-0 tabular-nums">
          {fmtDateRange(start, end)}
        </span>
      </div>
    </li>
  );
}

// ─── Schedule editor (right panel) ───────────────────────────────────────────

function ScheduleEditor({
  schedule,
  today,
  isActive,
  onRequestEdit,
  onRequestDelete,
}: {
  schedule: ScheduleRow;
  today: string;
  isActive: boolean;
  onRequestEdit: () => void;
  onRequestDelete: () => void;
}) {
  const sm = STATUS_META[statusOf(schedule, today)];
  const calDays = Math.round(
    (new Date(schedule.endDate).getTime() - new Date(schedule.startDate).getTime()) / 86400000,
  ) + 1;
  const workingDays = countWorkingDays(schedule.startDate, schedule.endDate);
  const weeks = (calDays / 7).toFixed(1);

  return (
    <Card className="gap-0">
      <CardHeader className="border-b border-dashed border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold",
              sm.chipClass,
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", sm.dotClass)} />
              {sm.label}
            </span>
            <span className="text-xs text-muted-foreground">{workingDays} working days · {weeks} weeks</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted border border-border text-[10.5px] font-medium text-muted-foreground">Mon – Sat</span>
            {isActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10.5px] font-semibold">
                <Lock className="h-2.5 w-2.5" />
                Hours locked
              </span>
            )}
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground">{schedule.name}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StaticDateChip label="Start" value={schedule.startDate} />
            <span className="text-muted-foreground text-sm">→</span>
            <StaticDateChip label="End" value={schedule.endDate} />
          </div>
        </div>
        <CardAction>
          <div className="flex items-center gap-1.5">
            <Button
              onClick={onRequestEdit}
              className="rounded-full gap-1.5 text-xs bg-brand text-foreground hover:bg-brand hover:brightness-105 h-auto py-1.5 px-3"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            {!isActive && (
              <Button
                variant="ghost"
                onClick={onRequestDelete}
                className="rounded-full gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border h-auto py-1.5 px-3"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            )}
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-5 pb-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-foreground">Working hours</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Applies every Mon–Sat in the date range.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RoleCard role="fulltimeHours" schedule={schedule} />
          <RoleCard role="traineeHours"  schedule={schedule} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Static date chip (display-only) ─────────────────────────────────────────

function StaticDateChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted border border-border">
      <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-foreground">{fmtDisplayDate(value)}</span>
    </div>
  );
}

// ─── Role card (display-only) ─────────────────────────────────────────────────

function RoleCard({ role, schedule }: { role: keyof typeof ROLE_META; schedule: ScheduleRow }) {
  const m = ROLE_META[role];
  const Ico = m.icon;
  const hours = schedule[role];

  return (
    <div className={cn("rounded-2xl border-[1.5px] p-5", m.cardBorder)}>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("h-9 w-9 rounded-xl border grid place-items-center shrink-0", m.iconBg)}>
          <Ico className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{m.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Daily working hours</p>
        </div>
      </div>
      <div className={cn("rounded-2xl border px-4 py-3 flex justify-center gap-2", m.valueBg)}>
        <span className={cn("text-4xl font-extrabold tabular-nums", m.valueFg)}>
          {hours % 1 === 0 ? hours.toString() : hours.toFixed(1)}
        </span>
        <div className="flex flex-col justify-center">
          <span className={cn("text-xs font-semibold", m.valueFg)}>hours</span>
          <span className={cn("text-[10px] opacity-70 mt-0.5", m.valueFg)}>per day</span>
        </div>
      </div>
    </div>
  );
}

// ─── Role mini (list card) ────────────────────────────────────────────────────

function RoleMini({ label, hours, dotClass }: { label: string; hours: number; dotClass: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotClass)} />
        {label}
      </div>
      <span className="text-xs font-semibold text-foreground">{fmtHours(hours)} / day</span>
    </div>
  );
}
