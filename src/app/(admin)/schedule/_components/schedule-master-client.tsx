"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  GraduationCap,
  Lock,
  Minus,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";

import { cn, getErrorMessage } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Calendar } from "@/src/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
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
import {
  createSchedule,
  deleteSchedule,
  updateSchedule,
  type ScheduleRow,
} from "../actions";

// ─── Status helpers ────────────────────────────────────────────────────────────

type Status = "active" | "upcoming" | "past";

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function statusOf(s: ScheduleRow, today: string): Status {
  if (today < s.startDate) return "upcoming";
  if (today > s.endDate) return "past";
  return "active";
}

const STATUS_META: Record<Status, { label: string; dotClass: string; chipClass: string }> = {
  active:   { label: "Active",   dotClass: "bg-brand",              chipClass: "bg-brand/10 border-brand/30 text-foreground" },
  upcoming: { label: "Upcoming", dotClass: "bg-indigo-400",         chipClass: "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400" },
  past:     { label: "Past",     dotClass: "bg-muted-foreground/50", chipClass: "bg-muted border-border text-muted-foreground" },
};

// ─── Date / hour helpers ───────────────────────────────────────────────────────

function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDateRange(start: string, end: string): string {
  const a = parseDateLocal(start), b = parseDateLocal(end);
  const sameYear = a.getFullYear() === b.getFullYear();
  const aStr = a.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const bStr = b.toLocaleDateString("en-US", {
    month: "short", day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${aStr} – ${bStr}${sameYear ? `, ${a.getFullYear()}` : ""}`;
}

function fmtHours(n: number): string {
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function addDays(dateStr: string, n: number): string {
  const d = parseDateLocal(dateStr);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function countDays(start: string, end: string): number {
  return Math.round((parseDateLocal(end).getTime() - parseDateLocal(start).getTime()) / 86400000) + 1;
}


function findOverlap(
  schedules: ScheduleRow[],
  start: string,
  end: string,
  excludeId?: number,
): ScheduleRow | null {
  if (!start || !end || end < start) return null;
  return (
    schedules.find((s) => s.id !== excludeId && start <= s.endDate && end >= s.startDate) ?? null
  );
}

// ─── Role metadata ─────────────────────────────────────────────────────────────

const ROLE_META = {
  fulltimeHours: {
    label: "Full time",
    icon: User,
    cardBorder: "border-brand/25",
    iconBg: "bg-brand/10 border-brand/20 text-foreground",
    valueBg: "bg-brand/10 border-brand/20",
    valueFg: "text-foreground",
    labelFg: "text-foreground/70",
  },
  traineeHours: {
    label: "Trainee",
    icon: GraduationCap,
    cardBorder: "border-indigo-500/25",
    iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400",
    valueBg: "bg-indigo-500/10 border-indigo-500/20",
    valueFg: "text-indigo-700 dark:text-indigo-300",
    labelFg: "text-indigo-600/70 dark:text-indigo-400/70",
  },
} as const;

type RoleKey = keyof typeof ROLE_META;

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
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduleRow | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => { setSchedules(initialSchedules); }, [initialSchedules]);

  const selectedSchedule = schedules.find((s) => s.id === selectedId) ?? null;
  const isActive = selectedSchedule ? statusOf(selectedSchedule, today) === "active" : false;

  const visibleSchedules = schedules
    .filter((s) => statusOf(s, today) !== "past")
    .filter((s) => !query.trim() || s.name.toLowerCase().includes(query.trim().toLowerCase()));

  const handleAddSchedule = () => {
    setShowAdd(false);
    toast.success("Schedule created.");
    router.refresh();
  };

  const handleUpdateField = (patch: Partial<Omit<ScheduleRow, "id">>) => {
    if (!selectedId) return;
    setSchedules((prev) => prev.map((s) => s.id === selectedId ? { ...s, ...patch } : s));
    startTransition(async () => {
      const result = await updateSchedule(selectedId, patch);
      if (!result.success) {
        toast.error(result.message ?? "Failed to update");
        router.refresh();
      }
    });
  };

  const handleUpdateHours = (role: RoleKey, value: number) => {
    if (!selectedId || isActive) return;
    handleUpdateField({ [role]: value });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    setRemovingId(id);
    const next = schedules.filter((s) => s.id !== id);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
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

  const activeCount = schedules.filter((s) => statusOf(s, today) === "active").length;

  return (
    <>
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
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

      {/* Main grid */}
      <div className={cn(
        "mt-6 grid grid-cols-1 gap-5 items-start",
        selectedSchedule && "lg:grid-cols-[340px_minmax(0,1fr)]",
      )}>
        {/* Left: schedule list */}
        <Card className="gap-0">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              All schedules
              <Badge variant="outline">{visibleSchedules.length}</Badge>
            </CardTitle>
            <CardDescription>Current and upcoming only.</CardDescription>
          </CardHeader>

          <CardContent className="px-3 pt-3 pb-3">
            {/* Search */}
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
            allSchedules={schedules}
            today={today}
            isActive={isActive}
            onUpdateField={handleUpdateField}
            onUpdateHours={handleUpdateHours}
            onRequestDelete={() => setPendingDelete(selectedSchedule)}
          />
        )}
      </div>

      {showAdd && (
        <AddScheduleModal
          existingSchedules={schedules}
          onClose={() => setShowAdd(false)}
          onAdd={async (input) => {
            const result = await createSchedule(input);
            if (result.success) {
              handleAddSchedule();
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

// ─── Role mini (in list card) ─────────────────────────────────────────────────

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

  // Gap from today when no active schedule covers today
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
  allSchedules,
  today,
  isActive,
  onUpdateField,
  onUpdateHours,
  onRequestDelete,
}: {
  schedule: ScheduleRow;
  allSchedules: ScheduleRow[];
  today: string;
  isActive: boolean;
  onUpdateField: (patch: Partial<Omit<ScheduleRow, "id">>) => void;
  onUpdateHours: (role: RoleKey, value: number) => void;
  onRequestDelete: () => void;
}) {
  const status = statusOf(schedule, today);
  const sm = STATUS_META[status];
  const days = Math.round(
    (parseDateLocal(schedule.endDate).getTime() - parseDateLocal(schedule.startDate).getTime()) / 86400000,
  ) + 1;
  const weeks = (days / 7).toFixed(1);

  const [nameDraft, setNameDraft] = useState(schedule.name);
  const [dateError, setDateError] = useState<string | null>(null);
  useEffect(() => { setNameDraft(schedule.name); }, [schedule.name]);
  useEffect(() => { setDateError(null); }, [schedule.id]);

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== schedule.name) onUpdateField({ name: trimmed });
    else setNameDraft(schedule.name);
  };

  const handleDateChange = (field: "startDate" | "endDate", value: string) => {
    const newStart = field === "startDate" ? value : schedule.startDate;
    const newEnd   = field === "endDate"   ? value : schedule.endDate;
    const conflict = findOverlap(allSchedules, newStart, newEnd, schedule.id);
    if (conflict) {
      setDateError(`Overlaps with "${conflict.name}" (${fmtDateRange(conflict.startDate, conflict.endDate)})`);
      return;
    }
    setDateError(null);
    onUpdateField({ [field]: value });
  };

  return (
    <Card className="gap-0">
      {/* Header */}
      <CardHeader className="border-b border-dashed border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold",
              sm.chipClass,
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", sm.dotClass)} />
              {sm.label}
            </span>
            <span className="text-xs text-muted-foreground">{days} days · {weeks} weeks</span>
            {isActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10.5px] font-semibold">
                <Lock className="h-2.5 w-2.5" />
                Hours locked
              </span>
            )}
          </div>
          {/* Editable name */}
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setNameDraft(schedule.name); }}
            className="w-full bg-transparent border-none outline-none text-2xl font-bold tracking-tight text-foreground placeholder:text-muted-foreground"
          />
          {/* Date range */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <DateChip
              label="Start"
              value={schedule.startDate}
              onChange={(v) => handleDateChange("startDate", v)}
            />
            <span className="text-muted-foreground text-sm">→</span>
            <DateChip
              label="End"
              value={schedule.endDate}
              onChange={(v) => handleDateChange("endDate", v)}
              minDate={schedule.startDate}
            />
          </div>
          {dateError && (
            <p className="mt-2 text-xs text-destructive">{dateError}</p>
          )}
        </div>
        <CardAction>
          <Button
            variant="ghost"
            onClick={onRequestDelete}
            className="rounded-full gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border h-auto py-1.5 px-3"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-5 pb-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-foreground">Working hours</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Applies every working day (Mon–Fri) in the date range.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RoleCard
            role="fulltimeHours"
            schedule={schedule}
            isActive={isActive}
            onChange={(v) => onUpdateHours("fulltimeHours", v)}
          />
          <RoleCard
            role="traineeHours"
            schedule={schedule}
            isActive={isActive}
            onChange={(v) => onUpdateHours("traineeHours", v)}
          />
        </div>

      </CardContent>
    </Card>
  );
}

// ─── Date picker helpers ──────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDisplayDate(value: string): string {
  return parseDateLocal(value).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// Compact chip — used in the editor header
function DateChip({
  label,
  value,
  onChange,
  minDate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseDateLocal(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted border border-border hover:border-foreground/20 transition-colors">
          <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">{label}</span>
          <span className="text-xs font-medium text-foreground">{value ? fmtDisplayDate(value) : "Pick date"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => { if (d) { onChange(toDateStr(d)); setOpen(false); } }}
          disabled={minDate ? { before: parseDateLocal(minDate) } : undefined}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// Full-width picker — used in modals
function DatePickerInput({
  value,
  onChange,
  minDate,
  placeholder = "Pick a date",
}: {
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseDateLocal(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border text-sm transition-colors",
          "hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
          !value && "text-muted-foreground",
        )}>
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className={cn("flex-1 text-left", value ? "text-foreground font-medium" : "text-muted-foreground")}>
            {value ? fmtDisplayDate(value) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => { if (d) { onChange(toDateStr(d)); setOpen(false); } }}
          disabled={minDate ? { before: parseDateLocal(minDate) } : undefined}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Role card ────────────────────────────────────────────────────────────────

function RoleCard({
  role,
  schedule,
  isActive,
  onChange,
}: {
  role: RoleKey;
  schedule: ScheduleRow;
  isActive: boolean;
  onChange: (v: number) => void;
}) {
  const m = ROLE_META[role];
  const Ico = m.icon;
  const hours = schedule[role];

  const step = (delta: number) => {
    const next = Math.round((hours + delta) * 2) / 2;
    if (next >= 0.5 && next <= 24) onChange(next);
  };

  return (
    <div className={cn("rounded-2xl border-[1.5px] p-5", m.cardBorder)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("h-9 w-9 rounded-xl border grid place-items-center shrink-0", m.iconBg)}>
          <Ico className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{m.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Daily working hours</p>
        </div>
      </div>

      {/* Hours display + steppers */}
      <div className="flex items-center gap-2.5">
        <StepperBtn onClick={() => step(-0.5)} disabled={isActive || hours <= 0.5}>
          <Minus className="h-4 w-4" />
        </StepperBtn>

        <div className={cn(
          "flex-1 rounded-2xl border px-4 py-3 flex items-baseline justify-center gap-2",
          m.valueBg,
          isActive && "opacity-70",
        )}>
          <span className={cn("text-4xl font-extrabold tracking-tight tabular-nums", m.valueFg)}>
            {hours % 1 === 0 ? hours.toString() : hours.toFixed(1)}
          </span>
          <div className="flex flex-col">
            <span className={cn("text-xs font-semibold", m.valueFg)}>hours</span>
            <span className={cn("text-[10px] opacity-70 mt-0.5", m.valueFg)}>per day</span>
          </div>
        </div>

        <StepperBtn onClick={() => step(0.5)} disabled={isActive || hours >= 24}>
          <Plus className="h-4 w-4" />
        </StepperBtn>
      </div>

      {isActive && (
        <p className="flex items-center gap-1.5 mt-3 text-[11px] text-amber-600 dark:text-amber-400">
          <Lock className="h-3 w-3 shrink-0" />
          Active schedule — hours cannot be changed
        </p>
      )}
    </div>
  );
}

function StepperBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-9 w-9 rounded-full border border-border shrink-0 p-0",
        disabled && "opacity-35 cursor-not-allowed",
      )}
    >
      {children}
    </Button>
  );
}


// ─── Modal shell ──────────────────────────────────────────────────────────────

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl w-full max-w-sm shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Add Schedule Modal ───────────────────────────────────────────────────────

function AddScheduleModal({
  existingSchedules,
  onClose,
  onAdd,
}: {
  existingSchedules: ScheduleRow[];
  onClose: () => void;
  onAdd: (input: Omit<ScheduleRow, "id">) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fulltimeHours, setFulltimeHours] = useState(8);
  const [traineeHours, setTraineeHours] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const overlapSchedule = findOverlap(existingSchedules, startDate, endDate);
  const valid = name.trim() && startDate && endDate && endDate >= startDate && !overlapSchedule;

  const stepHours = (current: number, delta: number, set: (v: number) => void) => {
    const next = Math.round((current + delta) * 2) / 2;
    if (next >= 0.5 && next <= 24) set(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        await onAdd({ name: name.trim(), startDate, endDate, fulltimeHours, traineeHours });
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div>
            <p className="text-[10px] font-semibold text-brand tracking-widest uppercase">New schedule</p>
            <h3 className="text-xl font-bold tracking-tight mt-1 text-foreground">Create a schedule</h3>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="rounded-full text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <label className="block">
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">Schedule name</span>
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Hours"
              className="rounded-xl bg-muted border-border focus-visible:ring-brand/30 focus-visible:border-brand/40"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">Start date</span>
              <DatePickerInput
                value={startDate}
                onChange={setStartDate}
                placeholder="Start date"
              />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">End date</span>
              <DatePickerInput
                value={endDate}
                onChange={setEndDate}
                minDate={startDate || undefined}
                placeholder="End date"
              />
            </div>
          </div>
          {overlapSchedule && (
            <p className="text-xs text-destructive">
              Overlaps with &ldquo;{overlapSchedule.name}&rdquo; ({fmtDateRange(overlapSchedule.startDate, overlapSchedule.endDate)})
            </p>
          )}

          {/* Working hours */}
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-2.5">Working hours / day</span>
            <div className="flex flex-col gap-2">
              {(["fulltimeHours", "traineeHours"] as const).map((role) => {
                const m = ROLE_META[role];
                const Ico = m.icon;
                const hours = role === "fulltimeHours" ? fulltimeHours : traineeHours;
                const setHours = role === "fulltimeHours" ? setFulltimeHours : setTraineeHours;
                return (
                  <div key={role} className={cn("flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5", m.cardBorder)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("h-7 w-7 rounded-lg border grid place-items-center shrink-0", m.iconBg)}>
                        <Ico className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{m.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => stepHours(hours, -0.5, setHours)}
                        disabled={hours <= 0.5}
                        className="rounded-full border border-border h-7 w-7 disabled:opacity-35"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold tabular-nums w-12 text-center text-foreground">
                        {fmtHours(hours)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => stepHours(hours, 0.5, setHours)}
                        disabled={hours >= 24}
                        className="rounded-full border border-border h-7 w-7 disabled:opacity-35"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-full">Cancel</Button>
          <Button
            type="submit"
            disabled={!valid || isPending}
            className="rounded-full bg-brand text-gray-900 hover:bg-brand hover:brightness-105 gap-2 h-auto py-2 px-5"
          >
            <Check className="h-3.5 w-3.5" />
            {isPending ? "Creating…" : "Create schedule"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalShell onClose={onCancel}>
      <div className="px-6 pt-6 pb-4">
        <div className="h-10 w-10 rounded-full bg-destructive/10 border border-destructive/20 grid place-items-center mb-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Delete schedule?</h3>
        <p className="text-sm text-muted-foreground mt-1.5">
          <span className="font-medium text-foreground">"{name}"</span> will be permanently deleted.
        </p>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
        <Button variant="outline" onClick={onCancel} className="rounded-full">Cancel</Button>
        <Button onClick={onConfirm} className="rounded-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90">
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </ModalShell>
  );
}
