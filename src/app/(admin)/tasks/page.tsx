import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/src/lib/session";
import { fetchTasksPageData } from "./actions";
import { TaskInputClient } from "./_components/task-input-client";

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function TasksPage() {
  const sessionUser = await getSessionUser(await headers());
  if (!sessionUser) redirect("/login");

  const today = getToday();
  const data = await fetchTasksPageData(
    sessionUser.id,
    sessionUser.designation,
    sessionUser.type,
    today,
  );

  return (
    <div className="mt-6">
      <TaskInputClient userId={sessionUser.id} today={today} initialData={data} />
    </div>
  );
}
