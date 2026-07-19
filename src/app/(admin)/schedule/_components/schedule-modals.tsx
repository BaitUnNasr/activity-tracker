"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Infinity as InfinityIcon,
  Lock,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { cn, getErrorMessage } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Calendar } from "@/src/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import type { ScheduleRow } from "../actions";
import {
  ROLE_META,
  findOverlap,
  fmtDateRange,
  fmtDisplayDate,
  fmtHours,
  getToday,
  parseDateLocal,
  statusOf,
  toDateStr,
} from "./schedule-utils";

// ─── Modal shell ──────────────────────────────────────────────────────────────

export function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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

// ─── Date picker input ────────────────────────────────────────────────────────

export function DatePickerInput({
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

// ─── End-date field with "ongoing" toggle ────────────────────────────────────

function EndDateField({
  ongoing,
  onOngoingChange,
  endDate,
  onEndDateChange,
  minDate,
}: {
  ongoing: boolean;
  onOngoingChange: (v: boolean) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;
  minDate?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">End date</span>
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={ongoing}
            onChange={(e) => onOngoingChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-brand"
          />
          <span className="text-[11px] font-medium text-muted-foreground">No end date</span>
        </label>
      </div>
      {ongoing ? (
        <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-dashed border-border text-sm text-muted-foreground">
          <InfinityIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Ongoing</span>
        </div>
      ) : (
        <DatePickerInput value={endDate} onChange={onEndDateChange} minDate={minDate} placeholder="End date" />
      )}
    </div>
  );
}

// ─── Shared hours stepper row (used inside Add & Edit modals) ─────────────────

function HoursStepperRow({
  role,
  hours,
  disabled,
  onStep,
}: {
  role: keyof typeof ROLE_META;
  hours: number;
  disabled: boolean;
  onStep: (delta: number) => void;
}) {
  const m = ROLE_META[role];
  const Ico = m.icon;
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5", m.cardBorder, disabled && "opacity-60")}>
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
          onClick={() => onStep(-0.5)}
          disabled={disabled || hours <= 0.5}
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
          onClick={() => onStep(0.5)}
          disabled={disabled || hours >= 24}
          className="rounded-full border border-border h-7 w-7 disabled:opacity-35"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Add Schedule Modal ───────────────────────────────────────────────────────

export function AddScheduleModal({
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
  const [ongoing, setOngoing] = useState(false);
  const [fulltimeHours, setFulltimeHours] = useState(8);
  const [traineeHours, setTraineeHours] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const today = getToday();
  // End date must be today or later, and on/after the start date.
  const endMin = startDate && startDate > today ? startDate : today;
  const effEnd = ongoing ? null : endDate;

  const overlapSchedule = findOverlap(existingSchedules, startDate, effEnd);
  const valid =
    name.trim() && startDate &&
    (ongoing || (endDate && endDate >= startDate)) &&
    !overlapSchedule;

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
        await onAdd({ name: name.trim(), startDate, endDate: effEnd, fulltimeHours, traineeHours });
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
              <DatePickerInput value={startDate} onChange={setStartDate} placeholder="Start date" />
            </div>
            <EndDateField
              ongoing={ongoing}
              onOngoingChange={setOngoing}
              endDate={endDate}
              onEndDateChange={setEndDate}
              minDate={endMin}
            />
          </div>
          {overlapSchedule && (
            <p className="text-xs text-destructive">
              Overlaps with &ldquo;{overlapSchedule.name}&rdquo; ({fmtDateRange(overlapSchedule.startDate, overlapSchedule.endDate)}). Give the ongoing schedule an end date before adding a later one.
            </p>
          )}

          <div>
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-2.5">Working hours / day</span>
            <div className="flex flex-col gap-2">
              <HoursStepperRow role="fulltimeHours" hours={fulltimeHours} disabled={false} onStep={(d) => stepHours(fulltimeHours, d, setFulltimeHours)} />
              <HoursStepperRow role="traineeHours"  hours={traineeHours}  disabled={false} onStep={(d) => stepHours(traineeHours,  d, setTraineeHours)} />
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

// ─── Edit Schedule Modal ──────────────────────────────────────────────────────

export function EditScheduleModal({
  schedule,
  existingSchedules,
  isActive,
  today,
  onClose,
  onSave,
}: {
  schedule: ScheduleRow;
  existingSchedules: ScheduleRow[];
  isActive: boolean;
  today: string;
  onClose: () => void;
  onSave: (patch: Partial<Omit<ScheduleRow, "id">>) => Promise<{ success: boolean; message?: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(schedule.name);
  const [startDate, setStartDate] = useState(schedule.startDate);
  const [endDate, setEndDate] = useState(schedule.endDate ?? "");
  const [ongoing, setOngoing] = useState(schedule.endDate === null);
  const [fulltimeHours, setFulltimeHours] = useState(schedule.fulltimeHours);
  const [traineeHours, setTraineeHours] = useState(schedule.traineeHours);
  const [error, setError] = useState<string | null>(null);

  const effEnd = ongoing ? null : endDate;
  // Past schedules keep their historical end; anything still covering today or
  // upcoming must end today or later.
  const isPast = statusOf(schedule, today) === "past";
  const endMin = isPast
    ? (startDate || undefined)
    : startDate && startDate > today ? startDate : today;

  const overlapSchedule = findOverlap(existingSchedules, startDate, effEnd, schedule.id);
  const valid =
    name.trim() && startDate &&
    (ongoing || (endDate && endDate >= startDate)) &&
    !overlapSchedule;

  const stepHours = (current: number, delta: number, set: (v: number) => void) => {
    const next = Math.round((current + delta) * 2) / 2;
    if (next >= 0.5 && next <= 24) set(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await onSave({ name: name.trim(), startDate, endDate: effEnd, fulltimeHours, traineeHours });
      if (result.success) {
        toast.success("Schedule updated.");
        onClose();
      } else {
        setError(result.message ?? "Failed to update schedule");
      }
    });
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div>
            <p className="text-[10px] font-semibold text-brand tracking-widest uppercase">
              {isActive ? "Active schedule" : "Upcoming schedule"}
            </p>
            <h3 className="text-xl font-bold tracking-tight mt-1 text-foreground">Edit schedule</h3>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="rounded-full text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <label className="block">
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">Schedule name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Hours"
              className="rounded-xl bg-muted border-border focus-visible:ring-brand/30 focus-visible:border-brand/40"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">Start date</span>
              <DatePickerInput value={startDate} onChange={setStartDate} placeholder="Start date" />
            </div>
            <EndDateField
              ongoing={ongoing}
              onOngoingChange={setOngoing}
              endDate={endDate}
              onEndDateChange={setEndDate}
              minDate={endMin}
            />
          </div>
          {overlapSchedule && (
            <p className="text-xs text-destructive">
              Overlaps with &ldquo;{overlapSchedule.name}&rdquo; ({fmtDateRange(overlapSchedule.startDate, overlapSchedule.endDate)}). Give the ongoing schedule an end date first.
            </p>
          )}

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">Working hours / day</span>
              {isActive && (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-600 dark:text-amber-400">
                  <Lock className="h-3 w-3" />
                  Locked for active schedule
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <HoursStepperRow role="fulltimeHours" hours={fulltimeHours} disabled={isActive} onStep={(d) => stepHours(fulltimeHours, d, setFulltimeHours)} />
              <HoursStepperRow role="traineeHours"  hours={traineeHours}  disabled={isActive} onStep={(d) => stepHours(traineeHours,  d, setTraineeHours)} />
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
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

export function DeleteConfirmModal({
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
          <span className="font-medium text-foreground">&ldquo;{name}&rdquo;</span> will be permanently deleted.
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
