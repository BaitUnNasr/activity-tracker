"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

// Mobile-only control that expands a collapsed week-view calendar to the full
// month and back. Pairs with the useCollapsibleCalendar hook.
export function CalendarWeekToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="lg:hidden mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {expanded ? (
        <>
          <ChevronUp className="h-3.5 w-3.5" />
          Show current week only
        </>
      ) : (
        <>
          <ChevronDown className="h-3.5 w-3.5" />
          Show full month
        </>
      )}
    </button>
  );
}
