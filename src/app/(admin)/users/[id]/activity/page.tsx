import { headers } from "next/headers";

import { getSessionUser } from "@/src/lib/session";
import { fetchUserActivity } from "./actions";
import { ActivityView } from "../_components/activity-view";
import { TaskInputClient } from "../../../tasks/_components/task-input-client";

export default async function UserActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { target, today, data, grantedDates } = await fetchUserActivity(id);

  // SuperAdmin gets the full editable timesheet instead of the read-only view.
  const viewer = await getSessionUser(await headers());
  if (viewer?.designation === "SuperAdmin" && viewer.id !== id) {
    return (
      <div className="mt-6">
        <TaskInputClient
          key={id}
          today={today}
          initialData={data}
          editingUser={{ id: target.id, name: target.name }}
        />
      </div>
    );
  }

  return (
    <ActivityView
      target={{ id: target.id, name: target.name, designation: target.designation, branch: target.branch }}
      backHref={`/users/${id}`}
      today={today}
      data={data}
      grantedDates={grantedDates}
    />
  );
}
