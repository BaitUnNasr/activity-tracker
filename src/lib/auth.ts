import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
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