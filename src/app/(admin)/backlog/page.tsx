import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { VISIBLE_DESIGNATIONS } from "@/src/lib/access";
import { getSessionUser } from "@/src/lib/session";
import { fetchBacklogMonth } from "./data";
import { BacklogClient } from "./_components/backlog-client";

export default async function BacklogPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sessionUser = await getSessionUser(await headers());
  if (!sessionUser) redirect("/login");
  if (!(sessionUser.designation && sessionUser.designation in VISIBLE_DESIGNATIONS)) {
    redirect("/dashboard");
  }

  const { month } = await searchParams;
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const valid = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : current;

  const data = await fetchBacklogMonth(sessionUser, valid);

  return (
    <div className="mt-6">
      <BacklogClient key={data.month} data={data} />
    </div>
  );
}
