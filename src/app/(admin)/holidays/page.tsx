"use client";

import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Calendar } from "@/src/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
}

// ─── Seed data ───────────────────────────────────────────────────────────────

const initialHolidays: Holiday[] = [
  { id: "1", name: "New Year's Day", date: "2026-01-01" },
  { id: "2", name: "Republic Day", date: "2026-01-26" },
  { id: "3", name: "Good Friday", date: "2026-04-03" },
  { id: "4", name: "Founders Day", date: "2026-05-12" },
  { id: "5", name: "Independence Day", date: "2026-07-04" },
  { id: "6", name: "Diwali", date: "2026-11-08" },
  { id: "7", name: "Christmas", date: "2026-12-25" },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [cursor, setCursor] = useState(new Date(2026, 0, 1));
  const [showForm, setShowForm] = useState(false);

  const sorted = useMemo(
    () => [...holidays].sort((a, b) => a.date.localeCompare(b.date)),
    [holidays],
  );

  const addHoliday = (h: Omit<Holiday, "id">) => {
    setHolidays((prev) => [...prev, { ...h, id: crypto.randomUUID() }]);
    setShowForm(false);
  };

  const removeHoliday = (id: string) =>
    setHolidays((prev) => prev.filter((h) => h.id !== id));

  return (
    <div className="space-y-5 pt-5">
      {/* ── Page header ─────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Holiday Master</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule company-wide holidays directly into the calendar.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand text-foreground text-sm font-semibold hover:brightness-105 active:scale-[0.98] transition"
        >
          <Plus className="h-4 w-4" />
          Add holiday
        </button>
      </div>

      {/* ── Main grid: calendar(2/3) | table(1/3) on lg; stacked on mobile ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 items-start">
        <CalendarCard cursor={cursor} setCursor={setCursor} holidays={holidays} />
        <HolidayTable holidays={sorted} onRemove={removeHoliday} />
      </div>

      {/* ── Add-holiday modal ────────────────────────────── */}
      {showForm && (
        <HolidayFormModal onClose={() => setShowForm(false)} onSubmit={addHoliday} />
      )}
    </div>
  );
}

// ─── Calendar ────────────────────────────────────────────────────────────────

function CalendarCard({
  cursor,
  setCursor,
  holidays,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  holidays: Holiday[];
}) {
  const [inspectedDay, setInspectedDay] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const monthLabel = first.toLocaleString("en-US", { month: "long", year: "numeric" });
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const holidayMap = useMemo(() => {
    const m = new Map<string, Holiday[]>();
    holidays.forEach((h) => {
      const arr = m.get(h.date) ?? [];
      arr.push(h);
      m.set(h.date, arr);
    });
    return m;
  }, [holidays]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const dateKey = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const inspectedHolidays = inspectedDay ? (holidayMap.get(inspectedDay) ?? []) : [];
  const inspectedLabel = inspectedDay
    ? new Date(inspectedDay + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    })
    : null;

  return (
    <>
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            {monthLabel}
          </CardTitle>
          <CardDescription>Click a day to inspect its holiday.</CardDescription>
          <CardAction>
            <div className="flex items-center gap-1.5">
              <NavBtn onClick={() => setCursor(new Date(year, month - 1, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </NavBtn>
              <button
                onClick={() => { setCursor(new Date()); setInspectedDay(null); }}
                className="px-3 h-9 rounded-full bg-muted border border-border text-xs hover:bg-accent transition"
              >
                Today
              </button>
              <NavBtn onClick={() => setCursor(new Date(year, month + 1, 1))}>
                <ChevronRight className="h-4 w-4" />
              </NavBtn>
            </div>
          </CardAction>
        </CardHeader>

        <CardContent>
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const key = dateKey(d);
              const hs = holidayMap.get(key);
              const hasHoliday = !!hs?.length;
              const isTd = isToday(d);
              const sel = inspectedDay === key;
              return (
                <button
                  key={i}
                  type="button"
                  title={hs?.map((h) => h.name).join(", ")}
                  onClick={() => setInspectedDay(sel ? null : key)}
                  className={cn(
                    "relative aspect-square rounded-xl border p-1.5 text-[11px] flex flex-col justify-between transition-all",
                    hasHoliday ? "bg-brand/10 border-foreground/25" : "bg-muted border-border hover:bg-accent",
                    isTd && "ring-2 ring-brand ring-offset-1 ring-offset-card",
                    sel && "ring-2 ring-brand bg-brand/20",
                  )}
                >
                  <span className={cn("font-medium", hasHoliday ? "" : "text-foreground/80")}>
                    {d}
                  </span>

                  {/* Name text: desktop only */}
                  {hasHoliday && (
                    <span className="hidden lg:block truncate text-[9px] leading-tight font-medium">
                      {hs!.length === 1 ? hs![0].name : `${hs![0].name} +${hs!.length - 1}`}
                    </span>
                  )}

                  {/* Dots: one per holiday, max 3 */}
                  {hasHoliday && (
                    <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                      {hs!.slice(0, 3).map((_, idx) => (
                        <span key={idx} className="h-1.5 w-1.5 rounded-full bg-brand" />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day inspector – dialog (all screen sizes) */}
      {inspectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setInspectedDay(null)}
        >
          <Card
            className="w-full max-w-sm shadow-2xl shadow-black/20"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className="font-bold text-base">{inspectedLabel}</CardTitle>
              <CardAction>
                <button
                  onClick={() => setInspectedDay(null)}
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {inspectedHolidays.length > 0 ? (
                <div className="space-y-2">
                  {inspectedHolidays.map((h) => (
                    <div key={h.id} className="rounded-2xl bg-brand/10 border border-brand px-4 py-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5">
                        Holiday
                      </p>
                      <p className="font-bold text-base">{h.name}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No holiday on this day.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function NavBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-9 w-9 grid place-items-center rounded-full bg-muted border border-border hover:bg-accent transition"
    >
      {children}
    </button>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function HolidayTable({
  holidays,
  onRemove,
}: {
  holidays: Holiday[];
  onRemove: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled holidays</CardTitle>
        <CardAction>
          <span className="text-xs text-muted-foreground">{holidays.length} entries</span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Date</th>
                <th className="py-3 pr-4 font-medium">Name</th>
                <th className="py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-muted-foreground">
                    No holidays scheduled yet.
                  </td>
                </tr>
              )}
              {holidays.map((h) => {
                const date = new Date(h.date + "T00:00:00");
                const day = date.getDate();
                const suffix =
                  day >= 11 && day <= 13
                    ? "th"
                    : ["th", "st", "nd", "rd"][day % 10] || "th";

                const formatted = `${day}${suffix} ${date.toLocaleDateString("en-US", {
                  month: "short",
                })} ${date.getFullYear()}, ${date.toLocaleDateString("en-US", {
                  weekday: "short",
                })}`;
                return (
                  <tr
                    key={h.id}
                    className="border-b border-border/50 hover:bg-muted/40 transition-colors"
                  >
                    <td className="py-3 pr-4 text-foreground/80 whitespace-nowrap">{formatted}</td>
                    <td className="py-3 pr-4 font-medium">{h.name}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onRemove(h.id)}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-muted border border-border hover:bg-accent text-foreground/70 transition"
                      >
                        <Trash2 color="red" className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Add-holiday modal ────────────────────────────────────────────────────────

function HolidayFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (h: Omit<Holiday, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const dateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : "";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name || !dateStr) return;
    onSubmit({ name, date: dateStr });
  };

  const inputCls =
    "w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/50 focus:ring-offset-0 transition";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md shadow-2xl shadow-black/20"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="contents">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Add new holiday</CardTitle>
            <CardDescription>Schedule a new day off in the calendar.</CardDescription>
            <CardAction>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-5 w-5" />
              </button>
            </CardAction>
          </CardHeader>

          <CardContent className="space-y-4">
            <ModalField label="Holiday name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Thanksgiving"
                className={inputCls}
              />
            </ModalField>

            <ModalField label="Date">
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      inputCls,
                      "flex items-center justify-between gap-2 text-left",
                      !selectedDate && "text-muted-foreground",
                    )}
                  >
                    <span>
                      {selectedDate
                        ? selectedDate.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Pick a date"}
                    </span>
                    <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => {
                      setSelectedDate(d);
                      setDatePickerOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </ModalField>
          </CardContent>

          <CardFooter className="justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full bg-muted border border-border text-sm hover:bg-accent transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand text-foreground text-sm font-semibold hover:brightness-110 transition"
            >
              <Plus className="h-4 w-4" />
              Save holiday
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
