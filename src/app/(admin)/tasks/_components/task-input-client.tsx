"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  Loader2,
  Minus,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Calendar } from "@/src/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { HeaderGlow } from "@/src/components/page-ui";
import { applyEarnedLeave, revokeLeaveDate, saveDay, type CategoryForPicker, type TaskForPicker, type TasksPageData } from "../actions";
import type { LeaveType } from "../leave";
import {
  CalendarCard,
  DayBadge,
  LeaveActiveCard,
  LockedNotice,
  ReadOnlyTaskGroups,
  ShareBar,
  SharePercent,
  buildHolidayMap,
  buildServerMap,
  fmtHrs,
  fmtLong,
  getDayStatus,
  ceilingMinutes,
  clampMinutes,
  dayTarget,
  MAX_EXTRA_MINUTES,
  LEAVE_TYPE_OPTIONS,
  MIN_MINUTES,
  MONTHS,
  parseISO,
  STEP_MINUTES,
  registerTaskColors,
  taskColor,
  taskShares,
  toDateStr,
  toHours,
  toMinutes,
  type LocalDay,
  type LocalEntry,
} from "./timesheet-shared";

// ─── Main client ──────────────────────────────────────────────────────────────

export function TaskInputClient({
  today,
  initialDate,
  initialData,
}: {
  today: string;
  initialDate?: string;
  initialData: TasksPageData;
}) {
  const todayDate = parseISO(today);
  // A linked day must round-trip through the parser (rejects 2026-13-45); otherwise start on today.
  const startDate = initialDate && toDateStr(parseISO(initialDate)) === initialDate ? initialDate : today;
  const startDateObj = parseISO(startDate);
  const [viewYear, setViewYear] = useState(startDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(startDateObj.getMonth());
  const [selected, setSelected] = useState(startDate);

  const [serverMap, setServerMap] = useState<Map<string, LocalDay>>(() => buildServerMap(initialData));
  const [localDay, setLocalDay] = useState<LocalDay>(
    () => serverMap.get(startDate) ?? { halfDay: false, onLeave: false, leaveType: null, extraHours: 0, entries: [] },
  );
  const [isDirty, setIsDirty] = useState(false);
  const [confirmHalf, setConfirmHalf] = useState(false);
  const [halfDayBlocked, setHalfDayBlocked] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Number of saves in flight — drives the "Saving…" overlay.
  const [savingCount, setSavingCount] = useState(0);
  const isSaving = savingCount > 0;
  // Background (debounced) autosave status — a subtle inline indicator, not the overlay.
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // Add-activity picker state (Task → Category → Subcategory → hours)
  const [pickStep, setPickStep] = useState<"none" | "task" | "category" | "answer">("none");
  // Direction of the last step change — drives the slide-in animation.
  const [pickDir, setPickDir] = useState<"fwd" | "back">("fwd");
  const [pickedTaskId, setPickedTaskId] = useState<number | null>(null);
  const [pickedCategoryId, setPickedCategoryId] = useState<number | null>(null);
  // Several subcategories of the picked category can be ticked at once, each with
  // its own time; "Other (custom)" is one more optional row.
  const [picks, setPicks] = useState<{ answer: string; minutes: number }[]>([]);
  const [isCustomAnswer, setIsCustomAnswer] = useState(false);
  const [customAnswer, setCustomAnswer] = useState("");
  const [customMinutes, setCustomMinutes] = useState(60);

  // Ref always holds the latest dirty/saving state so effects read current values.
  const stateRef = useRef({ isDirty, selected, localDay, isSaving });
  useEffect(() => { stateRef.current = { isDirty, selected, localDay, isSaving }; });

  // Wraps an async save so the overlay shows while it is in flight.
  const runSave = <T,>(op: () => Promise<T>): Promise<T> => {
    setSavingCount((c) => c + 1);
    return op().finally(() => setSavingCount((c) => c - 1));
  };

  // Auto-save on unmount (soft navigation away from this page).
  useEffect(() => {
    return () => {
      const { isDirty: dirty, selected: sel, localDay: day } = stateRef.current;
      if (dirty) {
        saveDay(sel, day.halfDay, day.onLeave, day.leaveType, day.extraHours, day.entries);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (1) Debounced autosave — collapse rapid edits (add / remove / hour +/-) into a
  // single write ~1.5s after the last change, so hour stepping doesn't hammer the DB.
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      const snapshot = { ...localDay };
      const date = selected;
      setIsDirty(false); // this batch is now being saved; new edits re-arm the timer
      setAutoSaveState("saving");
      runSave(() => saveDay(date, snapshot.halfDay, snapshot.onLeave, snapshot.leaveType, snapshot.extraHours, snapshot.entries))
        .then((result) => {
          if (result.success) {
            setServerMap((prev) => new Map(prev).set(date, snapshot));
            setAutoSaveState("saved");
          } else {
            setIsDirty(true);
            setAutoSaveState("idle");
            toast.error("Auto-save failed — will retry.");
          }
        })
        .catch(() => {
          setIsDirty(true);
          setAutoSaveState("idle");
        });
    }, 1500);
    return () => clearTimeout(timer);
  }, [isDirty, localDay, selected]);

  // (2) Flush pending changes when the tab is hidden or closed. keepalive lets the
  // request outlive page teardown, which the unmount effect above cannot guarantee.
  useEffect(() => {
    const flush = () => {
      const { isDirty: dirty, selected: sel, localDay: day } = stateRef.current;
      if (!dirty) return;
      navigator.sendBeacon?.(
        "/api/tasks/save",
        new Blob(
          [JSON.stringify({ date: sel, halfDay: day.halfDay, onLeave: day.onLeave, leaveType: day.leaveType, extraHours: day.extraHours, entries: day.entries })],
          { type: "application/json" },
        ),
      );
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Warn before closing/reloading the tab while a save is pending or in flight,
  // so unsaved work isn't lost.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (stateRef.current.isDirty || stateRef.current.isSaving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const holidayMap = useMemo(() => buildHolidayMap(initialData.holidays), [initialData.holidays]);
  const { dailyTarget } = initialData;
  registerTaskColors(initialData);
  const halfTarget = dailyTarget / 2;
  const target = dayTarget(dailyTarget, localDay);
  // Summed in whole minutes: adding 5-minute entries as float hours drifts, and
  // "target reached" must not hinge on 7.999999 vs 8.
  const targetMinutes = toMinutes(target);
  const totalMinutes = localDay.entries.reduce((s, e) => s + toMinutes(e.hours), 0);
  const total = toHours(totalMinutes);
  const dayShares = useMemo(() => taskShares(localDay.entries), [localDay.entries]);
  // Time an entry may grow to: whatever the rest of the day leaves free.
  const maxFor = (entry: LocalEntry) => Math.max(MIN_MINUTES, targetMinutes - (totalMinutes - toMinutes(entry.hours)));

  // A day's tasks stay editable until the end of the next day, so both today
  // and yesterday are within the normal grace window.
  const yesterday = toDateStr(
    new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 1),
  );

  const isHoliday = holidayMap.has(selected);
  const isWeekend = parseISO(selected).getDay() === 0; // Sunday only
  const isToday = selected === today;
  const isYesterday = selected === yesterday;
  const isFuture = selected > today;
  const isPast = selected < today;
  // A superior may grant specific past dates for backdated logging.
  const isBackdateAllowed = initialData.backdateDates.includes(selected);
  const isGraceWindow = isToday || isYesterday;
  const isLocked = isHoliday || isWeekend || isFuture;
  const isEditable = (isGraceWindow || isBackdateAllowed) && !isLocked;
  // Leave may be revoked for today, upcoming days, or any past day the user has
  // an explicit backdate grant for — never for other pre-today days (yesterday
  // included, unless it too was granted).
  const canRemoveLeave = selected >= today || isBackdateAllowed;

  const missingCount = useMemo(() => {
    let n = 0;
    const dim = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      const s = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (s > today || holidayMap.has(s)) continue;
      const dow = parseISO(s).getDay();
      if (dow === 0) continue; // Sunday only — Sat is a working day
      if (!serverMap.has(s)) n++;
    }
    return n;
  }, [serverMap, viewYear, viewMonth, today, holidayMap]);

  const handleSelectDate = (date: string) => {
    if (date === selected) return;
    if (isDirty) {
      const snapshot = { ...localDay };
      const fromDate = selected;
      runSave(() => saveDay(fromDate, snapshot.halfDay, snapshot.onLeave, snapshot.leaveType, snapshot.extraHours, snapshot.entries)).then((result) => {
        if (result.success) {
          setServerMap((prev) => new Map(prev).set(fromDate, snapshot));
        } else {
          toast.error("Auto-save failed — check your connection.");
        }
      });
    }
    setSelected(date);
    setLocalDay(serverMap.get(date) ?? { halfDay: false, onLeave: false, leaveType: null, extraHours: 0, entries: [] });
    setIsDirty(false);
    setPickStep("none");
    setPickedTaskId(null);
  };

  const modify = (updater: (cur: LocalDay) => LocalDay) => {
    setLocalDay((p) => updater(p));
    setIsDirty(true);
  };

  const handleToggleHalf = () => {
    // Enabling half day: block if current total already exceeds the half-day target
    if (!localDay.halfDay && total > halfTarget + localDay.extraHours) {
      setHalfDayBlocked(true);
    } else {
      setConfirmHalf(true);
    }
  };

  // Extra hours raise the day's target. Refuse a change that would leave the
  // logged time above the new target.
  const setExtraMinutes = (minutes: number) => {
    const extra = toHours(minutes);
    if (totalMinutes > toMinutes(dayTarget(dailyTarget, { halfDay: localDay.halfDay, extraHours: extra }))) {
      toast.error("Remove some activity time first — logged hours exceed the new target.");
      return;
    }
    modify((c) => ({ ...c, extraHours: extra }));
  };
  const confirmToggleHalf = () => {
    modify((c) => ({ ...c, halfDay: !c.halfDay, onLeave: false, leaveType: null }));
    setConfirmHalf(false);
  };

  const handleToggleLeave = () => {
    // Applying leave is fine; removing an existing backdated leave is not.
    if (localDay.onLeave && !canRemoveLeave) {
      toast.error("Backdated leave can't be removed.");
      return;
    }
    setConfirmLeave(true);
  };
  const confirmToggleLeave = (leaveType: LeaveType | null) => {
    modify((c) => {
      const nextOnLeave = !c.onLeave;
      return {
        ...c,
        onLeave: nextOnLeave,
        halfDay: false,
        extraHours: nextOnLeave ? 0 : c.extraHours,
        leaveType: nextOnLeave ? leaveType : null,
      };
    });
    setConfirmLeave(false);
  };

  // Mark the given dates as earned leave in local state (after a range apply).
  const markEarnedLeave = (dates: string[]) => {
    setServerMap((prev) => {
      const next = new Map(prev);
      for (const d of dates) {
        const ex = next.get(d) ?? { halfDay: false, onLeave: false, leaveType: null, extraHours: 0, entries: [] };
        next.set(d, { ...ex, halfDay: false, onLeave: true, leaveType: "earned" as LeaveType, extraHours: 0 });
      }
      return next;
    });
    if (dates.includes(selected)) {
      setLocalDay((p) => ({ ...p, halfDay: false, onLeave: true, leaveType: "earned", extraHours: 0 }));
      setIsDirty(false);
    }
  };

  const handleLeaveConfirm = (result: LeaveConfirmResult) => {
    if (result.action === "single") {
      confirmToggleLeave(result.leaveType);
      return;
    }

    if (result.action === "remove") {
      // Editable day: use the local toggle so preserved entries are restored.
      if (isEditable) {
        confirmToggleLeave(null);
        return;
      }
      // Upcoming (non-editable) leave day: revoke this date directly.
      const date = selected;
      setConfirmLeave(false);
      runSave(() => revokeLeaveDate(date)).then((res) => {
        if (!res.success) {
          toast.error(res.message);
          return;
        }
        setServerMap((prev) => {
          const next = new Map(prev);
          const ex = next.get(date);
          if (ex) {
            const cleared = { ...ex, halfDay: false, onLeave: false, leaveType: null };
            if (cleared.entries.length === 0) next.delete(date);
            else next.set(date, cleared);
          }
          return next;
        });
        setLocalDay((p) => ({ ...p, onLeave: false, leaveType: null }));
        setIsDirty(false);
        toast.success("Leave revoked for this day.");
      });
      return;
    }

    // Earned-leave range: one record per working day.
    setConfirmLeave(false);
    runSave(() => applyEarnedLeave(result.from, result.to)).then((res) => {
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      markEarnedLeave(res.dates);
      toast.success(
        res.dates.length === 1
          ? "Earned leave applied."
          : `Earned leave applied for ${res.dates.length} days.`,
      );
    });
  };

  const pickedCategory =
    initialData.tasks.find((t) => t.id === pickedTaskId)?.categories.find((c) => c.id === pickedCategoryId) ?? null;

  const resetPicker = () => {
    setPickStep("none");
    setPickedTaskId(null);
    setPickedCategoryId(null);
    setPicks([]);
    setIsCustomAnswer(false);
    setCustomAnswer("");
    setCustomMinutes(60);
  };

  const handleConfirmAdd = () => {
    if (!pickedTaskId || !pickedCategory || selection.length === 0) return;
    const category = pickedCategory.name;
    const taskName = initialData.tasks.find((t) => t.id === pickedTaskId)?.name;
    if (!taskName) return;
    // A subcategory can only be logged once per task+category.
    if (selection.some((p) => localDay.entries.some((e) => e.task === taskName && e.category === category && e.answer === p.answer))) {
      toast.error("That subcategory is already added.");
      return;
    }
    // One state change for the whole batch, so it is a single autosave.
    modify((c) => ({
      ...c,
      entries: [...c.entries, ...selection.map((p) => ({ task: taskName, category, answer: p.answer, hours: toHours(p.minutes) }))],
    }));
    if (selection.length > 1) toast.success(`Added ${selection.length} tasks`);
    resetPicker();
  };

  const togglePick = (answer: string) =>
    setPicks((cur) =>
      cur.some((p) => p.answer === answer)
        ? cur.filter((p) => p.answer !== answer)
        : leftMinutes >= MIN_MINUTES
          ? [...cur, { answer, minutes: clampMinutes(60, leftMinutes) }]
          : cur,
    );
  const setPickMinutes = (answer: string, minutes: number) =>
    setPicks((cur) => cur.map((p) => (p.answer === answer ? { ...p, minutes } : p)));
  const toggleCustom = () => {
    if (isCustomAnswer) setIsCustomAnswer(false);
    else if (leftMinutes >= MIN_MINUTES) {
      setIsCustomAnswer(true);
      setCustomMinutes(clampMinutes(60, leftMinutes));
    }
  };

  const handleRemove = (task: string, category: string, answer: string) => {
    const date = selected;
    const same = (e: LocalEntry) => e.task === task && e.category === category && e.answer === answer;
    const idx = localDay.entries.findIndex(same);
    const removed = localDay.entries[idx];
    if (!removed) return;
    modify((c) => ({ ...c, entries: c.entries.filter((e) => !same(e)) }));
    toast(`Removed ${answer}`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (stateRef.current.selected !== date) {
            toast.error(`Switch back to ${fmtShortDate(date)} to restore it.`);
            return;
          }
          modify((c) => {
            if (c.entries.some(same)) return c;
            // Other entries may have grown meanwhile — restore only what still fits the target.
            const used = c.entries.reduce((s, e) => s + toMinutes(e.hours), 0);
            const room = targetMinutes - used;
            if (room < MIN_MINUTES) {
              toast.error("No time left today to restore it.");
              return c;
            }
            const next = [...c.entries];
            next.splice(Math.min(idx, next.length), 0, { ...removed, hours: toHours(clampMinutes(toMinutes(removed.hours), room)) });
            return { ...c, entries: next };
          });
        },
      },
    });
  };

  // The most recent earlier day with tasks — the usual starting point for today's log.
  const prevDay = useMemo(() => {
    const found = [...serverMap.entries()]
      .filter(([d, v]) => d < selected && v.entries.length > 0 && !v.onLeave)
      .sort(([a], [b]) => (a < b ? 1 : -1))[0];
    return found ? { date: found[0], entries: found[1].entries } : null;
  }, [serverMap, selected]);
  const prevLabel = prevDay
    ? prevDay.date === yesterday ? "yesterday" : parseISO(prevDay.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    : "";

  const handleCopyPrev = () => {
    if (!prevDay) return;
    const date = selected;
    const copied: LocalEntry[] = [];
    let room = targetMinutes;
    for (const e of prevDay.entries) {
      if (room < MIN_MINUTES) break;
      const m = clampMinutes(toMinutes(e.hours), room);
      copied.push({ ...e, hours: toHours(m) });
      room -= m;
    }
    modify((c) => ({ ...c, entries: copied }));
    toast.success(`Copied ${copied.length} task${copied.length === 1 ? "" : "s"} from ${prevLabel}`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (stateRef.current.selected === date) modify((c) => ({ ...c, entries: [] }));
        },
      },
    });
  };

  const handleMinutes = (task: string, category: string, answer: string, minutes: number) =>
    modify((c) => ({
      ...c,
      entries: c.entries.map((e) =>
        e.task === task && e.category === category && e.answer === answer ? { ...e, hours: toHours(minutes) } : e,
      ),
    }));

  const stepMonth = (dir: number) => {
    setViewYear((y) => {
      const newM = viewMonth + dir;
      if (newM < 0) { setViewMonth(11); return y - 1; }
      if (newM > 11) { setViewMonth(0); return y + 1; }
      setViewMonth(newM);
      return y;
    });
  };

  const goToday = () => {
    setViewYear(todayDate.getFullYear());
    setViewMonth(todayDate.getMonth());
    handleSelectDate(today);
  };

  const pickedTask = initialData.tasks.find((t) => t.id === pickedTaskId) ?? null;
  // Subcategories already logged for the picked task+category (can't repeat).
  const usedAnswersForPicked = pickedCategory
    ? localDay.entries
        .filter((e) => e.task === pickedTask?.name && e.category === pickedCategory.name)
        .map((e) => e.answer)
    : [];
  // Time budget: what is left today after the day's entries and everything ticked
  // so far. Each row may grow by that much, so ticked times can never overshoot.
  const customText = customAnswer.trim();
  const pickedTotal = picks.reduce((t, p) => t + p.minutes, 0) + (isCustomAnswer ? customMinutes : 0);
  const leftMinutes = targetMinutes - totalMinutes - pickedTotal;
  const customDuplicate =
    isCustomAnswer && customText.length > 0 && (usedAnswersForPicked.includes(customText) || picks.some((p) => p.answer === customText));
  const selection = [...picks, ...(isCustomAnswer && customText ? [{ answer: customText, minutes: customMinutes }] : [])];
  const canConfirmAdd =
    pickedTaskId !== null &&
    pickedCategoryId !== null &&
    selection.length > 0 &&
    !(isCustomAnswer && !customText) &&
    !customDuplicate;

  const slideAnim =
    pickDir === "back"
      ? "animate-in slide-in-from-left-5 fade-in duration-200"
      : "animate-in slide-in-from-right-5 fade-in duration-200";

  return (
    <>
      {/* ── Autosave overlay ── */}
      {isSaving && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-150"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-card border border-border px-5 py-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)]">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">Saving your changes…</div>
              <div className="text-[11.5px] text-muted-foreground">Please don&apos;t close this page.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="relative isolate flex flex-wrap items-end justify-between gap-4 mb-6">
        <HeaderGlow />
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Task Input
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Log hours against your tasks each day. Days you miss are flagged in red.
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/15 border border-brand/25 text-xs font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Timesheet · {MONTHS[viewMonth]} {viewYear}
            </span>
            {missingCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs font-medium text-red-700 dark:text-red-400">
                <TriangleAlert className="h-3 w-3" />
                {missingCount} day{missingCount > 1 ? "s" : ""} not logged
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted border border-border text-xs text-muted-foreground">
                All caught up
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted border border-border rounded-2xl shrink-0">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Daily target</div>
            <div className="text-sm font-bold text-foreground">
              {fmtHrs(dailyTarget)}{" "}
              <span className="text-xs font-medium text-muted-foreground">· from Schedule</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-5 items-start">

        {/* ── Calendar ── */}
        <CalendarCard
          viewYear={viewYear}
          viewMonth={viewMonth}
          selected={selected}
          today={today}
          holidayMap={holidayMap}
          serverMap={serverMap}
          localDay={localDay}
          dailyTarget={dailyTarget}
          onSelectDate={handleSelectDate}
          onStepMonth={stepMonth}
          onGoToday={goToday}
        />

        {/* ── Task panel ── */}
        <aside className="flex flex-col gap-4">
          {/* Day header */}
          <Card className="gap-0 py-0">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    {isFuture ? "Upcoming day" : "Logging for"}
                  </div>
                  <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
                    {fmtLong(selected)}
                  </div>
                </div>
                <DayBadge status={getDayStatus(selected, holidayMap, localDay, today, dailyTarget)} />
              </div>

              {isEditable && (
                <div className="mt-4 flex flex-col gap-2">
                  {/* Half-day toggle — hidden when on leave */}
                  {!localDay.onLeave && (
                    <label className={cn(
                      "flex items-center gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-colors",
                      localDay.halfDay
                        ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                        : "bg-muted border-border",
                    )}>
                      <Toggle on={localDay.halfDay} onChange={handleToggleHalf} activeClass="bg-amber-500" />
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-semibold", localDay.halfDay ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>
                          Apply for half day
                        </div>
                        <div className="text-xs text-muted-foreground">Target drops to {fmtHrs(halfTarget)}</div>
                      </div>
                      {localDay.halfDay && (
                        <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400 shrink-0">½</span>
                      )}
                    </label>
                  )}

                  {/* Extra hours — works on full and half days, hidden on leave */}
                  {!localDay.onLeave && (
                    <div className={cn(
                      "px-3.5 py-3 rounded-xl border transition-colors",
                      localDay.extraHours > 0
                        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                        : "bg-muted border-border",
                    )}>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <Toggle
                          on={localDay.extraHours > 0}
                          onChange={() => setExtraMinutes(localDay.extraHours > 0 ? 0 : 60)}
                          activeClass="bg-emerald-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-sm font-semibold", localDay.extraHours > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
                            Add extra hours
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {localDay.extraHours > 0 ? `Target is ${fmtHrs(target)}` : "Worked beyond the day's target?"}
                          </div>
                        </div>
                        {localDay.extraHours > 0 && (
                          <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">+{fmtHrs(localDay.extraHours)}</span>
                        )}
                      </label>
                      {localDay.extraHours > 0 && (
                        <div className="mt-3">
                          <DurationControl
                            minutes={toMinutes(localDay.extraHours)}
                            maxMinutes={MAX_EXTRA_MINUTES}
                            onChange={setExtraMinutes}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Leave toggle — hidden when on half day */}
                  {!localDay.halfDay && (
                    <label className={cn(
                      "flex items-center gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-colors",
                      localDay.onLeave
                        ? "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800"
                        : "bg-muted border-border",
                    )}>
                      <Toggle on={localDay.onLeave} onChange={handleToggleLeave} activeClass="bg-sky-500" />
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-semibold", localDay.onLeave ? "text-sky-700 dark:text-sky-400" : "text-foreground")}>
                          Apply for leave
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {localDay.onLeave ? "No tasks required for this day." : "Mark this day as leave."}
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              )}
            </div>
          </Card>

          {localDay.onLeave && !isHoliday && !isWeekend ? (
            <LeaveActiveCard
              active={selected >= today}
              leaveType={localDay.leaveType}
              onRemove={canRemoveLeave ? handleToggleLeave : undefined}
            />
          ) : isLocked ? (
            <LockedNotice holidayName={holidayMap.get(selected)} isFuture={isFuture} />
          ) : (
            <>
              {/* Progress */}
              <ProgressCard
                total={total}
                target={target}
                halfDay={localDay.halfDay}
                extraHours={localDay.extraHours}
                entries={localDay.entries}
              />

              {/* Task list */}
              <Card className="gap-0 py-0">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-foreground">Tasks</h3>
                    <div className="flex items-center gap-2">
                      {isDirty ? (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved…</span>
                      ) : autoSaveState === "saving" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                        </span>
                      ) : autoSaveState === "saved" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3 w-3" /> Saved
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">{localDay.entries.length} logged</span>
                    </div>
                  </div>

                  {localDay.entries.length === 0 && isEditable && pickStep === "none" && (
                    <div className="px-4 py-5 border border-dashed border-border rounded-xl text-center text-sm text-muted-foreground mb-3">
                      No activities logged yet — add one below.
                      {prevDay && (
                        <div className="mt-3">
                          <Button variant="outline" size="sm" onClick={handleCopyPrev} className="rounded-full gap-1.5">
                            <Copy className="h-3.5 w-3.5" />
                            Copy {prevDay.entries.length} task{prevDay.entries.length === 1 ? "" : "s"} from {prevLabel}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mb-3">
                    {localDay.entries.length === 0 && isPast && !isEditable && pickStep === "none" && (
                      <div className="px-4 py-5 border border-dashed border-border rounded-xl text-center text-sm text-muted-foreground">
                        No tasks were logged for this day.
                      </div>
                    )}
                    {/* Same share bar and per-task percentages as the supervisor's view of this
                        day; on editable days they update live as times change. */}
                    {!isEditable && localDay.entries.length > 0 && <ReadOnlyTaskGroups entries={localDay.entries} />}
                    {isEditable && localDay.entries.length > 0 && <ShareBar tasks={dayShares.tasks} percents={dayShares.percents} />}
                    {isEditable && dayShares.tasks.map((g, i) =>
                      // One activity reads as a plain row, several as a block, as in the read-only view.
                      g.items.length === 1 ? (
                        <TaskRow
                          key={g.task}
                          entry={g.items[0]}
                          percent={dayShares.percents[i]}
                          maxMinutes={maxFor(g.items[0])}
                          onMinutes={(m) => handleMinutes(g.items[0].task, g.items[0].category, g.items[0].answer, m)}
                          onRemove={() => handleRemove(g.items[0].task, g.items[0].category, g.items[0].answer)}
                        />
                      ) : (
                        <TaskGroup
                          key={g.task}
                          task={g.task}
                          items={g.items}
                          minutes={g.minutes}
                          percent={dayShares.percents[i]}
                          maxFor={maxFor}
                          onMinutes={(e, m) => handleMinutes(e.task, e.category, e.answer, m)}
                          onRemove={(e) => handleRemove(e.task, e.category, e.answer)}
                        />
                      ),
                    )}
                  </div>

                  {isEditable && pickStep === "none" && (
                    <Button
                      onClick={() => { setPickDir("fwd"); setPickStep("task"); setPickedTaskId(null); setPickedCategoryId(null); }}
                      disabled={totalMinutes >= targetMinutes}
                      className="w-full rounded-xl bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-2 h-10"
                    >
                      <Plus className="h-4 w-4" />
                      {totalMinutes >= targetMinutes ? "Daily target reached" : "Add activity"}
                    </Button>
                  )}

                  {isEditable && pickStep === "task" && (
                    <TaskPicker
                      anim={slideAnim}
                      tasks={initialData.tasks}
                      onPick={(id) => {
                        setPickDir("fwd");
                        setPickedTaskId(id);
                        setPickedCategoryId(null);
                        setPickStep("category");
                      }}
                      onCancel={() => setPickStep("none")}
                    />
                  )}

                  {isEditable && pickStep === "category" && pickedTask && (
                    <CategoryPicker
                      anim={slideAnim}
                      task={pickedTask}
                      onPick={(cid) => {
                        setPickDir("fwd");
                        setPickedCategoryId(cid);
                        setPickStep("answer");
                        setPicks([]);
                        setIsCustomAnswer(false);
                        setCustomAnswer("");
                        setCustomMinutes(60);
                      }}
                      onBack={() => { setPickDir("back"); setPickStep("task"); }}
                      onCancel={() => setPickStep("none")}
                    />
                  )}

                  {isEditable && pickStep === "answer" && pickedTask && pickedCategory && (
                    <AnswerPicker
                      anim={slideAnim}
                      task={pickedTask}
                      category={pickedCategory}
                      picks={picks}
                      isCustom={isCustomAnswer}
                      customAnswer={customAnswer}
                      customMinutes={customMinutes}
                      customDuplicate={customDuplicate}
                      count={selection.length}
                      pickedTotal={pickedTotal}
                      leftMinutes={leftMinutes}
                      canConfirm={canConfirmAdd}
                      usedAnswers={usedAnswersForPicked}
                      onToggle={togglePick}
                      onPickMinutes={setPickMinutes}
                      onToggleCustom={toggleCustom}
                      onCustomChange={setCustomAnswer}
                      onCustomMinutes={setCustomMinutes}
                      onConfirm={handleConfirmAdd}
                      onBack={() => { setPickDir("back"); setPickStep("category"); }}
                    />
                  )}

                  {isYesterday && isEditable && (
                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 text-center mt-1">
                      You can still edit yesterday&apos;s tasks until the end of today.
                    </p>
                  )}
                  {isPast && !isYesterday && isEditable && (
                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 text-center mt-1">
                      Backdated entry enabled by your supervisor for this day.
                    </p>
                  )}
                  {isPast && !isEditable && (
                    <p className="text-[11px] text-muted-foreground text-center mt-1">
                      Past day — view only
                    </p>
                  )}
                </div>
              </Card>

            </>
          )}
        </aside>
      </div>

      {halfDayBlocked && (
        <HalfDayBlockedModal
          total={total}
          halfTarget={halfTarget}
          onClose={() => setHalfDayBlocked(false)}
        />
      )}

      {confirmLeave && (
        <LeaveConfirmModal
          removing={localDay.onLeave}
          hasEntries={localDay.entries.length > 0}
          selected={selected}
          yesterday={yesterday}
          onConfirm={handleLeaveConfirm}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      {confirmHalf && isEditable && (
        <HalfDayConfirmModal
          removing={localDay.halfDay}
          fullTarget={dailyTarget}
          halfTarget={halfTarget}
          onConfirm={confirmToggleHalf}
          onCancel={() => setConfirmHalf(false)}
        />
      )}
    </>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ on, onChange, activeClass = "bg-amber-500" }: { on: boolean; onChange: () => void; activeClass?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onChange(); }}
      className={cn(
        "relative w-[38px] h-[22px] rounded-full shrink-0 transition-colors duration-200",
        on ? activeClass : "bg-muted-foreground/25",
      )}
    >
      <span className={cn(
        "absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200",
        on ? "left-[19px]" : "left-[3px]",
      )} />
    </button>
  );
}

// ─── Leave date picker (shared Calendar in a popover) ─────────────────────────

function fmtShortDate(s: string): string {
  return parseISO(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function LeaveDatePicker({
  value,
  min,
  onChange,
}: {
  value: string;
  min?: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? parseISO(value) : undefined;
  const minDate = min ? parseISO(min) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-left transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
        >
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className={cn("flex-1 truncate", value ? "text-foreground font-medium" : "text-muted-foreground")}>
            {value ? fmtShortDate(value) : "Pick a date"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate ?? minDate}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(d) => {
            if (d) {
              onChange(toDateStr(d));
              setOpen(false);
            }
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Leave confirm modal ──────────────────────────────────────────────────────

type LeaveConfirmResult =
  | { action: "remove" }
  | { action: "single"; leaveType: LeaveType }
  | { action: "range"; from: string; to: string };

function LeaveConfirmModal({
  removing,
  hasEntries,
  selected,
  yesterday,
  onConfirm,
  onCancel,
}: {
  removing: boolean;
  hasEntries: boolean;
  selected: string;
  yesterday: string;
  onConfirm: (result: LeaveConfirmResult) => void;
  onCancel: () => void;
}) {
  const [leaveType, setLeaveType] = useState<LeaveType | null>(null);
  // Earned leave can span multiple days — but only within the grace window
  // (today/yesterday) and forward. A backdated (granted) day only ever covers
  // itself, so a range can't spill onto ungranted past dates.
  const allowRange = selected >= yesterday;
  const [fromDate, setFromDate] = useState(selected);
  const [toDate, setToDate] = useState(selected);
  const isEarned = leaveType === "earned";
  const rangeValid = !isEarned || !allowRange || (!!fromDate && !!toDate && toDate >= fromDate);
  const canConfirm = removing || (leaveType !== null && rangeValid);

  const handleConfirm = () => {
    if (removing) return onConfirm({ action: "remove" });
    if (!leaveType) return;
    if (leaveType === "earned") {
      // On a backdated granted day, earned leave applies to that single day.
      return allowRange
        ? onConfirm({ action: "range", from: fromDate, to: toDate })
        : onConfirm({ action: "range", from: selected, to: selected });
    }
    onConfirm({ action: "single", leaveType });
  };

  // Range can only start from the selected (grace-window) day onward.
  const minDate = selected;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-5"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-3xl w-full max-w-[380px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-3.5 mb-4">
            <div className={cn(
              "h-11 w-11 rounded-2xl grid place-items-center shrink-0 text-sm font-bold",
              removing
                ? "bg-muted border border-border text-muted-foreground"
                : "bg-sky-100 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-400",
            )}>
              {removing ? "✕" : "L"}
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">
                {removing ? "Remove leave?" : "Apply for leave?"}
              </h3>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {removing
                  ? "This day will return to normal. You'll need to log tasks."
                  : "Choose the type of leave for this day."}
              </p>
            </div>
          </div>

          {!removing && (
            <div className="flex flex-col gap-2 mb-1">
              {LEAVE_TYPE_OPTIONS.map((opt) => {
                const active = leaveType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLeaveType(opt.value)}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-colors",
                      active
                        ? "bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-700"
                        : "bg-muted border-border hover:border-foreground/20",
                    )}
                  >
                    <span className={cn(
                      "h-4 w-4 rounded-full border-2 grid place-items-center shrink-0",
                      active ? "border-sky-500" : "border-muted-foreground/40",
                    )}>
                      {active && <span className="h-2 w-2 rounded-full bg-sky-500" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={cn("block text-sm font-semibold", active ? "text-sky-700 dark:text-sky-400" : "text-foreground")}>
                        {opt.label}
                      </span>
                      <span className="block text-[11.5px] text-muted-foreground">{opt.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Earned leave on a backdated (granted) day covers just that day. */}
          {!removing && isEarned && !allowRange && (
            <div className="mt-3 rounded-xl bg-muted/60 border border-border px-3.5 py-3 text-[11.5px] text-muted-foreground">
              Earned leave will be applied to this day only. Ranges are available from today.
            </div>
          )}

          {/* Earned leave: pick a date range — each working day is stored separately. */}
          {!removing && isEarned && allowRange && (
            <div className="mt-3 rounded-xl bg-muted/60 border border-border px-3.5 py-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">From</span>
                  <LeaveDatePicker
                    value={fromDate}
                    min={minDate}
                    onChange={(v) => {
                      setFromDate(v);
                      if (toDate < v) setToDate(v);
                    }}
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">To</span>
                  <LeaveDatePicker
                    value={toDate}
                    min={fromDate || minDate}
                    onChange={setToDate}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                Sundays and holidays are skipped. Each day can be revoked individually later.
              </p>
            </div>
          )}

          {!removing && hasEntries && !isEarned && (
            <div className="mt-3 rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 px-4 py-3 text-[12.5px] text-sky-700 dark:text-sky-400">
              Your logged tasks will be preserved and restored if you remove leave later.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onCancel} className="rounded-full">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              "rounded-full gap-2 h-auto py-2 px-5 disabled:opacity-45 disabled:cursor-not-allowed",
              removing
                ? "bg-muted text-foreground hover:bg-muted hover:brightness-95 border border-border"
                : "bg-sky-500 text-white hover:bg-sky-500 hover:brightness-105",
            )}
          >
            <Check className="h-3.5 w-3.5" />
            {removing ? "Remove leave" : "Apply leave"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Half-day blocked modal ───────────────────────────────────────────────────

function HalfDayBlockedModal({
  total,
  halfTarget,
  onClose,
}: {
  total: number;
  halfTarget: number;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-5"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl w-full max-w-[380px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="h-11 w-11 rounded-2xl grid place-items-center shrink-0 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
              <TriangleAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Cannot apply half day</h3>
              <p className="text-[13px] text-muted-foreground mt-0.5">Hours exceed half-day target.</p>
            </div>
          </div>

          <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Logged hours</span>
              <span className="font-bold text-red-700 dark:text-red-400">{fmtHrs(total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Half-day target</span>
              <span className="font-bold text-foreground">{fmtHrs(halfTarget)}</span>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Reduce your logged task hours below <strong className="text-foreground font-semibold">{fmtHrs(halfTarget)}</strong> before applying for half day.
          </p>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-border">
          <Button onClick={onClose} className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 px-5">
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Half-day confirmation modal ──────────────────────────────────────────────

function HalfDayConfirmModal({
  removing,
  fullTarget,
  halfTarget,
  onConfirm,
  onCancel,
}: {
  removing: boolean;
  fullTarget: number;
  halfTarget: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-5"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-3xl w-full max-w-[380px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-3.5 mb-4">
            <div className={cn(
              "h-11 w-11 rounded-2xl grid place-items-center shrink-0 text-xl font-extrabold",
              removing
                ? "bg-muted border border-border text-muted-foreground"
                : "bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400",
            )}>
              ½
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">
                {removing ? "Remove half day?" : "Apply half day?"}
              </h3>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {removing
                  ? `Target restores to ${fmtHrs(fullTarget)} for this day.`
                  : `Target drops to ${fmtHrs(halfTarget)} for this day.`}
              </p>
            </div>
          </div>

          {!removing && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-[12.5px] text-amber-700 dark:text-amber-400">
              Hours above {fmtHrs(halfTarget)} will no longer count toward the target.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onCancel} className="rounded-full">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className={cn(
              "rounded-full gap-2 h-auto py-2 px-5",
              removing
                ? "bg-muted text-foreground hover:bg-muted hover:brightness-95 border border-border"
                : "bg-amber-500 text-white hover:bg-amber-500 hover:brightness-105",
            )}
          >
            <Check className="h-3.5 w-3.5" />
            {removing ? "Remove half day" : "Apply half day"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Progress card ────────────────────────────────────────────────────────────

function ProgressCard({
  total, target, halfDay, extraHours, entries,
}: {
  total: number; target: number; halfDay: boolean; extraHours: number;
  entries: LocalEntry[];
}) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((total / target) * 100));
  const over = total > target;
  const remaining = Math.max(0, target - total);
  const ringDeg = Math.min(360, (total / target) * 360);
  const ringColor = over ? "#5b8def" : total >= target ? "#4d6e0c" : total > 0 ? "#9a6b16" : "var(--color-muted)";
  const max = Math.max(target, total);

  return (
    <Card className="gap-0 py-0">
      <div className="p-5">
        <div className="flex items-center gap-5">
          {/* Conic ring with tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative w-[96px] h-[96px] shrink-0 cursor-default">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: `conic-gradient(${ringColor} ${ringDeg}deg, hsl(var(--muted)) ${ringDeg}deg 360deg)` }}
                  />
                  <div className="absolute inset-[10px] rounded-full bg-card ring-1 ring-border grid place-items-center">
                    <div className="text-center leading-none">
                      <div className={cn("text-2xl font-extrabold tabular-nums", total > 0 ? "text-foreground" : "text-muted-foreground")}>
                        {pct}%
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">of {fmtHrs(target)}</div>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{fmtHrs(total)} logged · {pct}% of {fmtHrs(target)} target</p>
                {over && <p className="mt-0.5 opacity-70">{fmtHrs(total - target)} over target</p>}
                {!over && remaining > 0 && <p className="mt-0.5 opacity-70">{fmtHrs(remaining)} remaining</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Numbers */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Logged today</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">{fmtHrs(total)}</span>
              <span className="text-sm text-muted-foreground">/ {fmtHrs(target)}{halfDay ? " (½)" : ""}{extraHours > 0 ? ` (+${fmtHrs(extraHours)} extra)` : ""}</span>
            </div>
            <div className={cn("mt-1.5 text-[12.5px] font-medium",
              over ? "text-blue-600 dark:text-blue-400"
                : remaining === 0 ? "text-green-700 dark:text-green-400"
                  : "text-muted-foreground",
            )}>
              {over
                ? `${fmtHrs(total - target)} over target`
                : remaining === 0
                  ? "Target reached — nicely done"
                  : `${fmtHrs(remaining)} remaining`}
            </div>
          </div>
        </div>

        {/* Stacked bar with per-segment tooltips */}
        <div className="mt-4">
          <div className="relative h-3.5 rounded-full bg-muted border border-border overflow-hidden flex">
            {entries.map((e) => {
              const taskName = e.task;
              const w = (e.hours / max) * 100;
              return (
                <TooltipProvider key={`${e.task}::${e.category}::${e.answer}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="h-full border-r border-white/60 last:border-0 cursor-default"
                        style={{ width: `${w}%`, background: taskColor(e.task) }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: taskColor(e.task) }} />
                        <span>{taskName}{e.category ? ` · ${e.category}` : ""} · {e.answer}: {fmtHrs(e.hours)}</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5 text-[10.5px] text-muted-foreground">
            <span>0h</span>
            <span className="font-semibold">Target {fmtHrs(target)}</span>
            <span>{fmtHrs(max)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  entry, percent, maxMinutes, onMinutes, onRemove,
}: {
  entry: LocalEntry; percent: number; maxMinutes: number;
  onMinutes: (m: number) => void; onRemove: () => void;
}) {
  const minutes = toMinutes(entry.hours);
  const atMax = minutes >= maxMinutes;

  return (
    <div className={cn(
      "flex items-center gap-2.5 px-3 py-2.5 border rounded-xl transition-colors",
      atMax ? "bg-brand/5 border-brand/25" : "bg-muted border-border",
    )}>
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: taskColor(entry.task) }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-foreground truncate">{entry.task}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {entry.category ? `${entry.category} · ${entry.answer}` : entry.answer}
        </div>
      </div>

      <SharePercent value={percent} />

      <DurationChip
        label={entry.answer}
        minutes={minutes}
        maxMinutes={maxMinutes}
        onChange={onMinutes}
      />

      <button
        onClick={onRemove}
        aria-label={`Remove ${entry.answer}`}
        className="h-9 w-9 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Several activities logged under one task: a header with the task's total time
// and share of the day, and each activity beneath it with its own editable time.
function TaskGroup({
  task, items, minutes, percent, maxFor, onMinutes, onRemove,
}: {
  task: string; items: LocalEntry[]; minutes: number; percent: number;
  maxFor: (entry: LocalEntry) => number;
  onMinutes: (entry: LocalEntry, minutes: number) => void; onRemove: (entry: LocalEntry) => void;
}) {
  const color = taskColor(task);
  return (
    <div className="px-3 py-2.5 bg-muted border border-border rounded-xl">
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
        <span className="flex-1 min-w-0 text-[13.5px] font-semibold text-foreground truncate">{task}</span>
        <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">{fmtHrs(toHours(minutes))}</span>
        <SharePercent value={percent} />
      </div>
      {/* Rule in the task colour ties each activity to its task. */}
      <ul className="mt-2 ml-1 pl-3 border-l-2 flex flex-col gap-1.5" style={{ borderColor: `${color}66` }}>
        {items.map((e) => (
            <li key={`${e.category}::${e.answer}`} className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
                {e.category && <span className="font-medium text-foreground/85">{e.category} · </span>}
                {e.answer}
              </span>
              <DurationChip label={e.answer} minutes={toMinutes(e.hours)} maxMinutes={maxFor(e)} onChange={(m) => onMinutes(e, m)} />
              <button
                onClick={() => onRemove(e)}
                aria-label={`Remove ${e.answer}`}
                className="h-9 w-9 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
        ))}
      </ul>
    </div>
  );
}

// The time button + popover shared by logged rows and the picker's ticked rows:
// the row has no space for two steppers, and editing an entry deserves the same
// control as creating one.
function DurationChip({
  label, minutes, maxMinutes, onChange,
}: {
  label: string; minutes: number; maxMinutes: number; onChange: (minutes: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Edit time for ${label}, currently ${fmtHrs(toHours(minutes))}`}
          className="h-9 min-w-[68px] px-2.5 shrink-0 rounded-lg bg-background border border-border text-sm font-bold tabular-nums text-foreground transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {fmtHrs(toHours(minutes))}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[290px] p-3">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-foreground truncate">{label}</span>
          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">max {fmtHrs(toHours(maxMinutes))}</span>
        </div>
        <DurationControl minutes={minutes} maxMinutes={maxMinutes} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

// ─── Duration control ─────────────────────────────────────────────────────────
// Hours and minutes are stepped separately (+1h / +5m) so a 4-hour entry takes
// four taps rather than eight, and the presets make the common durations a
// single tap. Both fields are also typeable, which stays the fastest route to
// an arbitrary value like 3h 25m.
//
// State is one number — total minutes — so +5m at 55m rolls into the next hour
// instead of dead-ending, and hours/minutes can never disagree.

const PRESET_MINUTES = [30, 60, 120, 240];

function DurationControl({
  minutes, maxMinutes, onChange,
}: {
  minutes: number;
  maxMinutes: number;
  onChange: (minutes: number) => void;
}) {
  const uid = useId();
  const hRef = useRef<HTMLInputElement>(null);
  const mRef = useRef<HTMLInputElement>(null);

  const ceiling = ceilingMinutes(maxMinutes);
  const clamp = (v: number) => clampMinutes(v, maxMinutes);

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  // The two fields are uncontrolled and keyed on the committed value, so typing
  // is plain DOM state and a half-typed "1" on the way to "15" is never clamped
  // out from under the user. Typing does not change `minutes`, so nothing
  // remounts mid-edit; the value is read from both refs on blur or Enter.
  const commit = () => {
    const nh = Math.max(0, parseInt(hRef.current?.value ?? "", 10) || 0);
    const nm = Math.max(0, parseInt(mRef.current?.value ?? "", 10) || 0);
    onChange(clamp(nh * 60 + nm));
  };

  const step = (delta: number) => onChange(clamp(minutes + delta));
  const atMin = minutes <= MIN_MINUTES;
  const atMax = minutes >= ceiling;

  const field = (
    label: string,
    ref: React.RefObject<HTMLInputElement | null>,
    value: number,
    delta: number,
    canDown: boolean,
    canUp: boolean,
  ) => {
    const id = `${uid}-${label}`;
    return (
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Decrease ${label}`}
            onClick={() => step(-delta)}
            disabled={!canDown}
            className="h-11 w-11 shrink-0 rounded-xl bg-background border border-border grid place-items-center text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            key={value}
            id={id}
            ref={ref}
            type="text"
            inputMode="numeric"
            defaultValue={String(value)}
            aria-label={`${label} spent`}
            onFocus={(e) => e.currentTarget.select()}
            onInput={(e) => {
              const el = e.currentTarget;
              el.value = el.value.replace(/\D/g, "").slice(0, 3);
            }}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            className="h-11 w-full min-w-0 rounded-xl bg-background border border-border text-center text-base font-bold tabular-nums text-foreground outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
          />
          <button
            type="button"
            aria-label={`Increase ${label}`}
            onClick={() => step(delta)}
            disabled={!canUp}
            className="h-11 w-11 shrink-0 rounded-xl bg-background border border-border grid place-items-center text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  const presets = PRESET_MINUTES.filter((p) => p <= ceiling);
  const showFill = ceiling > 0 && !presets.includes(ceiling);

  return (
    <div>
      <div className="flex items-start gap-2">
        {field("Hours", hRef, h, 60, minutes - 60 >= MIN_MINUTES, !atMax)}
        {field("Minutes", mRef, m, STEP_MINUTES, !atMin, !atMax)}
      </div>

      {/* One tap for the durations people actually log. */}
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(clamp(p))}
            className={cn(
              "px-3 h-8 rounded-full border text-xs font-semibold transition-colors",
              minutes === p
                ? "bg-brand/15 border-brand/45 text-foreground"
                : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-foreground/25",
            )}
          >
            {fmtHrs(toHours(p))}
          </button>
        ))}
        {showFill && (
          <button
            type="button"
            onClick={() => onChange(ceiling)}
            className={cn(
              "px-3 h-8 rounded-full border text-xs font-semibold transition-colors",
              minutes === ceiling
                ? "bg-brand/15 border-brand/45 text-foreground"
                : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-foreground/25",
            )}
          >
            Fill {fmtHrs(toHours(ceiling))}
          </button>
        )}
      </div>

    </div>
  );
}

// ─── Task picker ──────────────────────────────────────────────────────────────

function TaskPicker({
  tasks, onPick, onCancel, anim,
}: {
  tasks: TaskForPicker[]; onPick: (id: number) => void; onCancel: () => void; anim?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? tasks.filter((t) => t.name.toLowerCase().includes(q)) : tasks;

  return (
    <div className={cn("mt-2 border border-border rounded-xl overflow-hidden", anim)}>
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Select task</span>
        <button onClick={onCancel} className="h-5 w-5 grid place-items-center rounded text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-2 border-b border-border">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered[0]) { e.preventDefault(); onPick(filtered[0].id); }
            if (e.key === "Escape") onCancel();
          }}
          className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <ul className="max-h-48 overflow-y-auto [scrollbar-width:thin]">
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-muted-foreground">No tasks match.</li>
        )}
        {filtered.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => onPick(t.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-0"
            >
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: taskColor(t.name) }} />
              <span className="text-sm font-medium text-foreground flex-1 truncate">{t.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{t.categories.length} categories</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Category picker ──────────────────────────────────────────────────────────

function CategoryPicker({
  task, onPick, onBack, onCancel, anim,
}: {
  task: TaskForPicker; onPick: (categoryId: number) => void; onBack: () => void; onCancel: () => void; anim?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  // Match on category name or any of its subcategory labels.
  const filtered = q
    ? task.categories.filter(
        (c) => c.name.toLowerCase().includes(q) || c.subcategories.some((s) => s.label.toLowerCase().includes(q)),
      )
    : task.categories;

  return (
    <div className={cn("mt-2 border border-border rounded-xl overflow-hidden", anim)}>
      <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b border-border">
        <button onClick={onBack} className="h-5 w-5 grid place-items-center rounded text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: taskColor(task.name) }} />
          <span className="text-xs font-semibold text-foreground truncate">{task.name}</span>
        </div>
        <button onClick={onCancel} className="h-5 w-5 grid place-items-center rounded text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-2 border-b border-border">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories & subcategories…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered[0]) { e.preventDefault(); onPick(filtered[0].id); }
            if (e.key === "Escape") onBack();
          }}
          className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <ul className="max-h-48 overflow-y-auto [scrollbar-width:thin]">
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-muted-foreground">No categories match.</li>
        )}
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onPick(c.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-0"
            >
              <span className="text-sm font-medium text-foreground flex-1 truncate">{c.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{c.subcategories.length} options</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Answer picker ────────────────────────────────────────────────────────────
// A checklist: tick every subcategory done under this category, give each its
// own time, and add them all in one go.

function AnswerPicker({
  task, category, picks, isCustom, customAnswer, customMinutes, customDuplicate, count, pickedTotal, leftMinutes,
  canConfirm, usedAnswers, onToggle, onPickMinutes, onToggleCustom, onCustomChange, onCustomMinutes, onConfirm, onBack, anim,
}: {
  task: TaskForPicker; category: CategoryForPicker;
  picks: { answer: string; minutes: number }[];
  isCustom: boolean; customAnswer: string; customMinutes: number; customDuplicate: boolean;
  count: number; pickedTotal: number; leftMinutes: number;
  canConfirm: boolean; usedAnswers: string[];
  onToggle: (answer: string) => void; onPickMinutes: (answer: string, minutes: number) => void;
  onToggleCustom: () => void; onCustomChange: (v: string) => void; onCustomMinutes: (m: number) => void;
  onConfirm: () => void; onBack: () => void; anim?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const subs = q ? category.subcategories.filter((s) => s.label.toLowerCase().includes(q)) : category.subcategories;
  const full = leftMinutes < MIN_MINUTES; // nothing more can be ticked
  const rowClass = (state: "used" | "on" | "off") =>
    cn(
      "flex-1 min-w-0 flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
      state === "used" && "bg-muted/50 border-border text-muted-foreground opacity-60 cursor-not-allowed",
      state === "on" && "bg-brand/10 border-brand/40 text-foreground",
      state === "off" && "bg-background border-border text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed",
    );

  return (
    <div className={cn("mt-2 border border-border rounded-xl overflow-hidden", anim)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b border-border">
        <button onClick={onBack} className="h-5 w-5 grid place-items-center rounded text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: taskColor(task.name) }} />
          <span className="text-xs font-semibold text-foreground truncate">{task.name} · {category.name}</span>
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">Pick one or more</span>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subcategories…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const first = subs.find((s) => !usedAnswers.includes(s.label) && !picks.some((p) => p.answer === s.label));
              if (first) onToggle(first.label);
            }
            if (e.key === "Escape") onBack();
          }}
          className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {/* Subcategory options */}
      <div className="p-3 space-y-1.5">
        {subs.length === 0 && (
          <p className="px-1 py-2 text-center text-xs text-muted-foreground">No subcategories match.</p>
        )}
        {subs.map((ans) => {
          const used = usedAnswers.includes(ans.label);
          const pick = picks.find((p) => p.answer === ans.label);
          return (
            <div key={ans.id} className="flex items-center gap-2">
              <button
                type="button"
                disabled={used || (!pick && full)}
                aria-pressed={!!pick}
                onClick={() => onToggle(ans.label)}
                className={rowClass(used ? "used" : pick ? "on" : "off")}
              >
                <span className="truncate">
                  {pick && <Check className="inline h-3 w-3 mr-1.5 text-foreground" />}
                  {ans.label}
                </span>
                {used && <span className="text-[10px] uppercase tracking-wide shrink-0">Added</span>}
              </button>
              {pick && (
                <DurationChip
                  label={ans.label}
                  minutes={pick.minutes}
                  maxMinutes={leftMinutes + pick.minutes}
                  onChange={(m) => onPickMinutes(ans.label, m)}
                />
              )}
            </div>
          );
        })}

        {/* Other (custom) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!isCustom && full}
            aria-pressed={isCustom}
            onClick={onToggleCustom}
            className={cn(
              "flex-1 min-w-0 text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              isCustom
                ? "bg-brand/10 border-brand/40 text-foreground"
                : "bg-background border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {isCustom && <Check className="inline h-3 w-3 mr-1.5 text-foreground" />}
            Other (custom)…
          </button>
          {isCustom && (
            <DurationChip label="custom activity" minutes={customMinutes} maxMinutes={leftMinutes + customMinutes} onChange={onCustomMinutes} />
          )}
        </div>

        {isCustom && (
          <>
            <input
              autoFocus
              value={customAnswer}
              onChange={(e) => onCustomChange(e.target.value)}
              placeholder="Describe what you did…"
              onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) { e.preventDefault(); onConfirm(); } }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40"
            />
            {customDuplicate && (
              <p className="text-[11px] text-destructive">This activity is already added for this task.</p>
            )}
          </>
        )}

        {/* Budget + confirm */}
        <div className="pt-3 border-t border-dashed border-border">
          <div className="flex items-baseline justify-between gap-2 mb-2 text-[11px] text-muted-foreground tabular-nums">
            <span>{count === 0 ? "Tick the subcategories you worked on" : `Selected ${fmtHrs(toHours(pickedTotal))}`}</span>
            <span>{full ? "No time left today" : `${fmtHrs(toHours(leftMinutes))} left today`}</span>
          </div>
          <Button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="w-full rounded-lg bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-1.5 h-9 text-sm"
          >
            <Check className="h-3.5 w-3.5" />
            {count > 1 ? `Add ${count} tasks` : "Add task"}
          </Button>
        </div>
      </div>
    </div>
  );
}
