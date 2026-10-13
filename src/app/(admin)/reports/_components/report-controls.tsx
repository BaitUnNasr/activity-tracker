"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { toXlsx, type XlsxSheet } from "@/src/lib/xlsx";
import { Button } from "@/src/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { setSalary } from "../actions";

const labelClass = "flex flex-col gap-1 text-xs font-medium text-muted-foreground";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FIRST_YEAR = 2021;

// The report is driven entirely by the URL, so a filter change just navigates.
// Changing the month keeps the open daily sheet; changing branch closes it.
export function ReportFilters({
  month,
  branchId,
  branches,
}: {
  month: string;
  branchId: number | null;
  branches: { id: number; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(y);

  const go = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    startTransition(() => router.push(`/reports?${params}`));
  };

  return (
    <div className={cn("flex flex-wrap items-end gap-3 transition-opacity", pending && "opacity-60")}>
      <div className={labelClass}>
        Month
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) setViewYear(y); // reopen on the selected month's year
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 w-44 justify-between gap-2 rounded-full bg-muted px-3 font-normal text-foreground">
              {monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              <CalendarIcon className="h-4 w-4 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="flex items-center justify-between mb-2">
              <Button variant="ghost" size="icon" className="size-8" aria-label="Previous year" disabled={viewYear <= FIRST_YEAR} onClick={() => setViewYear((v) => v - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold">{viewYear}</span>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Next year" disabled={viewYear >= now.getFullYear()} onClick={() => setViewYear((v) => v + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((name, i) => {
                const value = `${viewYear}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <Button
                    key={name}
                    variant="ghost"
                    size="sm"
                    disabled={new Date(viewYear, i) > now}
                    onClick={() => {
                      setOpen(false);
                      if (value !== month) go({ month: value });
                    }}
                    className={cn(value === month && "bg-brand text-foreground hover:bg-brand font-semibold")}
                  >
                    {name}
                  </Button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className={labelClass}>
        Branch
        <Select value={branchId ? String(branchId) : undefined} onValueChange={(v) => go({ branch: v, user: null })}>
          <SelectTrigger className="h-9 w-44 rounded-full bg-muted text-foreground">
            <SelectValue placeholder="Select a branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function SalaryInput({ userId, month, gross }: { userId: string; month: string; gross: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const save = (raw: string) => {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value === gross) return;
    startTransition(async () => {
      const res = await setSalary(userId, month, value);
      if (!res.success) return void toast.error(res.message);
      toast.success("Salary saved");
      router.refresh();
    });
  };

  return (
    <input
      key={`${month}-${gross}`}
      type="number"
      min={0}
      step="any"
      inputMode="decimal"
      aria-label="Gross monthly salary"
      placeholder="Set salary"
      defaultValue={gross ?? ""}
      disabled={pending}
      onBlur={(e) => save(e.currentTarget.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="w-28 px-2 py-1 text-right tabular-nums text-sm rounded-lg bg-muted/60 border border-border focus:outline-none focus:border-ring disabled:opacity-50 print:border-0 print:bg-transparent"
    />
  );
}

export function ExcelButton({ filename, sheet }: { filename: string; sheet: XlsxSheet }) {
  const download = () => {
    const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const url = URL.createObjectURL(new Blob([toXlsx(sheet)], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="outline" onClick={download} className="rounded-full gap-2 print:hidden">
      <FileSpreadsheet className="h-4 w-4" />
      Export Excel
    </Button>
  );
}
