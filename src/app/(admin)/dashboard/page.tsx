import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/src/lib/session";
import { fetchDashboardData } from "./data";
import { Dashboard } from "./_components/dashboard";

export default async function DashboardPage() {
  const sessionUser = await getSessionUser(await headers());
  if (!sessionUser) redirect("/login");

  return <Dashboard data={await fetchDashboardData(sessionUser)} sessionUser={sessionUser} />;
}
