"use client";

import { useState, useTransition } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { createUser } from "../actions";

const INPUT =
  "w-full rounded-2xl border border-border bg-muted px-3 py-2.5 text-sm outline-none focus:border-ring focus:bg-background transition";

type Props = {
  onClose: () => void;
  designations: { id: number; name: string }[];
  branches: { id: number; name: string }[];
};

type FormState = {
  name: string;
  password: string;
  employeeCode: string;
  type: "F" | "T";
  designationId: string;
  branchId: string;
};

export function AddUserModal({ onClose, designations, branches }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "",
    password: "",
    employeeCode: "",
    type: "F",
    designationId: String(designations[0]?.id ?? ""),
    branchId: String(branches[0]?.id ?? ""),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isValid =
    form.name.trim() &&
    form.password.length >= 8 &&
    form.employeeCode.trim() &&
    form.designationId &&
    form.branchId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await createUser({
        name: form.name.trim(),
        password: form.password,
        employeeCode: form.employeeCode.trim(),
        type: form.type,
        designationId: Number(form.designationId),
        branchId: Number(form.branchId),
      });

      if (result.success) {
        toast.success("User created successfully.");
        router.refresh();
        onClose();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
      <div
        className="bg-card rounded-4xl w-full max-w-lg shadow-xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Add New User</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fill in the details to create an account.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name">
              <input
                className={INPUT}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="John Doe"
              />
            </Field>

            <Field label="Employee Code">
              <input
                className={INPUT}
                value={form.employeeCode}
                onChange={(e) => set("employeeCode", e.target.value)}
                placeholder="EMP001"
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={cn(INPUT, "pr-10")}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="Min. 8 characters"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </Field>

            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => set("type", v as "F" | "T")}>
                <SelectTrigger className="w-full rounded-2xl border-border bg-muted h-auto py-2.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="F">Full-time</SelectItem>
                    <SelectItem value="T">Trainee</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Designation">
              <Select value={form.designationId} onValueChange={(v) => set("designationId", v)}>
                <SelectTrigger className="w-full rounded-2xl border-border bg-muted h-auto py-2.5">
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {designations.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Branch" className="sm:col-span-2">
              <Select value={form.branchId} onValueChange={(v) => set("branchId", v)}>
                <SelectTrigger className="w-full rounded-2xl border-border bg-muted h-auto py-2.5">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isPending}
              className="rounded-full bg-brand text-gray-900 hover:bg-brand hover:brightness-105 h-auto py-2.5 px-5"
            >
              {isPending ? "Creating…" : "Create User"}
            </Button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  className,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-xs text-muted-foreground mb-1.5 block">{label}</span>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </label>
  );
}
