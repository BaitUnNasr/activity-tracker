"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * History-aware back button: returns the user to wherever they actually came
 * from (dashboard, users list, user detail …). Falls back to `fallbackHref`
 * when there is no in-app history (e.g. the page was opened directly).
 */
export function BackButton({
  fallbackHref,
  label = "Go back",
}: {
  fallbackHref: string;
  label?: string;
}) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      className="h-9 w-9 rounded-full border border-border bg-muted grid place-items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}
