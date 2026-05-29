import { fetchTasks } from "./actions";
import { TaskMasterClient } from "./_components/task-master-client";

export default async function TasksPage() {
  const tasks = await fetchTasks();

  return (
    <div className="mt-6">
      <TaskMasterClient initialTasks={tasks} />
    </div>
  );
}
