import { Building2 } from "lucide-react";

import { HeaderGlow, StatusPill } from "@/src/components/page-ui";
import { fetchUserActivity } from "./actions";
import { ActivityTimesheet } from "../_components/activity-timesheet";
import { BackButton } from "../_components/back-button";

export default async function UserActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { target, today, data } = await fetchUserActivity(id);

  return (
    <div className="mt-6">
      {/* Back + header */}
      <div className="relative isolate flex items-center gap-3 mb-6">
        <HeaderGlow />
        <BackButton fallbackHref={`/users/${id}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <StatusPill tone="active">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/80" />
              Activity
            </StatusPill>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted ring-1 ring-border text-xs font-medium text-muted-foreground">
              {target.designation ?? "—"}
              <span className="opacity-40">·</span>
              <Building2 className="h-3.5 w-3.5" />
              {target.branch ?? "—"}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-none">
            {target.name}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Read-only view of logged tasks and timesheet.
          </p>
        </div>
      </div>

      <ActivityTimesheet today={today} data={data} />
    </div>
  );
}
