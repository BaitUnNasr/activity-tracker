"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Check, MapPin, Plus, ShieldCheck, X } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Calendar } from "@/src/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { toggleUserStatus, transferBranch, updateDesignation } from "../actions";

type Option = { id: number; name: string };

// ─── Modal shell ──────────────────────────────────────────────────────────────

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-5"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl w-full max-w-[440px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Date picker input (Calendar + Popover) ───────────────────────────────────

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DatePickerInput({
  value,
  onChange,
  placeholder = "Select date",
}: {
  value: Date | undefined;
  onChange: (d: Date) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center gap-2 px-3.5 py-3 rounded-xl bg-muted border border-border text-sm transition-colors",
            "hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className={cn("flex-1 text-left", value ? "text-foreground font-medium" : "text-muted-foreground")}>
            {value ? fmtDate(value) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            if (d) { onChange(d); setOpen(false); }
          }}
          captionLayout="dropdown"
          startMonth={new Date(2015, 0)}
          endMonth={new Date(currentYear + 2, 11)}
          defaultMonth={value ?? new Date()}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Status toggle (inline pill with LED + switch) ────────────────────────────

export function StatusToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState(isActive);

  const handleToggle = () => {
    const next = !optimisticActive;
    setOptimisticActive(next);
    startTransition(async () => {
      const result = await toggleUserStatus(userId, next);
      if (result.success) {
        toast.success(`User marked ${next ? "active" : "inactive"}.`);
        router.refresh();
      } else {
        setOptimisticActive(!next);
        toast.error(result.message ?? "Failed to update status");
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      aria-label="Toggle active status"
      className={cn(
        "inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border transition-colors duration-150 disabled:opacity-60",
        "bg-muted/60 border-border hover:bg-muted",
      )}
    >
      <span className={cn(
        "h-[9px] w-[9px] rounded-full shrink-0 transition-all duration-200",
        optimisticActive
          ? "bg-green-500 shadow-[0_0_0_3px_rgba(63,185,80,0.18)]"
          : "bg-red-500 shadow-[0_0_0_3px_rgba(194,71,58,0.18)]",
      )} />
      <span className="text-xs font-semibold text-foreground">{optimisticActive ? "Active" : "Inactive"}</span>
      <span className={cn(
        "relative w-[38px] h-[22px] rounded-full transition-colors duration-200 shrink-0",
        optimisticActive ? "bg-green-500" : "bg-muted-foreground/25",
      )}>
        <span className={cn(
          "absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200",
          optimisticActive ? "left-[19px]" : "left-[3px]",
        )} />
      </span>
    </button>
  );
}

// ─── Transfer branch pill button ──────────────────────────────────────────────

export function TransferBranchButton({
  userId,
  branches,
  currentBranchId,
  currentBranchName,
}: {
  userId: string;
  branches: Option[];
  currentBranchId: number | null;
  currentBranchName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [branchId, setBranchId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [error, setError] = useState<string | null>(null);

  const valid = !!branchId && !!date && Number(branchId) !== currentBranchId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await transferBranch(userId, Number(branchId), toDateString(date!));
      if (result.success) {
        toast.success(`Transferred to ${branches.find(b => b.id === Number(branchId))?.name}.`);
        setOpen(false);
        setBranchId("");
        router.refresh();
      } else {
        setError(result.message ?? "Transfer failed");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-background text-muted-foreground hover:bg-brand/10 hover:border-brand/40 hover:text-foreground text-[11.5px] font-semibold transition-colors"
      >
        <Plus className="h-3 w-3" />
        Transfer
      </button>

      {open && (
        <ModalShell onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit}>
            <div className="px-7 pt-7 pb-5">
              <div className="flex items-center gap-3.5 mb-1.5">
                <div className="h-11 w-11 rounded-2xl bg-brand grid place-items-center shrink-0">
                  <MapPin className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">Transfer Branch</h3>
                  {currentBranchName && (
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      Currently at <strong className="text-foreground font-semibold">{currentBranchName}</strong>
                    </p>
                  )}
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)} className="ml-auto rounded-full text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Transfer to branch</label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="w-full rounded-xl bg-muted border-border focus-visible:ring-brand/30">
                      <SelectValue placeholder="Select branch…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {branches.filter(b => b.id !== currentBranchId).map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Effective from</label>
                  <DatePickerInput value={date} onChange={setDate} placeholder="Select date…" />
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-7 py-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">Cancel</Button>
              <Button
                type="submit"
                disabled={!valid || isPending}
                className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-2 h-auto py-2.5 px-5"
              >
                <Check className="h-3.5 w-3.5" />
                {isPending ? "Transferring…" : "Confirm Transfer"}
              </Button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  );
}

// ─── Update designation pill button ──────────────────────────────────────────

type ChangeType = "up" | "down" | "move";

const CHANGE_TYPES: { type: ChangeType; label: string }[] = [
  { type: "up", label: "Promote" },
  { type: "down", label: "Demote" },
  { type: "move", label: "Lateral" },
];

export function UpdateDesignationButton({
  userId,
  designations,
  currentDesignationId,
  currentDesignationName,
}: {
  userId: string;
  designations: Option[];
  currentDesignationId: number | null;
  currentDesignationName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [designationId, setDesignationId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [changeType, setChangeType] = useState<ChangeType>("up");
  const [error, setError] = useState<string | null>(null);

  const valid = !!designationId && !!date && Number(designationId) !== currentDesignationId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await updateDesignation(userId, Number(designationId), toDateString(date!));
      if (result.success) {
        toast.success(`Designation updated to ${designations.find(d => d.id === Number(designationId))?.name}.`);
        setOpen(false);
        setDesignationId("");
        router.refresh();
      } else {
        setError(result.message ?? "Update failed");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-background text-muted-foreground hover:bg-brand/10 hover:border-brand/40 hover:text-foreground text-[11.5px] font-semibold transition-colors"
      >
        <Plus className="h-3 w-3" />
        Update
      </button>

      {open && (
        <ModalShell onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit}>
            <div className="px-7 pt-7 pb-5">
              <div className="flex items-center gap-3.5 mb-1.5">
                <div className="h-11 w-11 rounded-2xl bg-brand grid place-items-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">Update Designation</h3>
                  {currentDesignationName && (
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      Currently <strong className="text-foreground font-semibold">{currentDesignationName}</strong>
                    </p>
                  )}
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)} className="ml-auto rounded-full text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">New designation</label>
                  <Select value={designationId} onValueChange={setDesignationId}>
                    <SelectTrigger className="w-full rounded-xl bg-muted border-border focus-visible:ring-brand/30">
                      <SelectValue placeholder="Select designation…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {designations.filter(d => d.id !== currentDesignationId && (d.name !== "Admin" && d.name !== "SuperAdmin")).map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Change type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CHANGE_TYPES.map(({ type, label }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setChangeType(type)}
                        className={cn(
                          "py-2.5 rounded-xl border text-[13px] font-semibold transition-all",
                          changeType === type
                            ? "bg-brand/15 border-brand/40 text-foreground"
                            : "bg-muted border-border text-muted-foreground hover:bg-muted/80",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Effective from</label>
                  <DatePickerInput value={date} onChange={setDate} placeholder="Select date…" />
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-7 py-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">Cancel</Button>
              <Button
                type="submit"
                disabled={!valid || isPending}
                className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-2 h-auto py-2.5 px-5"
              >
                <Check className="h-3.5 w-3.5" />
                {isPending ? "Updating…" : "Confirm Update"}
              </Button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  );
}
