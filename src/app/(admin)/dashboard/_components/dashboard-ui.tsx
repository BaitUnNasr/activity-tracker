import type { ReactNode } from "react";

import { IconChip } from "@/src/components/page-ui";

// Re-exported so dashboard components keep importing chrome from one local module.
export { IconChip, StatusPill } from "@/src/components/page-ui";

// Consistent card header: icon chip + title + description + optional right slot.
export function CardHead({
  icon,
  iconClassName,
  title,
  description,
  right,
}: {
  icon: ReactNode;
  iconClassName?: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 pb-5 border-b border-border">
      <div className="flex items-center gap-3 min-w-0">
        <IconChip className={iconClassName}>{icon}</IconChip>
        <div className="min-w-0">
          <div className="text-[15px] font-bold tracking-tight text-foreground truncate">{title}</div>
          {description && (
            <div className="text-[13px] text-muted-foreground mt-0.5 truncate">{description}</div>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
