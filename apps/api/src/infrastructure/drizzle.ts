import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/drizzle/schema.ts";

export type Drizzle = ReturnType<typeof createDrizzleClient>;

export function createDrizzleClient(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

let singleton: Drizzle | null = null;

export function getDrizzle(): Drizzle {
  if (!singleton) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required");
    singleton = createDrizzleClient(url);
  }
  return singleton;
}
