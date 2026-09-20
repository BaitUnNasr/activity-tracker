"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
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
  ReadOnlyTaskRow,
  buildHolidayMap,
  buildServerMap,
  fmtHrs,
  fmtLong,
  getDayStatus,
  LEAVE_TYPE_OPTIONS,
  MONTHS,
  parseISO,
  taskColor,
  toDateStr,
  type LocalDay,
  type LocalEntry,
} from "./timesheet-shared";

// ─── Main client ──────────────────────────────────────────────────────────────

export function TaskInputClient({
  today,
  initialData,
}: {
  today: string;
  initialData: TasksPageData;
}) {
  const todayDate = parseISO(today);
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selected, setSelected] = useState(today);

  const [serverMap, setServerMap] = useState<Map<string, LocalDay>>(() => buildServerMap(initialData));
  const [localDay, setLocalDay] = useState<LocalDay>(
    () => serverMap.get(today) ?? { halfDay: false, onLeave: false, leaveType: null, entries: [] },
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
  const [pickedAnswer, setPickedAnswer] = useState("");
  const [isCustomAnswer, setIsCustomAnswer] = useState(false);
  const [customAnswer, setCustomAnswer] = useState("");
  const [pickedHours, setPickedHours] = useState(1);

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
        saveDay(sel, day.halfDay, day.onLeave, day.leaveType, day.entries);
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
      runSave(() => saveDay(date, snapshot.halfDay, snapshot.onLeave, snapshot.leaveType, snapshot.entries))
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
          [JSON.stringify({ date: sel, halfDay: day.halfDay, onLeave: day.onLeave, leaveType: day.leaveType, entries: day.entries })],
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
  const halfTarget = dailyTarget / 2;
  const target = localDay.halfDay ? halfTarget : dailyTarget;
  const total = localDay.entries.reduce((s, e) => s + e.hours, 0);

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
      runSave(() => saveDay(fromDate, snapshot.halfDay, snapshot.onLeave, snapshot.leaveType, snapshot.entries)).then((result) => {
        if (result.success) {
          setServerMap((prev) => new Map(prev).set(fromDate, snapshot));
        } else {
          toast.error("Auto-save failed — check your connection.");
        }
      });
    }
    setSelected(date);
    setLocalDay(serverMap.get(date) ?? { halfDay: false, onLeave: false, leaveType: null, entries: [] });
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
    if (!localDay.halfDay && total > halfTarget) {
      setHalfDayBlocked(true);
    } else {
      setConfirmHalf(true);
    }
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
        const ex = next.get(d) ?? { halfDay: false, onLeave: false, leaveType: null, entries: [] };
        next.set(d, { ...ex, halfDay: false, onLeave: true, leaveType: "earned" as LeaveType });
      }
      return next;
    });
    if (dates.includes(selected)) {
      setLocalDay((p) => ({ ...p, halfDay: false, onLeave: true, leaveType: "earned" }));
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

  const handleConfirmAdd = () => {
    if (!pickedTaskId || !pickedCategory) return;
    const answer = isCustomAnswer ? customAnswer.trim() : pickedAnswer;
    if (!answer || pickedHours <= 0) return;
    const category = pickedCategory.name;
    const taskName = initialData.tasks.find((t) => t.id === pickedTaskId)?.name;
    if (!taskName) return;
    // A subcategory can only be logged once per task+category.
    if (localDay.entries.some((e) => e.task === taskName && e.category === category && e.answer === answer)) {
      toast.error("That subcategory is already added.");
      return;
    }
    modify((c) => ({ ...c, entries: [...c.entries, { task: taskName, category, answer, hours: pickedHours }] }));
    setPickStep("none");
    setPickedTaskId(null);
    setPickedCategoryId(null);
    setPickedAnswer("");
    setIsCustomAnswer(false);
    setCustomAnswer("");
    setPickedHours(1);
  };

  const handleRemove = (task: string, category: string, answer: string) =>
    modify((c) => ({ ...c, entries: c.entries.filter((e) => !(e.task === task && e.category === category && e.answer === answer)) }));

  const handleHours = (task: string, category: string, answer: string, hours: number) =>
    modify((c) => ({
      ...c,
      entries: c.entries.map((e) => (e.task === task && e.category === category && e.answer === answer ? { ...e, hours } : e)),
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
  const chosenAnswer = isCustomAnswer ? customAnswer.trim() : pickedAnswer;
  const canConfirmAdd =
    pickedTaskId !== null &&
    pickedCategoryId !== null &&
    chosenAnswer.length > 0 &&
    pickedHours > 0 &&
    !usedAnswersForPicked.includes(chosenAnswer);

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
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mb-3">
                    {localDay.entries.length === 0 && isPast && !isEditable && pickStep === "none" && (
                      <div className="px-4 py-5 border border-dashed border-border rounded-xl text-center text-sm text-muted-foreground">
                        No tasks were logged for this day.
                      </div>
                    )}
                    {localDay.entries.map((entry) => {
                      const key = `${entry.task}::${entry.category}::${entry.answer}`;
                      if (!isEditable) {
                        return <ReadOnlyTaskRow key={key} entry={entry} />;
                      }
                      const otherHours = localDay.entries
                        .filter((e) => !(e.task === entry.task && e.category === entry.category && e.answer === entry.answer))
                        .reduce((s, e) => s + e.hours, 0);
                      return (
                        <TaskRow
                          key={key}
                          entry={entry}
                          maxHours={Math.max(0.5, target - otherHours)}
                          onHours={(h) => handleHours(entry.task, entry.category, entry.answer, h)}
                          onRemove={() => handleRemove(entry.task, entry.category, entry.answer)}
                        />
                      );
                    })}
                  </div>

                  {isEditable && pickStep === "none" && (
                    <Button
                      onClick={() => { setPickDir("fwd"); setPickStep("task"); setPickedTaskId(null); setPickedCategoryId(null); }}
                      disabled={total >= target}
                      className="w-full rounded-xl bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-2 h-10"
                    >
                      <Plus className="h-4 w-4" />
                      {total >= target ? "Daily target reached" : "Add activity"}
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
                        const remaining = Math.max(0.5, target - total);
                        setPickDir("fwd");
                        setPickedCategoryId(cid);
                        setPickStep("answer");
                        setPickedAnswer("");
                        setIsCustomAnswer(false);
                        setCustomAnswer("");
                        setPickedHours(Math.min(1, remaining));
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
                      pickedAnswer={pickedAnswer}
                      isCustom={isCustomAnswer}
                      customAnswer={customAnswer}
                      hours={pickedHours}
                      maxHours={Math.max(0.5, target - total)}
                      canConfirm={canConfirmAdd}
                      usedAnswers={usedAnswersForPicked}
                      onSelectAnswer={(a) => { setPickedAnswer(a); setIsCustomAnswer(false); }}
                      onSelectCustom={() => { setIsCustomAnswer(true); setPickedAnswer(""); }}
                      onCustomChange={setCustomAnswer}
                      onHours={setPickedHours}
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
  total, target, halfDay, entries,
}: {
  total: number; target: number; halfDay: boolean;
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
              <span className="text-sm text-muted-foreground">/ {fmtHrs(target)}{halfDay ? " (½)" : ""}</span>
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
  entry, maxHours, onHours, onRemove,
}: {
  entry: LocalEntry; maxHours: number;
  onHours: (h: number) => void; onRemove: () => void;
}) {
  const atMax = entry.hours >= maxHours;
  const stepHours = (delta: number) => {
    const n = Math.round((entry.hours + delta) * 2) / 2;
    if (n >= 0.5 && n <= maxHours) onHours(n);
  };

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 border rounded-xl transition-colors",
      atMax ? "bg-brand/5 border-brand/25" : "bg-muted border-border",
    )}>
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: taskColor(entry.task) }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-foreground truncate">{entry.task}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {entry.category ? `${entry.category} · ${entry.answer}` : entry.answer}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => stepHours(-0.5)}
          disabled={entry.hours <= 0.5}
          className="h-6 w-6 rounded-lg bg-background border border-border grid place-items-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="text-sm font-bold tabular-nums text-foreground w-10 text-center">
          {fmtHrs(entry.hours)}
        </span>
        <button
          onClick={() => stepHours(0.5)}
          disabled={atMax}
          className="h-6 w-6 rounded-lg bg-background border border-border grid place-items-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <button
        onClick={onRemove}
        className="h-6 w-6 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
      >
        <X className="h-3 w-3" />
      </button>
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

function AnswerPicker({
  task, category, pickedAnswer, isCustom, customAnswer, hours, maxHours, canConfirm, usedAnswers,
  onSelectAnswer, onSelectCustom, onCustomChange, onHours, onConfirm, onBack, anim,
}: {
  task: TaskForPicker; category: CategoryForPicker; pickedAnswer: string; isCustom: boolean; customAnswer: string;
  hours: number; maxHours: number; canConfirm: boolean; usedAnswers: string[];
  onSelectAnswer: (a: string) => void; onSelectCustom: () => void;
  onCustomChange: (v: string) => void; onHours: (h: number) => void;
  onConfirm: () => void; onBack: () => void; anim?: string;
}) {
  const atMax = hours >= maxHours;
  const customTrimmed = customAnswer.trim();
  const customDuplicate = isCustom && customTrimmed.length > 0 && usedAnswers.includes(customTrimmed);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const subs = q ? category.subcategories.filter((s) => s.label.toLowerCase().includes(q)) : category.subcategories;
  const stepH = (delta: number) => {
    const n = Math.round((hours + delta) * 2) / 2;
    if (n >= 0.5 && n <= maxHours) onHours(n);
  };

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
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">Subcategory</span>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subcategories…"
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
          const isSelected = pickedAnswer === ans.label && !isCustom;
          return (
            <button
              key={ans.id}
              type="button"
              disabled={used}
              onClick={() => onSelectAnswer(ans.label)}
              className={cn(
                "w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                used
                  ? "bg-muted/50 border-border text-muted-foreground opacity-60 cursor-not-allowed"
                  : isSelected
                    ? "bg-brand/10 border-brand/40 text-foreground"
                    : "bg-background border-border text-foreground hover:bg-muted",
              )}
            >
              <span className="truncate">
                {isSelected && <Check className="inline h-3 w-3 mr-1.5 text-foreground" />}
                {ans.label}
              </span>
              {used && <span className="text-[10px] uppercase tracking-wide shrink-0">Added</span>}
            </button>
          );
        })}

        {/* Other (custom) */}
        <button
          onClick={onSelectCustom}
          className={cn(
            "w-full text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
            isCustom
              ? "bg-brand/10 border-brand/40 text-foreground"
              : "bg-background border-border text-muted-foreground hover:bg-muted",
          )}
        >
          Other (custom)…
        </button>

        {isCustom && (
          <>
            <input
              autoFocus
              value={customAnswer}
              onChange={(e) => onCustomChange(e.target.value)}
              placeholder="Describe what you did…"
              className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40"
            />
            {customDuplicate && (
              <p className="text-[11px] text-destructive">This activity is already added for this task.</p>
            )}
          </>
        )}

        {/* Hours */}
        <div className="flex items-center gap-2 pt-1 border-t border-dashed border-border">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-muted-foreground">Hours spent</span>
            <span className="text-[10px] text-muted-foreground ml-1.5">max {fmtHrs(maxHours)}</span>
          </div>
          <button
            onClick={() => stepH(-0.5)}
            disabled={hours <= 0.5}
            className="h-7 w-7 rounded-lg bg-muted border border-border grid place-items-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="text-sm font-bold tabular-nums text-foreground w-10 text-center">{fmtHrs(hours)}</span>
          <button
            onClick={() => stepH(0.5)}
            disabled={atMax}
            className="h-7 w-7 rounded-lg bg-muted border border-border grid place-items-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Confirm */}
        <Button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="w-full rounded-lg bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-1.5 h-9 text-sm"
        >
          <Check className="h-3.5 w-3.5" />
          Add task
        </Button>
      </div>
    </div>
  );
}
