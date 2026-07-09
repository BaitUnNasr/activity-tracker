"use client";

import { useMemo, useState } from "react";

import { Card } from "@/src/components/ui/card";
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
  type LocalDay,
} from "../../../tasks/_components/timesheet-shared";

const EMPTY_DAY: LocalDay = { halfDay: false, onLeave: false, entries: [] };

export function ActivityTimesheet({
  today,
  data,
}: {
  today: string;
  data: TasksPageData;
}) {
  const todayDate = parseISO(today);
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selected, setSelected] = useState(today);

  const serverMap = useMemo(() => buildServerMap(data), [data]);
  const holidayMap = useMemo(() => buildHolidayMap(data.holidays), [data.holidays]);
  const { dailyTarget } = data;

  const selectedDay = serverMap.get(selected) ?? EMPTY_DAY;
  const status = getDayStatus(selected, holidayMap, selectedDay, today, dailyTarget);

  const isHoliday = holidayMap.has(selected);
  const isWeekend = parseISO(selected).getDay() === 0;
  const isFuture = selected > today;
  const isLocked = isHoliday || isWeekend || isFuture;

  const total = selectedDay.entries.reduce((s, e) => s + e.hours, 0);
  const target = selectedDay.halfDay ? dailyTarget / 2 : dailyTarget;

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

  return (
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
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Activity for
                </div>
                <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
                  {fmtLong(selected)}
                </div>
              </div>
              <DayBadge status={status} />
            </div>
          </div>
        </Card>

        {isLocked ? (
          <LockedNotice holidayName={holidayMap.get(selected)} isFuture={isFuture} />
        ) : selectedDay.onLeave ? (
          <LeaveActiveCard isEditable={false} />
        ) : (
          <Card className="gap-0 py-0">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-foreground">Tasks</h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {fmtHrs(total)} / {fmtHrs(target)}{selectedDay.halfDay ? " (½)" : ""}
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
  );
}
