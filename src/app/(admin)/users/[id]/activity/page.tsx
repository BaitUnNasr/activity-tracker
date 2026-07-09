import { fetchUserActivity } from "./actions";
import { ActivityView } from "../_components/activity-view";

export default async function UserActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { target, today, data, grantedDates } = await fetchUserActivity(id);

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
