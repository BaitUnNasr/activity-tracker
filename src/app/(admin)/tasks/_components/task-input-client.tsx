"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { saveDay, type TaskForPicker, type TasksPageData } from "../actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalEntry = { taskId: number; answer: string; hours: number };
type LocalDay = { halfDay: boolean; onLeave: boolean; entries: LocalEntry[] };

type DayStatus =
  | "complete"
  | "partial"
  | "missing"
  | "half"
  | "leave"
  | "holiday"
  | "weekend"
  | "future"
  | "today-empty";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TASK_COLORS = [
  "#9bc81f", "#5b8def", "#e0a35c", "#e0698f",
  "#39b3a6", "#8b7ce0", "#c98a3a", "#d94f4f",
];

type StatusMeta = {
  cellBg: string;
  cellBorder: string;
  cellText: string;
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  dotColor: string;
};

const STATUS_META: Record<DayStatus, StatusMeta> = {
  complete: { cellBg: "bg-green-50 dark:bg-green-950/20", cellBorder: "border-green-200 dark:border-green-800", cellText: "text-green-700 dark:text-green-400", label: "Logged", badgeBg: "bg-green-50 dark:bg-green-950/30", badgeBorder: "border-green-200 dark:border-green-800", badgeText: "text-green-700 dark:text-green-400", dotColor: "bg-green-500" },
  partial: { cellBg: "bg-amber-50 dark:bg-amber-950/20", cellBorder: "border-amber-200 dark:border-amber-800", cellText: "text-amber-700 dark:text-amber-400", label: "Under target", badgeBg: "bg-amber-50 dark:bg-amber-950/30", badgeBorder: "border-amber-200 dark:border-amber-800", badgeText: "text-amber-700 dark:text-amber-400", dotColor: "bg-amber-500" },
  missing: { cellBg: "bg-red-50 dark:bg-red-950/20", cellBorder: "border-red-200 dark:border-red-800", cellText: "text-red-700 dark:text-red-400", label: "Not logged", badgeBg: "bg-red-50 dark:bg-red-950/30", badgeBorder: "border-red-200 dark:border-red-800", badgeText: "text-red-700 dark:text-red-400", dotColor: "bg-red-500" },
  half: { cellBg: "bg-amber-50 dark:bg-amber-950/20", cellBorder: "border-amber-200 dark:border-amber-800", cellText: "text-amber-700 dark:text-amber-400", label: "Half day", badgeBg: "bg-amber-50 dark:bg-amber-950/30", badgeBorder: "border-amber-200 dark:border-amber-800", badgeText: "text-amber-700 dark:text-amber-400", dotColor: "bg-amber-500" },
  leave: { cellBg: "bg-sky-50 dark:bg-sky-950/20", cellBorder: "border-sky-200 dark:border-sky-800", cellText: "text-sky-700 dark:text-sky-400", label: "Leave", badgeBg: "bg-sky-50 dark:bg-sky-950/30", badgeBorder: "border-sky-200 dark:border-sky-800", badgeText: "text-sky-700 dark:text-sky-400", dotColor: "bg-sky-500" },
  holiday: { cellBg: "bg-indigo-50 dark:bg-indigo-950/20", cellBorder: "border-indigo-200 dark:border-indigo-800", cellText: "text-indigo-700 dark:text-indigo-400", label: "Holiday", badgeBg: "bg-indigo-50 dark:bg-indigo-950/30", badgeBorder: "border-indigo-200 dark:border-indigo-800", badgeText: "text-indigo-700 dark:text-indigo-400", dotColor: "bg-indigo-500" },
  weekend: { cellBg: "bg-muted", cellBorder: "border-border", cellText: "text-muted-foreground", label: "Sunday", badgeBg: "bg-muted", badgeBorder: "border-border", badgeText: "text-muted-foreground", dotColor: "bg-muted-foreground/40" },
  future: { cellBg: "bg-background", cellBorder: "border-border", cellText: "text-muted-foreground", label: "Upcoming", badgeBg: "bg-muted", badgeBorder: "border-border", badgeText: "text-muted-foreground", dotColor: "bg-muted-foreground/40" },
  "today-empty": { cellBg: "bg-background", cellBorder: "border-foreground", cellText: "text-foreground", label: "Today · not logged", badgeBg: "bg-background", badgeBorder: "border-border", badgeText: "text-muted-foreground", dotColor: "bg-foreground" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtHrs(n: number): string {
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtLong(s: string): string {
  return parseISO(s).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function taskColor(taskId: number): string {
  return TASK_COLORS[(taskId - 1) % TASK_COLORS.length];
}

function buildHolidayMap(holidays: { name: string; startDate: string; endDate: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  holidays.forEach((h) => {
    const cur = parseISO(h.startDate);
    while (toDateStr(cur) <= h.endDate) {
      map.set(toDateStr(cur), h.name);
      cur.setDate(cur.getDate() + 1);
    }
  });
  return map;
}

function buildServerMap(data: TasksPageData): Map<string, LocalDay> {
  const map = new Map<string, LocalDay>();
  const byDate = new Map<string, LocalEntry[]>();
  data.entries.forEach((e) => {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push({ taskId: e.taskId, answer: e.answer, hours: e.hours });
  });
  const allDates = new Set([...byDate.keys(), ...data.dayMetas.map((m) => m.date)]);
  allDates.forEach((date) => {
    const meta = data.dayMetas.find((m) => m.date === date);
    map.set(date, { halfDay: meta?.halfDay ?? false, onLeave: meta?.onLeave ?? false, entries: byDate.get(date) ?? [] });
  });
  return map;
}

function getDayStatus(
  dateStr: string,
  holidayMap: Map<string, string>,
  dayData: LocalDay | undefined,
  today: string,
  dailyTarget: number,
): DayStatus {
  if (holidayMap.has(dateStr)) return "holiday";
  const dow = parseISO(dateStr).getDay();
  if (dow === 0) return "weekend"; // Sunday only — Mon–Sat are working days
  if (dateStr > today) return "future";
  if (dayData?.onLeave) return "leave";
  const total = dayData?.entries.reduce((s, e) => s + e.hours, 0) ?? 0;
  const target = dayData?.halfDay ? dailyTarget / 2 : dailyTarget;
  if (!dayData || total === 0) return dateStr === today ? "today-empty" : "missing";
  if (dayData.halfDay) return "half";
  if (total >= target) return "complete";
  return "partial";
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function TaskInputClient({
  userId,
  today,
  initialData,
}: {
  userId: string;
  today: string;
  initialData: TasksPageData;
}) {
  const todayDate = parseISO(today);
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selected, setSelected] = useState(today);

  const [serverMap, setServerMap] = useState<Map<string, LocalDay>>(() => buildServerMap(initialData));
  const [localDay, setLocalDay] = useState<LocalDay>(
    () => serverMap.get(today) ?? { halfDay: false, onLeave: false, entries: [] },
  );
  const [isDirty, setIsDirty] = useState(false);
  const [confirmHalf, setConfirmHalf] = useState(false);
  const [halfDayBlocked, setHalfDayBlocked] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Add-task picker state
  const [pickStep, setPickStep] = useState<"none" | "task" | "answer">("none");
  const [pickedTaskId, setPickedTaskId] = useState<number | null>(null);
  const [pickedAnswer, setPickedAnswer] = useState("");
  const [isCustomAnswer, setIsCustomAnswer] = useState(false);
  const [customAnswer, setCustomAnswer] = useState("");
  const [pickedHours, setPickedHours] = useState(1);

  // Ref always holds the latest dirty state so cleanup effects read current values.
  const stateRef = useRef({ isDirty, selected, localDay });
  useEffect(() => { stateRef.current = { isDirty, selected, localDay }; });

  // Auto-save on unmount (soft navigation away from this page).
  useEffect(() => {
    return () => {
      const { isDirty: dirty, selected: sel, localDay: day } = stateRef.current;
      if (dirty) {
        saveDay(userId, sel, day.halfDay, day.onLeave, day.entries);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const holidayMap = useMemo(() => buildHolidayMap(initialData.holidays), [initialData.holidays]);
  const { dailyTarget } = initialData;
  const halfTarget = dailyTarget / 2;
  const target = localDay.halfDay ? halfTarget : dailyTarget;
  const total = localDay.entries.reduce((s, e) => s + e.hours, 0);

  const isHoliday = holidayMap.has(selected);
  const isWeekend = parseISO(selected).getDay() === 0; // Sunday only
  const isToday = selected === today;
  const isFuture = selected > today;
  const isPast = selected < today;
  const isLocked = isHoliday || isWeekend || isFuture;
  const isEditable = isToday && !isLocked;

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
      saveDay(userId, fromDate, snapshot.halfDay, snapshot.onLeave, snapshot.entries).then((result) => {
        if (result.success) {
          setServerMap((prev) => new Map(prev).set(fromDate, snapshot));
        } else {
          toast.error("Auto-save failed — check your connection.");
        }
      });
    }
    setSelected(date);
    setLocalDay(serverMap.get(date) ?? { halfDay: false, onLeave: false, entries: [] });
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
    modify((c) => ({ ...c, halfDay: !c.halfDay, onLeave: false }));
    setConfirmHalf(false);
  };

  const handleToggleLeave = () => setConfirmLeave(true);
  const confirmToggleLeave = () => {
    modify((c) => ({ ...c, onLeave: !c.onLeave, halfDay: false }));
    setConfirmLeave(false);
  };

  const handleConfirmAdd = () => {
    if (!pickedTaskId) return;
    const answer = isCustomAnswer ? customAnswer.trim() : pickedAnswer;
    if (!answer || pickedHours <= 0) return;
    modify((c) => ({ ...c, entries: [...c.entries, { taskId: pickedTaskId, answer, hours: pickedHours }] }));
    setPickStep("none");
    setPickedTaskId(null);
    setPickedAnswer("");
    setIsCustomAnswer(false);
    setCustomAnswer("");
    setPickedHours(1);
  };

  const handleRemove = (taskId: number) =>
    modify((c) => ({ ...c, entries: c.entries.filter((e) => e.taskId !== taskId) }));

  const handleHours = (taskId: number, hours: number) =>
    modify((c) => ({ ...c, entries: c.entries.map((e) => e.taskId === taskId ? { ...e, hours } : e) }));

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

  const availableTasks = initialData.tasks.filter(
    (t) => !localDay.entries.some((e) => e.taskId === t.id),
  );
  const pickedTask = initialData.tasks.find((t) => t.id === pickedTaskId) ?? null;
  const canConfirmAdd = pickedTaskId !== null && (
    isCustomAnswer ? customAnswer.trim().length > 0 : pickedAnswer.length > 0
  ) && pickedHours > 0;

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
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

          {isLocked ? (
            <LockedNotice holidayName={holidayMap.get(selected)} isFuture={isFuture} />
          ) : localDay.onLeave ? (
            <LeaveActiveCard isEditable={isEditable} onToggle={handleToggleLeave} />
          ) : (
            <>
              {/* Progress */}
              <ProgressCard
                total={total}
                target={target}
                halfDay={localDay.halfDay}
                entries={localDay.entries}
                tasks={initialData.tasks}
              />

              {/* Task list */}
              <Card className="gap-0 py-0">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-foreground">Tasks</h3>
                    <span className="text-xs text-muted-foreground">{localDay.entries.length} logged</span>
                  </div>

                  {localDay.entries.length === 0 && isEditable && pickStep === "none" && (
                    <div className="px-4 py-5 border border-dashed border-border rounded-xl text-center text-sm text-muted-foreground mb-3">
                      No tasks yet — add one below.
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mb-3">
                    {localDay.entries.length === 0 && isPast && pickStep === "none" && (
                      <div className="px-4 py-5 border border-dashed border-border rounded-xl text-center text-sm text-muted-foreground">
                        No tasks were logged for this day.
                      </div>
                    )}
                    {localDay.entries.map((entry) => {
                      const task = initialData.tasks.find((t) => t.id === entry.taskId);
                      if (!task) return null;
                      if (!isEditable) {
                        return <ReadOnlyTaskRow key={entry.taskId} task={task} entry={entry} />;
                      }
                      const otherHours = localDay.entries
                        .filter((e) => e.taskId !== entry.taskId)
                        .reduce((s, e) => s + e.hours, 0);
                      return (
                        <TaskRow
                          key={entry.taskId}
                          task={task}
                          entry={entry}
                          maxHours={Math.max(0.5, target - otherHours)}
                          onHours={(h) => handleHours(entry.taskId, h)}
                          onRemove={() => handleRemove(entry.taskId)}
                        />
                      );
                    })}
                  </div>

                  {isEditable && pickStep === "none" && (
                    <Button
                      onClick={() => { setPickStep("task"); setPickedTaskId(null); }}
                      disabled={availableTasks.length === 0 || total >= target}
                      className="w-full rounded-xl bg-brand text-gray-900 hover:bg-brand hover:brightness-105 gap-2 h-10"
                    >
                      <Plus className="h-4 w-4" />
                      {total >= target
                        ? "Daily target reached"
                        : availableTasks.length === 0
                          ? "All tasks added"
                          : "Add task"}
                    </Button>
                  )}

                  {isEditable && pickStep === "task" && (
                    <TaskPicker
                      tasks={availableTasks}
                      onPick={(id) => {
                        const remaining = Math.max(0.5, target - total);
                        setPickedTaskId(id);
                        setPickStep("answer");
                        setPickedAnswer("");
                        setIsCustomAnswer(false);
                        setCustomAnswer("");
                        setPickedHours(Math.min(1, remaining));
                      }}
                      onCancel={() => setPickStep("none")}
                    />
                  )}

                  {isEditable && pickStep === "answer" && pickedTask && (
                    <AnswerPicker
                      task={pickedTask}
                      pickedAnswer={pickedAnswer}
                      isCustom={isCustomAnswer}
                      customAnswer={customAnswer}
                      hours={pickedHours}
                      maxHours={Math.max(0.5, target - total)}
                      canConfirm={canConfirmAdd}
                      onSelectAnswer={(a) => { setPickedAnswer(a); setIsCustomAnswer(false); }}
                      onSelectCustom={() => { setIsCustomAnswer(true); setPickedAnswer(""); }}
                      onCustomChange={setCustomAnswer}
                      onHours={setPickedHours}
                      onConfirm={handleConfirmAdd}
                      onBack={() => setPickStep("task")}
                    />
                  )}

                  {isPast && (
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

      {confirmLeave && isEditable && (
        <LeaveConfirmModal
          removing={localDay.onLeave}
          hasEntries={localDay.entries.length > 0}
          onConfirm={confirmToggleLeave}
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

// ─── Calendar card ────────────────────────────────────────────────────────────

function CalendarCard({
  viewYear, viewMonth, selected, today,
  holidayMap, serverMap, localDay, dailyTarget,
  onSelectDate, onStepMonth, onGoToday,
}: {
  viewYear: number; viewMonth: number; selected: string; today: string;
  holidayMap: Map<string, string>; serverMap: Map<string, LocalDay>;
  localDay: LocalDay; dailyTarget: number;
  onSelectDate: (d: string) => void; onStepMonth: (dir: number) => void; onGoToday: () => void;
}) {
  const startDow = new Date(viewYear, viewMonth, 1).getDay();
  const dim = new Date(viewYear, viewMonth + 1, 0).getDate();
  const totalCells = Math.ceil((startDow + dim) / 7) * 7;

  const cells: { inMonth: boolean; dn: number; i: number }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dn = i - startDow + 1;
    cells.push({ inMonth: dn >= 1 && dn <= dim, dn, i });
  }

  return (
    <Card className="gap-0">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2.5 text-xl font-bold">
          <div className="h-7 w-7 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center shrink-0">
            <CalendarDays className="h-3.5 w-3.5 text-brand" />
          </div>
          {MONTHS[viewMonth]} {viewYear}
        </CardTitle>
        <CardDescription>Pick a day to log or review your tasks.</CardDescription>
        <CardAction>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-sm" onClick={() => onStepMonth(-1)} className="rounded-full">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onGoToday} className="rounded-full px-3 text-xs font-medium">
              Today
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => onStepMonth(1)} className="rounded-full">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="py-1.5 text-center text-[11px] font-medium text-muted-foreground tracking-wide">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map(({ inMonth, dn, i }) => {
            if (!inMonth) return <div key={i} />;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dn).padStart(2, "0")}`;
            const dayData = dateStr === selected ? localDay : serverMap.get(dateStr);
            const status = getDayStatus(dateStr, holidayMap, dayData, today, dailyTarget);
            const meta = STATUS_META[status];
            const isSelected = dateStr === selected;
            const isToday = dateStr === today;
            const entryTotal = dayData?.entries.reduce((s, e) => s + e.hours, 0) ?? 0;
            const holidayName = holidayMap.get(dateStr);

            return (
              <button
                key={i}
                onClick={() => onSelectDate(dateStr)}
                title={holidayName}
                className={cn(
                  "relative h-[72px] w-full rounded-xl border-[1.5px] p-2 text-left flex flex-col justify-between transition-all overflow-hidden hover:brightness-[0.97]",
                  meta.cellBg,
                  isSelected
                    ? "border-foreground/50 ring-2 ring-foreground/20 ring-offset-1 ring-offset-background"
                    : meta.cellBorder,
                )}
              >
                {/* Half-day diagonal tint */}
                {dayData?.halfDay && (
                  <span className="absolute inset-0 bg-gradient-to-br from-transparent to-amber-500/10 pointer-events-none" />
                )}
                {/* Today ring */}
                {isToday && !isSelected && (
                  <span className="absolute inset-0 ring-2 ring-inset ring-brand rounded-[10px] pointer-events-none" />
                )}

                <div className="flex justify-between items-start relative">
                  <span className={cn(
                    "text-[13px] leading-none font-medium",
                    isToday
                      ? "bg-foreground text-background rounded-full w-[22px] h-[22px] flex items-center justify-center font-bold text-[12px]"
                      : meta.cellText,
                  )}>
                    {dn}
                  </span>
                  {status === "complete" && <Check className={cn("h-3 w-3 shrink-0", meta.cellText)} />}
                  {status === "missing" && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                  {dayData?.halfDay && <span className={cn("text-[11px] font-extrabold shrink-0", meta.cellText)}>½</span>}
                  {status === "leave" && <span className={cn("text-[11px] font-extrabold shrink-0", meta.cellText)}>L</span>}
                </div>

                <div className="absolute left-2 right-2 bottom-2">
                  {status === "leave" && (
                    <span className={cn("text-[10px] font-semibold", meta.cellText)}>Leave</span>
                  )}
                  {status === "holiday" && (
                    <span className={cn("text-[10px] font-semibold truncate block", meta.cellText)}>
                      {holidayName}
                    </span>
                  )}
                  {(status === "complete" || status === "partial" || status === "half") && (
                    <span className={cn("text-[11px] font-bold tabular-nums", meta.cellText)}>
                      {fmtHrs(entryTotal)}{dayData?.halfDay ? " · ½" : ""}
                    </span>
                  )}
                  {status === "missing" && (
                    <span className={cn("text-[10px] font-semibold", meta.cellText)}>Not logged</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-5 pt-4 border-t border-dashed border-border">
          {[
            { color: "bg-green-500", label: "Logged" },
            { color: "bg-amber-500", label: "Under target" },
            { color: "bg-red-500", label: "Not logged" },
            { color: "bg-sky-500", label: "Leave" },
            { color: "bg-indigo-500", label: "Holiday" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-[3px] shrink-0", color)} />
              {label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">½</span>
            Half day
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Day badge ────────────────────────────────────────────────────────────────

function DayBadge({ status }: { status: DayStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11.5px] font-semibold shrink-0",
      m.badgeBg, m.badgeBorder, m.badgeText,
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", m.dotColor)} />
      {m.label}
    </span>
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

// ─── Leave active card ────────────────────────────────────────────────────────

function LeaveActiveCard({ isEditable, onToggle }: { isEditable: boolean; onToggle: () => void }) {
  return (
    <div className={cn(
      "rounded-3xl border px-6 py-8 text-center",
      "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800",
    )}>
      <div className="text-base font-bold text-sky-700 dark:text-sky-400">
        {isEditable ? "On Leave" : "Was on Leave"}
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        No tasks required for this day.
      </p>
      {isEditable && (
        <Button
          onClick={onToggle}
          variant="outline"
          className="mt-4 rounded-full text-xs border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-950/40"
        >
          Remove leave
        </Button>
      )}
    </div>
  );
}

// ─── Leave confirm modal ──────────────────────────────────────────────────────

function LeaveConfirmModal({
  removing,
  hasEntries,
  onConfirm,
  onCancel,
}: {
  removing: boolean;
  hasEntries: boolean;
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
                  : "No tasks will be required for this day."}
              </p>
            </div>
          </div>

          {!removing && hasEntries && (
            <div className="rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 px-4 py-3 text-[12.5px] text-sky-700 dark:text-sky-400">
              Your logged tasks will be preserved and restored if you remove leave later.
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
          <Button onClick={onClose} className="rounded-full bg-brand text-gray-900 hover:bg-brand hover:brightness-105 px-5">
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

// ─── Locked notice ────────────────────────────────────────────────────────────

function LockedNotice({ holidayName, isFuture }: { holidayName?: string; isFuture?: boolean }) {
  if (isFuture) {
    return (
      <div className="rounded-3xl border px-6 py-8 text-center bg-muted border-border">
        <div className="text-base font-bold text-muted-foreground">Upcoming</div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Task input is only available for today.
        </p>
      </div>
    );
  }
  const isHoliday = !!holidayName;
  return (
    <div className={cn(
      "rounded-3xl border px-6 py-8 text-center",
      isHoliday
        ? "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800"
        : "bg-muted border-border",
    )}>
      <div className={cn("text-base font-bold", isHoliday ? "text-indigo-700 dark:text-indigo-400" : "text-muted-foreground")}>
        {isHoliday ? holidayName : "Sunday"}
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {isHoliday ? "Company holiday — no task input required." : "No task input required on Sundays."}
      </p>
    </div>
  );
}

// ─── Read-only task row (past days) ──────────────────────────────────────────

function ReadOnlyTaskRow({ task, entry }: { task: TaskForPicker; entry: LocalEntry }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/50 border border-border/60 rounded-xl">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: taskColor(task.id) }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-foreground truncate">{task.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{entry.answer}</div>
      </div>
      <span className="text-sm font-semibold tabular-nums text-muted-foreground shrink-0">
        {fmtHrs(entry.hours)}
      </span>
    </div>
  );
}

// ─── Progress card ────────────────────────────────────────────────────────────

function ProgressCard({
  total, target, halfDay, entries, tasks,
}: {
  total: number; target: number; halfDay: boolean;
  entries: LocalEntry[]; tasks: TaskForPicker[];
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
              const taskName = tasks.find((t) => t.id === e.taskId)?.name ?? "Unknown";
              const w = (e.hours / max) * 100;
              return (
                <TooltipProvider key={e.taskId}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="h-full border-r border-white/60 last:border-0 cursor-default"
                        style={{ width: `${w}%`, background: taskColor(e.taskId) }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: taskColor(e.taskId) }} />
                        <span>{taskName}: {fmtHrs(e.hours)}</span>
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
  task, entry, maxHours, onHours, onRemove,
}: {
  task: TaskForPicker; entry: LocalEntry; maxHours: number;
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
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: taskColor(task.id) }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-foreground truncate">{task.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{entry.answer}</div>
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
  tasks, onPick, onCancel,
}: {
  tasks: TaskForPicker[]; onPick: (id: number) => void; onCancel: () => void;
}) {
  return (
    <div className="mt-2 border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Select task</span>
        <button onClick={onCancel} className="h-5 w-5 grid place-items-center rounded text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="max-h-48 overflow-y-auto [scrollbar-width:thin]">
        {tasks.map((t, idx) => (
          <li key={t.id}>
            <button
              onClick={() => onPick(t.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-0"
            >
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: taskColor(t.id) }} />
              <span className="text-sm font-medium text-foreground flex-1 truncate">{t.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{t.answers.length} options</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Answer picker ────────────────────────────────────────────────────────────

function AnswerPicker({
  task, pickedAnswer, isCustom, customAnswer, hours, maxHours, canConfirm,
  onSelectAnswer, onSelectCustom, onCustomChange, onHours, onConfirm, onBack,
}: {
  task: TaskForPicker; pickedAnswer: string; isCustom: boolean; customAnswer: string;
  hours: number; maxHours: number; canConfirm: boolean;
  onSelectAnswer: (a: string) => void; onSelectCustom: () => void;
  onCustomChange: (v: string) => void; onHours: (h: number) => void;
  onConfirm: () => void; onBack: () => void;
}) {
  const atMax = hours >= maxHours;
  const stepH = (delta: number) => {
    const n = Math.round((hours + delta) * 2) / 2;
    if (n >= 0.5 && n <= maxHours) onHours(n);
  };

  return (
    <div className="mt-2 border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b border-border">
        <button onClick={onBack} className="h-5 w-5 grid place-items-center rounded text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: taskColor(task.id) }} />
          <span className="text-xs font-semibold text-foreground truncate">{task.name}</span>
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">Answer</span>
      </div>

      {/* Answer options */}
      <div className="p-3 space-y-1.5">
        {task.answers.map((ans) => (
          <button
            key={ans.id}
            onClick={() => onSelectAnswer(ans.label)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
              pickedAnswer === ans.label && !isCustom
                ? "bg-brand/10 border-brand/40 text-foreground"
                : "bg-background border-border text-foreground hover:bg-muted",
            )}
          >
            {pickedAnswer === ans.label && !isCustom && <Check className="inline h-3 w-3 mr-1.5 text-brand" />}
            {ans.label}
          </button>
        ))}

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
          <input
            autoFocus
            value={customAnswer}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="Describe what you did…"
            className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40"
          />
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
          className="w-full rounded-lg bg-brand text-gray-900 hover:bg-brand hover:brightness-105 gap-1.5 h-9 text-sm"
        >
          <Check className="h-3.5 w-3.5" />
          Add task
        </Button>
      </div>
    </div>
  );
}
