"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
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
import { HeaderGlow, IconChip } from "@/src/components/page-ui";
import { CalendarWeekToggle } from "@/src/components/calendar-week-toggle";
import { useCollapsibleCalendar } from "@/src/hooks/use-collapsible-calendar";
import { PersonRow, TargetBar } from "../../dashboard/_components/user-list-card";
import type { BacklogData } from "../data";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

// The page keys this component by month, so selection resets on navigation.
export function BacklogClient({ data }: { data: BacklogData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [year, month] = data.month.split("-").map(Number).map((n, i) => (i ? n - 1 : n));
  const [selectedDate, setSelectedDate] = useState(
    data.today.startsWith(data.month) ? data.today : `${data.month}-01`,
  );
  const [query, setQuery] = useState("");

  const monthTotal = useMemo(
    () => Object.values(data.days).reduce((s, rows) => s + rows.length, 0),
    [data.days],
  );

  const goMonth = (y: number, m: number) => {
    const d = new Date(y, m, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    startTransition(() => router.push(`/backlog?month=${next}`));
  };
  const stepMonth = (dir: number) => goMonth(year, month + dir);
  const goToday = () => {
    if (data.today.startsWith(data.month)) setSelectedDate(data.today);
    else startTransition(() => router.push("/backlog"));
  };

  return (
    <>
      <div className="relative isolate flex flex-wrap items-end justify-between gap-4">
        <HeaderGlow />
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">Backlog</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Employees who haven&apos;t logged their full working hours for a day.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/15 border border-brand/25 text-xs font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {MONTHS[month]} {year}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted border border-border text-xs text-muted-foreground">
              {monthTotal} pending {monthTotal === 1 ? "entry" : "entries"} this month
            </span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "mt-6 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5 items-start transition-opacity",
          isPending && "opacity-60",
        )}
      >
        <CalendarCard
          year={year}
          month={month}
          data={data}
          stepMonth={stepMonth}
          goToday={goToday}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
        <SidePanel
          data={data}
          selectedDate={selectedDate}
          query={query}
          setQuery={setQuery}
        />
      </div>
    </>
  );
}

// ─── Calendar Card ────────────────────────────────────────────────────────────

function CalendarCard({
  year,
  month,
  data,
  stepMonth,
  goToday,
  selectedDate,
  setSelectedDate,
}: {
  year: number;
  month: number;
  data: BacklogData;
  stepMonth: (dir: number) => void;
  goToday: () => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
}) {
  const startDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  const { expanded, setExpanded, isRowHidden, handleStep, clearWeekAnchor } =
    useCollapsibleCalendar({
      viewYear: year,
      viewMonth: month,
      selected: selectedDate,
      today: data.today,
      onStepMonth: stepMonth,
    });

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2.5 text-xl font-bold">
          <IconChip size="sm"><CalendarIcon className="h-3.5 w-3.5 text-foreground" /></IconChip>
          {MONTHS[month]} {year}
        </CardTitle>
        <CardDescription>Click a day to see who is behind.</CardDescription>
        <CardAction>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-sm" onClick={() => handleStep(-1)} className="rounded-full">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { clearWeekAnchor(); goToday(); }}
              className="rounded-full px-3 text-xs font-medium"
            >
              Today
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => handleStep(1)} className="rounded-full">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {DAYS.map((d) => (
            <div key={d} className="py-1.5 text-center text-[11px] font-medium text-muted-foreground tracking-wide">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {Array.from({ length: totalCells }, (_, idx) => {
            const dayNum = idx - startDow + 1;
            if (dayNum < 1 || dayNum > daysInMonth) {
              return <div key={idx} className={cn(isRowHidden(idx) && "hidden lg:block")} />;
            }
            const key = toDateKey(year, month, dayNum);
            const count = data.days[key]?.length ?? 0;
            const holiday = data.holidays[key];
            const isSelected = key === selectedDate;
            const muted = key > data.today || holiday || parseISO(key).getDay() === 0;
            return (
              <Button
                key={idx}
                type="button"
                variant="ghost"
                title={holiday}
                onClick={() => { clearWeekAnchor(); setSelectedDate(key); }}
                className={cn(
                  "relative h-[45px] md:h-[72px] w-full rounded-xl border p-2 text-left flex-col justify-between transition-all overflow-hidden",
                  isRowHidden(idx) ? "hidden lg:flex" : "flex",
                  count > 0
                    ? "bg-destructive/10 border-destructive/25 hover:bg-destructive/15"
                    : "bg-muted border-border hover:bg-accent/60",
                  key === data.today && "ring-2 ring-brand ring-offset-1 ring-offset-card",
                  isSelected && "ring-2 ring-brand/70 border-foreground/25",
                )}
              >
                <span className={cn(
                  "text-[13px] leading-none",
                  muted && !count ? "font-medium text-muted-foreground/60" : "font-bold text-foreground",
                )}>
                  {dayNum}
                </span>
                {count > 0 && (
                  <span className="text-[9.5px] font-semibold leading-tight text-destructive">
                    {count}<span className="hidden md:inline"> pending</span>
                  </span>
                )}
                {holiday && (
                  <span className="text-[9.5px] font-semibold leading-tight truncate text-foreground/70 hidden md:block">
                    {holiday}
                  </span>
                )}
              </Button>
            );
          })}
        </div>

        <CalendarWeekToggle expanded={expanded} onToggle={() => setExpanded(!expanded)} />
      </CardContent>
    </Card>
  );
}

// ─── Side Panel ───────────────────────────────────────────────────────────────

function SidePanel({
  data,
  selectedDate,
  query,
  setQuery,
}: {
  data: BacklogData;
  selectedDate: string;
  query: string;
  setQuery: (q: string) => void;
}) {
  const d = parseISO(selectedDate);
  const holiday = data.holidays[selectedDate];
  const rows = data.days[selectedDate] ?? [];
  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter(({ user: u }) => u.name.toLowerCase().includes(q) || u.employeeCode.toLowerCase().includes(q))
    : rows;

  const emptyText = holiday
    ? `Holiday — ${holiday}.`
    : d.getDay() === 0
      ? "Sunday — not a working day."
      : selectedDate > data.today
        ? "This day hasn't happened yet."
        : q
          ? "No matches. Try a different search."
          : "Everyone is up to date.";

  return (
    <aside>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">
            {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </CardTitle>
          <CardAction>
            <span
              className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-full ring-1",
                rows.length
                  ? "bg-destructive/10 text-destructive ring-destructive/20"
                  : "bg-muted text-foreground/70 ring-border",
              )}
            >
              {rows.length} {rows.length === 1 ? "person" : "people"}
            </span>
          </CardAction>
        </CardHeader>

        <CardContent className="px-0 pt-0 pb-0">
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employees…"
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-[560px] overflow-y-auto border-t border-border [scrollbar-width:thin]">
            {visible.length === 0 ? (
              <p className="py-10 px-6 text-center text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              visible.map(({ user: u, hoursLogged, target }) => (
                <PersonRow
                  key={u.id}
                  id={u.id}
                  name={u.name}
                  type={u.type}
                  designation={u.designation}
                  branch={u.branch}
                  stacked
                  right={<TargetBar logged={hoursLogged} target={target} className="justify-start" />}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
