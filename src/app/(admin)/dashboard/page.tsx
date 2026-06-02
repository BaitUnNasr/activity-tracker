import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/src/lib/session";
import { fetchAdminDashboardData, fetchPersonalDashboardData } from "./actions";
import { AdminDashboard } from "./_components/admin-dashboard";
import { GeneralDashboard } from "./_components/general-dashboard";

const ADMIN_ONLY = ["Admin"];
const MID_TIER = ["Chairman", "Management", "Supervisor"];

export default async function DashboardPage() {
  const sessionUser = await getSessionUser(await headers());
  if (!sessionUser) redirect("/login");

  const designation = sessionUser.designation;

  if (ADMIN_ONLY.includes(designation ?? "")) {
    // Admin: workforce overview + current schedule, no personal widgets
    const data = await fetchAdminDashboardData(sessionUser);
    return <AdminDashboard data={data} sessionUser={sessionUser} showSchedule />;
  }

  if (MID_TIER.includes(designation ?? "")) {
    // Chairman / Management / Supervisor: admin view (no schedule) + personal section
    const [adminData, personalData] = await Promise.all([
      fetchAdminDashboardData(sessionUser),
      fetchPersonalDashboardData(sessionUser),
    ]);
    return (
      <AdminDashboard
        data={adminData}
        sessionUser={sessionUser}
        showSchedule={false}
        personalData={personalData}
      />
    );
  }

  // General (and any unknown designation): personal view only
  const personalData = await fetchPersonalDashboardData(sessionUser);
  return <GeneralDashboard data={personalData} sessionUser={sessionUser} />;
}
