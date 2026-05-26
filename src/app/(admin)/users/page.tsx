import { fetchUsersPageData } from "./actions";
import { UsersTable } from "./_components/users-table";

export default async function UsersPage() {
  const { users, designations, branches, isAdmin } = await fetchUsersPageData();

  return (
    <div className="mt-6">
      <div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
          Users
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your team members and their access.
        </p>
      </div>
      <div className="mt-6">
        <UsersTable
          rows={users}
          canAddUser={isAdmin}
          designations={designations}
          branches={branches}
        />
      </div>
    </div>
  );
}
