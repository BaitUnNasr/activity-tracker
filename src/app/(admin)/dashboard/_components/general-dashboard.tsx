import type { PersonalDashboardData } from "../actions";
import type { SessionUser } from "@/src/lib/session";
import { PersonalSection } from "./personal-section";

export function GeneralDashboard({
  data,
  sessionUser,
}: {
  data: PersonalDashboardData;
  sessionUser: SessionUser;
}) {
  return (
    <PersonalSection
      data={data}
      sessionUser={sessionUser}
      showHolidays
      showGreeting
    />
  );
}
