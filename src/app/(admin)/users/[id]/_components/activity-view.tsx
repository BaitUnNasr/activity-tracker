"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, CalendarClock, Check, ShieldCheck, Trash2 } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { HeaderGlow, StatusPill } from "@/src/components/page-ui";
import type { TasksPageData } from "../../../tasks/actions";
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
  parseISO,
  toDateStr,
  type LocalDay,
} from "../../../tasks/_components/timesheet-shared";
import { BackButton } from "./back-button";
import { grantBackdate, revokeBackdate } from "../activity/actions";

const EMPTY_DAY: LocalDay = { halfDay: false, onLeave: false, leaveType: null, entries: [] };

function fmt(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export function ActivityView({
  target,
  backHref,
  today,
  data,
  grantedDates,
}: {
  target: { id: string; name: string; designation: string | null; branch: string | null };
  backHref: string;
  today: string;
  data: TasksPageData;
  grantedDates: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmMode, setConfirmMode] = useState<null | "grant" | "revoke">(null);

  const todayDate = parseISO(today);
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selected, setSelected] = useState(today);

  const serverMap = useMemo(() => buildServerMap(data), [data]);
  const holidayMap = useMemo(() => buildHolidayMap(data.holidays), [data.holidays]);
  const grantedSet = useMemo(() => new Set(grantedDates), [grantedDates]);
  const { dailyTarget } = data;

  const selectedDay = serverMap.get(selected) ?? EMPTY_DAY;
  const status = getDayStatus(selected, holidayMap, selectedDay, today, dailyTarget);

  const isHoliday = holidayMap.has(selected);
  const isWeekend = parseISO(selected).getDay() === 0;
  const isFuture = selected > today;
  const isPast = selected < today;
  const isLocked = isHoliday || isWeekend || isFuture;

  const total = selectedDay.entries.reduce((s, e) => s + e.hours, 0);
  const target_ = selectedDay.halfDay ? dailyTarget / 2 : dailyTarget;

  // Backdate-access state for the currently selected day. Yesterday and today
  // are inside the user's own edit grace window, so no grant is needed there —
  // only older working days are grantable.
  const yesterday = toDateStr(
    new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 1),
  );
  const isGraceWindow = selected === yesterday || selected === today;
  const isGranted = grantedSet.has(selected);
  const isBackdatable = selected < yesterday && !isWeekend && !isHoliday; // older past working day
  const grantMode: "grant" | "revoke" | "none" = isGranted
    ? "revoke"
    : isBackdatable
      ? "grant"
      : "none";
  const buttonEnabled = grantMode !== "none";

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
    setSelected(today);
  };

  const runConfirm = () => {
    const mode = confirmMode;
    if (!mode) return;
    const date = selected;
    startTransition(async () => {
      const res = mode === "grant"
        ? await grantBackdate(target.id, date)
        : await revokeBackdate(target.id, date);
      if (res.success) {
        toast.success(
          mode === "grant"
            ? `${target.name} can now log tasks for ${fmt(date)}.`
            : `Backdated access revoked for ${fmt(date)}.`,
        );
        setConfirmMode(null);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <div className="mt-6">
      {/* Back + header */}
      <div className="relative isolate flex items-center gap-3 mb-6">
        <HeaderGlow />
        <BackButton fallbackHref={backHref} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <StatusPill tone="active">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/80" />
              Activity
            </StatusPill>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted ring-1 ring-border text-xs font-medium text-muted-foreground">
              {target.designation ?? "—"}
              <span className="opacity-40">·</span>
              <Building2 className="h-3.5 w-3.5" />
              {target.branch ?? "—"}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-none">
            {target.name}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Select a past day to grant backdated task entry.
          </p>
        </div>

        {/* Backdate access button — enabled once a valid past day is selected */}
        <button
          onClick={() => setConfirmMode(grantMode === "none" ? null : grantMode)}
          disabled={!buttonEnabled || pending}
          className={cn(
            "ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold ring-1 shadow-sm transition-all active:scale-[0.98] shrink-0",
            "disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100",
            grantMode === "revoke"
              ? "bg-destructive/10 text-destructive ring-destructive/25 hover:bg-destructive/15"
              : "bg-brand text-foreground ring-foreground/10 hover:brightness-105",
          )}
          title={
            buttonEnabled
              ? undefined
              : isGraceWindow && isPast
                ? "The user can still edit yesterday themselves — no access needed"
                : "Select a working day older than yesterday (not a holiday or Sunday) to grant access"
          }
        >
          <CalendarClock className="h-4 w-4" />
          {grantMode === "revoke" ? "Revoke backdate access" : "Backdate access"}
        </button>
      </div>

      {/* Timesheet */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-5 items-start">
        <CalendarCard
          viewYear={viewYear}
          viewMonth={viewMonth}
          selected={selected}
          today={today}
          holidayMap={holidayMap}
          serverMap={serverMap}
          localDay={selectedDay}
          dailyTarget={dailyTarget}
          onSelectDate={setSelected}
          onStepMonth={stepMonth}
          onGoToday={goToday}
        />

        <aside className="flex flex-col gap-4">
          {/* Day header */}
          <Card className="gap-0 py-0">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Activity for
                  </div>
                  <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
                    {fmtLong(selected)}
                  </div>
                </div>
                <DayBadge status={status} />
              </div>
              {isGranted && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/15 ring-1 ring-brand/30 text-xs font-semibold text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Backdated logging allowed
                </div>
              )}
              {!isGranted && isGraceWindow && !isLocked && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted ring-1 ring-border text-xs font-medium text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Still editable by the user — no access needed
                </div>
              )}
            </div>
          </Card>

          {selectedDay.onLeave && !isHoliday && !isWeekend ? (
            <LeaveActiveCard active={selected >= today} leaveType={selectedDay.leaveType} />
          ) : isLocked ? (
            <LockedNotice holidayName={holidayMap.get(selected)} isFuture={isFuture} />
          ) : (
            <Card className="gap-0 py-0">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-foreground">Tasks</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {fmtHrs(total)} / {fmtHrs(target_)}{selectedDay.halfDay ? " (½)" : ""}
                  </span>
                </div>

                {selectedDay.entries.length === 0 ? (
                  <div className="px-4 py-6 border border-dashed border-border rounded-xl text-center text-sm text-muted-foreground">
                    No tasks were logged for this day.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedDay.entries.map((entry) => {
                      const task = data.tasks.find((t) => t.id === entry.taskId);
                      if (!task) return null;
                      return <ReadOnlyTaskRow key={entry.taskId} task={task} entry={entry} />;
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}
        </aside>
      </div>

      {/* Confirm dialog */}
      {confirmMode && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !pending && setConfirmMode(null)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4">
              <div
                className={cn(
                  "h-10 w-10 rounded-full grid place-items-center mb-4 ring-1",
                  confirmMode === "grant"
                    ? "bg-brand/15 ring-brand/30 text-foreground"
                    : "bg-destructive/10 ring-destructive/20 text-destructive",
                )}
              >
                {confirmMode === "grant" ? <ShieldCheck className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {confirmMode === "grant" ? "Allow backdated entry?" : "Revoke backdated entry?"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                {confirmMode === "grant" ? (
                  <>
                    <span className="font-medium text-foreground">{target.name}</span> will be able to add
                    and edit tasks for{" "}
                    <span className="font-medium text-foreground">{fmt(selected)}</span>.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-foreground">{target.name}</span> will no longer be able
                    to log tasks for{" "}
                    <span className="font-medium text-foreground">{fmt(selected)}</span>.
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setConfirmMode(null)}
                disabled={pending}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                onClick={runConfirm}
                disabled={pending}
                className={cn(
                  "rounded-full gap-2",
                  confirmMode === "grant"
                    ? "bg-brand text-foreground hover:bg-brand hover:brightness-105"
                    : "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                )}
              >
                <Check className="h-3.5 w-3.5" />
                {pending
                  ? "Saving…"
                  : confirmMode === "grant"
                    ? "Allow entry"
                    : "Revoke"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
