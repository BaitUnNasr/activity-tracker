import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "@/src/db/schema"

const globalForDb = globalThis as unknown as {
   _dbPool?: Pool
}

const pool =
   globalForDb._dbPool ??
   new Pool({
      connectionString: process.env.DATABASE_URL,
   })

if (process.env.NODE_ENV !== "production") {
   globalForDb._dbPool = pool
}

export const db = drizzle(pool, { schema })