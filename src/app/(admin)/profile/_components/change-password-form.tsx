"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Lock } from "lucide-react";

import { toast } from "sonner";

import { authClient } from "@/src/lib/auth-client";

function PasswordInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 relative">
        <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-2xl border border-border bg-muted pl-9 pr-10 py-3 text-sm outline-none focus:border-ring focus:bg-background transition"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = [
    { ok: next.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Z]/.test(next), label: "One uppercase letter" },
    { ok: /[0-9]/.test(next), label: "One number" },
    { ok: next.length > 0 && next === confirm, label: "Passwords match" },
  ];

  const allValid = rules.every((r) => r.ok) && current.length > 0;

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allValid) return;
    setLoading(true);
    setError(null);
    // setSuccess(false);

    const { error: err } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: false,
    });

    setLoading(false);
    if (err) {
      setError(err.message ?? "Failed to update password.");
    } else {
      toast.success("Password updated successfully.");
      reset();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-border p-6 bg-card">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Change Password</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Use a strong password you don&apos;t reuse elsewhere.
          </p>
        </div>
        <div className="h-10 w-10 rounded-full grid place-items-center bg-brand">
          <Lock className="h-4 w-4 text-gray-900" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <PasswordInput label="Current Password" value={current} onChange={setCurrent} />
        </div>
        <PasswordInput label="New Password" value={next} onChange={setNext} />
        <PasswordInput label="Confirm New Password" value={confirm} onChange={setConfirm} />
      </div>

      <div className="mt-5 rounded-2xl bg-muted p-4">
        <p className="text-xs font-semibold text-foreground mb-3">Password requirements</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rules.map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-xs">
              <span
                className={`h-4 w-4 rounded-full grid place-items-center shrink-0 transition-colors ${
                  r.ok ? "bg-brand" : "bg-border"
                }`}
              >
                <Check className="h-3 w-3 text-gray-900" />
              </span>
              <span className={r.ok ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2.5 rounded-full text-sm border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!allValid || loading}
          className="px-5 py-2.5 rounded-full text-sm font-medium bg-brand text-gray-900 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Updating…" : "Update Password"}
        </button>
      </div>
    </form>
  );
}
