import { fetchBranchNames, fetchEmployees, fetchTasks } from "./actions";
import { TaskMasterClient } from "./_components/task-master-client";

export default async function TasksPage() {
  const [tasks, branchNames, employees] = await Promise.all([
    fetchTasks(),
    fetchBranchNames(),
    fetchEmployees(),
  ]);

  return (
    <div className="mt-6">
      <TaskMasterClient initialTasks={tasks} branchNames={branchNames} employees={employees} />
    </div>
  );
}
