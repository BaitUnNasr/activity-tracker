// Designation hierarchy: which designations each role may view/manage.
// Empty array = Admin (sees everyone, across all branches).
export const VISIBLE_DESIGNATIONS: Record<string, string[]> = {
  Admin: [],
  Chairman: ["Management", "Supervisor", "General"],
  Management: ["Supervisor", "General"],
  Supervisor: ["General"],
};

type Scoped = { designation: string | null; branch: string | null };

/**
 * Can `viewer` view the activity of `target`?
 * Rule: Admin → anyone. Others → target's designation is strictly below the
 * viewer's (per VISIBLE_DESIGNATIONS) AND they share the same branch.
 */
export function canViewUserActivity(viewer: Scoped, target: Scoped): boolean {
  const role = viewer.designation;
  if (!role || role === "General") return false;
  if (role === "Admin") return true;

  const visible = VISIBLE_DESIGNATIONS[role] ?? [];
  if (!target.designation || !visible.includes(target.designation)) return false;

  // Non-admin roles are restricted to their own branch.
  return !!viewer.branch && viewer.branch === target.branch;
}
