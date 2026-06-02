"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
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
import { Calendar } from "@/src/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { HeaderGlow, IconChip } from "@/src/components/page-ui";
import { createHoliday, deleteHoliday, type HolidayRow } from "../actions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const toDateStr = (d: Date) =>
  toDateKey(d.getFullYear(), d.getMonth(), d.getDate());

// ─── Client ───────────────────────────────────────────────────────────────────

export function HolidaysClient({ initialHolidays }: { initialHolidays: HolidayRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const today = new Date();
  const [holidays, setHolidays] = useState<HolidayRow[]>(initialHolidays);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState(toDateStr(today));
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);

  // Sync server-refreshed data back into local state
  useEffect(() => {
    setHolidays(initialHolidays);
  }, [initialHolidays]);

  // Expand holiday ranges into a date → holidays map
  const byDate = useMemo(() => {
    const m = new Map<string, HolidayRow[]>();
    holidays.forEach((h) => {
      const curr = parseISO(h.startDate);
      while (toDateStr(curr) <= h.endDate) {
        const key = toDateStr(curr);
        if (!m.has(key)) m.set(key, []);
        m.get(key)!.push(h);
        curr.setDate(curr.getDate() + 1);
      }
    });
    return m;
  }, [holidays]);

  const yearHolidays = useMemo(
    () => holidays.filter((h) => h.startDate.startsWith(String(cursor.year))),
    [holidays, cursor.year],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? yearHolidays.filter((h) => h.name.toLowerCase().includes(q))
      : yearHolidays;
    return [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [yearHolidays, query]);

  const thisMonthCount = holidays.filter((h) => {
    const d = parseISO(h.startDate);
    return d.getFullYear() === cursor.year && d.getMonth() === cursor.month;
  }).length;

  const handleAdd = (startDate: string) => {
    const d = parseISO(startDate);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelectedDate(startDate);
    setShowForm(false);
    toast.success("Holiday added successfully.");
    router.refresh();
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);

    setRemoving(id);
    setTimeout(() => {
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      setRemoving(null);
      startTransition(async () => {
        const result = await deleteHoliday(id);
        if (!result.success) {
          toast.error(result.message ?? "Failed to delete holiday");
          router.refresh();
        } else {
          toast.success("Holiday deleted.");
          router.refresh();
        }
      });
    }, 220);
  };

  const stepMonth = (dir: number) => {
    setCursor((v) => {
      let m = v.month + dir, y = v.year;
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const goToday = () => {
    const t = new Date();
    setCursor({ year: t.getFullYear(), month: t.getMonth() });
    setSelectedDate(toDateStr(t));
  };

  return (
    <>
      {/* ── Page header ─────────────────────────────────── */}
      <div className="relative isolate flex flex-wrap items-end justify-between gap-4">
        <HeaderGlow />
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Holiday Master
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Schedule company-wide holidays directly into the calendar.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/15 border border-brand/25 text-xs font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Holidays · {cursor.year}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted border border-border text-xs text-muted-foreground">
              {thisMonthCount} scheduled this month
            </span>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 active:scale-[0.98] gap-2 h-auto py-2.5 px-5"
        >
          <Plus className="h-4 w-4" />
          Add holiday
        </Button>
      </div>

      {/* ── Main grid ───────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5 items-start">
        <CalendarCard
          cursor={cursor}
          stepMonth={stepMonth}
          goToday={goToday}
          byDate={byDate}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
        <SidePanel
          holidays={filtered}
          allHolidays={yearHolidays}
          byDate={byDate}
          selectedDate={selectedDate}
          onRequestDelete={(id, name) => setPendingDelete({ id, name })}
          removing={removing}
          query={query}
          setQuery={setQuery}
          onJump={(date) => {
            const d = parseISO(date);
            setCursor({ year: d.getFullYear(), month: d.getMonth() });
            setSelectedDate(date);
          }}
        />
      </div>

      {/* ── Add modal ───────────────────────────────────── */}
      {showForm && (
        <HolidayFormModal
          onClose={() => setShowForm(false)}
          onAdd={handleAdd}
          defaultDate={selectedDate}
        />
      )}

      {/* ── Delete confirmation ──────────────────────────── */}
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

// ─── Calendar Card ────────────────────────────────────────────────────────────

function CalendarCard({
  cursor,
  stepMonth,
  goToday,
  byDate,
  selectedDate,
  setSelectedDate,
}: {
  cursor: { year: number; month: number };
  stepMonth: (dir: number) => void;
  goToday: () => void;
  byDate: Map<string, HolidayRow[]>;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
}) {
  const { year, month } = cursor;
  const startDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  const cells: { inMonth: boolean; dayNum: number; idx: number }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDow + 1;
    cells.push({ inMonth: dayNum >= 1 && dayNum <= daysInMonth, dayNum, idx: i });
  }

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2.5 text-xl font-bold">
          <IconChip size="sm"><CalendarIcon className="h-3.5 w-3.5 text-foreground" /></IconChip>
          {MONTHS[month]} {year}
        </CardTitle>
        <CardDescription>Click a day to inspect its holiday.</CardDescription>
        <CardAction>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => stepMonth(-1)}
              className="rounded-full"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToday}
              className="rounded-full px-3 text-xs font-medium"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => stepMonth(1)}
              className="rounded-full"
            >
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

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map(({ inMonth, dayNum, idx }) => {
            if (!inMonth) return <div key={idx} />;
            const key = toDateKey(year, month, dayNum);
            const events = byDate.get(key) ?? [];
            const hasHoliday = events.length > 0;
            const isSelected = key === selectedDate;
            const isTd = isToday(dayNum);
            return (
              <Button
                key={idx}
                type="button"
                variant="ghost"
                title={events.map((e) => e.name).join(", ")}
                onClick={() => setSelectedDate(key)}
                className={cn(
                  "relative h-[45px] md:h-[72px] w-full rounded-xl border p-2 text-left flex flex-col justify-between transition-all overflow-hidden",
                  hasHoliday
                    ? "bg-brand/10 border-brand/25 hover:bg-brand/15"
                    : "bg-muted border-border hover:bg-accent/60",
                  isTd && "ring-2 ring-brand ring-offset-1 ring-offset-card",
                  isSelected && "ring-2 ring-brand/70",
                  isSelected && hasHoliday && "border-brand/50",
                  isSelected && !hasHoliday && "border-foreground/25",
                )}
              >
                <span className={cn(
                  "text-[13px] leading-none",
                  hasHoliday ? "font-bold text-foreground" : "font-medium text-muted-foreground",
                )}>
                  {dayNum}
                </span>
                {hasHoliday && (
                  <>
                    <span className="text-[9.5px] font-semibold leading-tight truncate text-foreground/70 pr-4">
                      {events.length === 1
                        ? events[0].name
                        : `${events[0].name} +${events.length - 1}`}
                    </span>
                    <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-brand" />
                  </>
                )}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Side Panel ───────────────────────────────────────────────────────────────

function SidePanel({
  holidays,
  allHolidays,
  byDate,
  selectedDate,
  onRequestDelete,
  removing,
  query,
  setQuery,
  onJump,
}: {
  holidays: HolidayRow[];
  allHolidays: HolidayRow[];
  byDate: Map<string, HolidayRow[]>;
  selectedDate: string;
  onRequestDelete: (id: number, name: string) => void;
  removing: number | null;
  query: string;
  setQuery: (q: string) => void;
  onJump: (date: string) => void;
}) {
  const selectedEvents = byDate.get(selectedDate) ?? [];

  return (
    <aside className="flex flex-col gap-4">
      <SelectedDayCard date={selectedDate} events={selectedEvents} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Scheduled holidays</CardTitle>
          <CardAction>
            <span className="text-xs text-muted-foreground">{allHolidays.length} entries</span>
          </CardAction>
        </CardHeader>

        <CardContent className="px-0 pt-0 pb-0">
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search holidays…"
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

          <div className="grid grid-cols-[1fr_auto] px-4 py-2 border-y border-border text-[10px] font-medium text-muted-foreground tracking-widest uppercase">
            <span>Date · Name</span>
            <span>Action</span>
          </div>

          <ul className="max-h-[460px] overflow-y-auto [scrollbar-width:thin]">
            {holidays.length === 0 ? (
              <li className="py-10 text-center text-sm text-muted-foreground">
                No matches. Try a different search.
              </li>
            ) : (
              holidays.map((h) => (
                <HolidayRow
                  key={h.id}
                  h={h}
                  isSelected={selectedDate >= h.startDate && selectedDate <= h.endDate}
                  isRemoving={removing === h.id}
                  onJump={() => onJump(h.startDate)}
                  onDelete={() => onRequestDelete(h.id, h.name)}
                />
              ))
            )}
          </ul>
        </CardContent>
      </Card>
    </aside>
  );
}

// ─── Selected Day Card ────────────────────────────────────────────────────────

function SelectedDayCard({ date, events }: { date: string; events: HolidayRow[] }) {
  const d = parseISO(date);
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const has = events.length > 0;

  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-colors",
      has ? "bg-brand/5 border-brand/20" : "bg-card border-border",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn(
            "text-[10px] font-semibold tracking-widest uppercase",
            has ? "text-brand" : "text-muted-foreground",
          )}>
            {has ? "Selected · Holiday" : "Selected · Working day"}
          </p>
          <p className="text-xl font-bold tracking-tight mt-1 text-foreground">
            {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className={cn(
          "h-12 w-12 rounded-xl shrink-0 grid place-items-center font-bold text-lg border",
          has
            ? "bg-brand border-brand/40 text-foreground"
            : "bg-muted border-border text-muted-foreground",
        )}>
          {d.getDate()}
        </div>
      </div>

      {has ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {events.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-brand/25 text-xs font-semibold text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {e.name}
              {e.startDate !== e.endDate && (
                <span className="text-muted-foreground font-normal ml-0.5">
                  · {parseISO(e.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" – "}
                  {parseISO(e.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {isWeekend ? "Weekend." : "No holiday scheduled."}{" "}
          Pick another day or add a new one.
        </p>
      )}
    </div>
  );
}

// ─── Holiday Row ──────────────────────────────────────────────────────────────

function HolidayRow({
  h,
  isSelected,
  isRemoving,
  onJump,
  onDelete,
}: {
  h: HolidayRow;
  isSelected: boolean;
  isRemoving: boolean;
  onJump: () => void;
  onDelete: () => void;
}) {
  const start = parseISO(h.startDate);
  const isRange = h.startDate !== h.endDate;

  return (
    <li className={cn(
      "grid grid-cols-[1fr_auto] gap-3 px-4 py-3 items-center border-b border-border/50 last:border-0 transition-all duration-200",
      isSelected && "bg-brand/5",
      isRemoving && "opacity-0 -translate-x-3",
    )}>
      <Button
        variant="ghost"
        onClick={onJump}
        className="flex items-center gap-3 text-left min-w-0 h-auto py-0 px-0 rounded-none justify-start hover:bg-transparent hover:opacity-80 transition-opacity"
      >
        <div className="h-11 w-[42px] shrink-0 rounded-xl bg-muted border border-border flex flex-col items-center justify-center gap-0.5">
          <span className="text-[9px] font-semibold text-muted-foreground tracking-wide uppercase">
            {start.toLocaleDateString("en-US", { month: "short" })}
          </span>
          <span className="text-sm font-bold text-foreground leading-none">
            {start.getDate()}
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-foreground truncate">{h.name}</p>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            {isRange
              ? `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${parseISO(h.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : start.toLocaleDateString("en-US", { weekday: "short" })}
          </p>
        </div>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onDelete}
        className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive gap-1.5 text-xs"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </Button>
    </li>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

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
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4">
          <div className="h-10 w-10 rounded-full bg-destructive/10 border border-destructive/20 grid place-items-center mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Delete holiday?</h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            <span className="font-medium text-foreground">"{name}"</span> will be permanently deleted from the calendar.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onCancel} className="rounded-full">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="rounded-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Holiday Modal ────────────────────────────────────────────────────────

function HolidayFormModal({
  onClose,
  onAdd,
  defaultDate,
}: {
  onClose: () => void;
  onAdd: (startDate: string) => void;
  defaultDate: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(
    defaultDate ? parseISO(defaultDate) : undefined,
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    defaultDate ? parseISO(defaultDate) : undefined,
  );
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStr = startDate ? toDateStr(startDate) : "";
  const endStr = endDate ? toDateStr(endDate) : "";
  const isValid = name.trim().length > 0 && !!startStr && !!endStr;

  const handleStartSelect = (d: Date | undefined) => {
    setStartDate(d);
    setStartOpen(false);
    if (d && endDate && endDate < d) setEndDate(d);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await createHoliday({
        name: name.trim(),
        startDate: startStr,
        endDate: endStr,
      });
      if (result.success) {
        onAdd(startStr);
      } else {
        setError(result.message);
      }
    });
  };

  const inputCls =
    "w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40 transition placeholder:text-muted-foreground";

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl w-full max-w-md shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <p className="text-[10px] font-semibold text-brand tracking-widest uppercase">New entry</p>
              <h3 className="text-xl font-bold tracking-tight mt-1 text-foreground">Add a holiday</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <label className="block">
              <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">
                Holiday name
              </span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mid-year recharge"
                className={inputCls}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">
                  Start date
                </span>
                <Popover open={startOpen} onOpenChange={setStartOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-between gap-2 text-left rounded-xl h-10 px-3 font-normal",
                        !startDate && "text-muted-foreground",
                      )}
                    >
                      <span className="truncate text-xs">{startDate ? fmtDate(startDate) : "Pick a date"}</span>
                      <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={handleStartSelect} />
                  </PopoverContent>
                </Popover>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">
                  End date
                </span>
                <Popover open={endOpen} onOpenChange={setEndOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-between gap-2 text-left rounded-xl h-10 px-3 font-normal",
                        !endDate && "text-muted-foreground",
                      )}
                    >
                      <span className="truncate text-xs">{endDate ? fmtDate(endDate) : "Pick a date"}</span>
                      <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      disabled={startDate ? (d) => d < startDate : undefined}
                      onSelect={(d) => { setEndDate(d); setEndOpen(false); }}
                    />
                  </PopoverContent>
                </Popover>
              </label>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isPending}
              className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-2 h-auto py-2 px-5"
            >
              <Plus className="h-3.5 w-3.5" />
              {isPending ? "Saving…" : "Add holiday"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
