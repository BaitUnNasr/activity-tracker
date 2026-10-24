import "dotenv/config";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "./client";
import {
  account,
  branchMaster,
  designationMaster,
  user,
  userBranchLink,
  userDesignationLink,
} from "./schema";

const designationNames = [
  "SuperAdmin",
  "Admin",
  "Chairman",
  "Management",
  "Supervisor",
  "General",
];

const branchNames = [
  "Head Office",
  "Mahim",
  "Bandra (W)",
  "Memonwada",
  "Jogeshwari (W)",
  "Jogeshwari (E)",
  "Dharavi",
  "Morland Road",
  "Mira Road",
  "Mumbra",
];

const seeds = [
  { name: "Admin",      email: "admin@gmail.com",      employeeCode: "EMP001", type: "F", designation: "Admin",      branch: "Mahim"       },
  { name: "Chairman",   email: "chairman@gmail.com",    employeeCode: "EMP002", type: "F", designation: "Chairman",   branch: "Bandra (W)"  },
  { name: "Management", email: "management@gmail.com",  employeeCode: "EMP003", type: "F", designation: "Management", branch: "Mumbra"      },
  { name: "Supervisor", email: "supervisor@gmail.com",  employeeCode: "EMP004", type: "F", designation: "Supervisor", branch: "Mira Road"   },
  { name: "General",    email: "general@gmail.com",     employeeCode: "EMP005", type: "T", designation: "General",    branch: "Head Office" },
];

async function seed() {
  // 1. Designation master
  console.log("\n--- Designations ---");
  for (const name of designationNames) {
    const [existing] = await db.select().from(designationMaster).where(eq(designationMaster.name, name));
    if (existing) { console.log(`  skip  ${name}`); continue; }
    await db.insert(designationMaster).values({ name });
    console.log(`  created  ${name}`);
  }

  // 2. Branch master
  console.log("\n--- Branches ---");
  for (const name of branchNames) {
    const [existing] = await db.select().from(branchMaster).where(eq(branchMaster.name, name));
    if (existing) { console.log(`  skip  ${name}`); continue; }
    await db.insert(branchMaster).values({ name });
    console.log(`  created  ${name}`);
  }

  // Build lookup maps
  const allDesignations = await db.select().from(designationMaster);
  const allBranches     = await db.select().from(branchMaster);
  const designationMap  = Object.fromEntries(allDesignations.map((d) => [d.name, d.id]));
  const branchMap       = Object.fromEntries(allBranches.map((b) => [b.name, b.id]));

  const today = new Date().toISOString().split("T")[0]!;

  // 3. Users + links
  console.log("\n--- Users ---");
  for (const { name, email, employeeCode, type, designation, branch } of seeds) {
    let [existing] = await db.select().from(user).where(eq(user.email, email));

    if (!existing) {
      // Sign-up is disabled in auth config, so insert user + credential account directly.
      const id = randomUUID();
      await db.insert(user).values({ id, name, email, employeeCode, type, emailVerified: true });
      await db.insert(account).values({
        id: randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: await hashPassword("Demo@123"),
      });
      [existing] = await db.select().from(user).where(eq(user.email, email));
      console.log(`  created  ${name} <${email}>`);
    } else {
      console.log(`  skip     ${email}`);
    }

    const userId = existing!.id;

    // Designation link
    const desigId = designationMap[designation];
    if (desigId) {
      const [existingLink] = await db
        .select()
        .from(userDesignationLink)
        .where(eq(userDesignationLink.userId, userId));
      if (!existingLink) {
        await db.insert(userDesignationLink).values({ userId, designationId: desigId, startDate: today });
        console.log(`           → designation: ${designation}`);
      }
    }

    // Branch link
    const branchId = branchMap[branch];
    if (branchId) {
      const [existingLink] = await db
        .select()
        .from(userBranchLink)
        .where(eq(userBranchLink.userId, userId));
      if (!existingLink) {
        await db.insert(userBranchLink).values({ userId, branchId, startDate: today });
        console.log(`           → branch: ${branch}`);
      }
    }
  }

  console.log("\nDone.");
}

seed()
  .catch(console.error)
  .finally(() => process.exit(0));
