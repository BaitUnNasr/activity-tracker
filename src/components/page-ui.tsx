import type { ReactNode } from "react";

import { cn } from "@/src/lib/utils";

// Solid brand chip — high contrast in BOTH themes because --brand & --foreground flip
// together (light: dark icon on lime ≈ 13:1 · dark: light icon on deep-olive ≈ 9:1).
// Pass `className` to swap to a semantic chip (e.g. destructive / amber alerts).
export function IconChip({
  children,
  className,
  size = "md",
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div
      className={cn(
        "rounded-xl grid place-items-center shrink-0 shadow-sm ring-1 bg-brand ring-foreground/10",
        size === "sm" && "h-7 w-7 rounded-lg",
        size === "md" && "h-9 w-9",
        size === "lg" && "h-11 w-11 rounded-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "active" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
        tone === "active"
          ? "bg-brand text-foreground ring-1 ring-foreground/10"
          : "bg-muted text-foreground/70 ring-1 ring-border",
      )}
    >
      {children}
    </span>
  );
}

// Atmospheric brand glow that lifts cards off the page. Parent must be `relative isolate`.
export function HeaderGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-16 right-0 -z-10 h-72 w-[65%] blur-3xl opacity-60"
      style={{
        background:
          "radial-gradient(60% 80% at 85% 0%, color-mix(in oklab, var(--brand) 30%, transparent), transparent 72%)",
      }}
    />
  );
}
