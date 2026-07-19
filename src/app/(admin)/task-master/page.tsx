import { fetchBranchNames, fetchTasks } from "./actions";
import { TaskMasterClient } from "./_components/task-master-client";

export default async function TasksPage() {
  const [tasks, branchNames] = await Promise.all([fetchTasks(), fetchBranchNames()]);

  return (
    <div className="mt-6">
      <TaskMasterClient initialTasks={tasks} branchNames={branchNames} />
    </div>
  );
}
