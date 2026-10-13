import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/src/lib/session";
import { fetchTasksPageData } from "./data";
import { TaskInputClient } from "./_components/task-input-client";

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const sessionUser = await getSessionUser(await headers());
  if (!sessionUser) redirect("/login");

  const today = getToday();
  // Dashboard links land on a specific day; anything malformed falls back to today.
  const { date } = await searchParams;
  const initialDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const data = await fetchTasksPageData(
    sessionUser.id,
    sessionUser.designation,
    sessionUser.branch,
    sessionUser.type,
    today,
  );

  return (
    <div className="mt-6">
      <TaskInputClient today={today} initialDate={initialDate} initialData={data} />
    </div>
  );
}
