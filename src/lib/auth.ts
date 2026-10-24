import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    // Accounts are provisioned by admins via createUser, never self-registered.
    disableSignUp: true,
  },
  // A deactivated user must not get a session, whichever sign-in route they use
  // (/api/login or better-auth's own /api/auth/sign-in/email). Returning false aborts.
  databaseHooks: {
    session: {
      create: {
        before: async (s) => {
          const [u] = await db
            .select({ isActive: schema.user.isActive })
            .from(schema.user)
            .where(eq(schema.user.id, s.userId));
          return !!u?.isActive;
        },
      },
    },
  },
  user: {
    additionalFields: {
      employeeCode: {
        type: "string",
        required: true,
        input: false,
        fieldName: "employeeCode",
      },
      type: {
        type: "string",
        required: true,
        input: false,
        fieldName: "type",
      },
    },
  },
});