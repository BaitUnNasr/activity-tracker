// Leave-type constants shared across server actions and client components.
// Kept out of the "use server" actions file, which may only export async functions.

export type LeaveType = "casual" | "earned" | "unpaid";

export const LEAVE_TYPES: readonly LeaveType[] = ["casual", "earned", "unpaid"];
