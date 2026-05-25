export const Roles = {
   SUPER_ADMIN: "super_admin",
   ADMIN: "admin",
   CHAIRMAN: "chairman",
   SUPERVISOR: "supervisor",
   GENERAL: "general",
} as const
export type Role = (typeof Roles)[keyof typeof Roles]