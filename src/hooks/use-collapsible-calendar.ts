"use client";

import { useEffect, useState } from "react";

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Mobile-collapsible month-calendar behavior. Below the lg breakpoint the
 * calendar starts collapsed to a single week row (`isRowHidden` hides the
 * others) and `handleStep` moves by week; when expanded, or on desktop, it
 * moves by month via `onStepMonth`.
 *
 * Call `clearWeekAnchor` whenever the user picks a date or jumps to today so
 * the collapsed view snaps back to the relevant week.
 */
export function useCollapsibleCalendar({
  viewYear,
  viewMonth,
  selected,
  today,
  onStepMonth,
}: {
  viewYear: number;
  viewMonth: number;
  selected: string;
  today: string;
  onStepMonth: (dir: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Tracks the lg breakpoint so the step buttons match what the CSS shows.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Week row shown while collapsed: the week-step anchor if set, else the
  // selected day's week if in the viewed month, else today's week, else the
  // first week of the month.
  const [weekAnchor, setWeekAnchor] = useState<string | null>(null);
  const startDow = new Date(viewYear, viewMonth, 1).getDay();
  const inView = (d: Date) => d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  const anchorDate = weekAnchor ? parseISO(weekAnchor) : null;
  const selDate = parseISO(selected);
  const todayDate = parseISO(today);
  const focusDay =
    anchorDate && inView(anchorDate)
      ? anchorDate.getDate()
      : inView(selDate)
        ? selDate.getDate()
        : inView(todayDate)
          ? todayDate.getDate()
          : 1;
  const focusRow = Math.floor((startDow + focusDay - 1) / 7);

  const isRowHidden = (cellIndex: number) =>
    !expanded && Math.floor(cellIndex / 7) !== focusRow;

  const handleStep = (dir: number) => {
    if (isDesktop || expanded) {
      setWeekAnchor(null);
      onStepMonth(dir);
      return;
    }
    // Collapsed: move one week; if it crosses into another month, follow it.
    const next = new Date(viewYear, viewMonth, focusDay + dir * 7);
    if (!inView(next)) onStepMonth(dir);
    setWeekAnchor(toDateStr(next));
  };

  const clearWeekAnchor = () => setWeekAnchor(null);

  return { expanded, setExpanded, isRowHidden, handleStep, clearWeekAnchor };
}
