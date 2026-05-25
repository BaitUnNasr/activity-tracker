import { AlertCircle } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface AlertDestructiveProps {
  title: string;
  className?: string;
}

export function AlertDestructive({ title, className }: AlertDestructiveProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
        className,
      )}
    >
      <AlertCircle className="size-4 shrink-0" />
      {title}
    </div>
  );
}
