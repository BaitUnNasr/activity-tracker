import { fetchSchedules } from "./actions";
import { ScheduleMasterClient } from "./_components/schedule-master-client";

export default async function SchedulePage() {
  const schedules = await fetchSchedules();
  return (
    <div className="mt-6">
      <ScheduleMasterClient initialSchedules={schedules} />
    </div>
  );
}
