import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { user } from "./schema";
import { auth } from "../lib/auth";
import { Roles } from "../lib/constants";

const seeds = [
  { name: "Admin", email: "admin@gmail.com", role: Roles.ADMIN },
  { name: "Chairman", email: "chairman@gmail.com", role: Roles.CHAIRMAN },
];

async function seed() {
  for (const { name, email, role } of seeds) {
    const existing = await db.select().from(user).where(eq(user.email, email));
    if (existing.length > 0) {
      console.log(`Skipping ${email} — already exists`);
      continue;
    }

    await auth.api.signUpEmail({
      body: { name, email, password: "Demo@123" },
    });

    await db
      .update(user)
      .set({ role, emailVerified: true })
      .where(eq(user.email, email));

    console.log(`Created ${name} <${email}> with role "${role}"`);
  }
}

seed()
  .catch(console.error)
  .finally(() => process.exit(0));
