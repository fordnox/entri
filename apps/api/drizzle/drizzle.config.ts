import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for the Orbit API.
 *
 * Used by `npm run drizzle:generate` (produces a new SQL migration
 * from pending schema edits) and `npm run drizzle:migrate` (applies
 * pending migrations to the database in `DATABASE_URL`).
 *
 * The schema at `src/db/drizzle/schema.ts` is the source of truth —
 * edit it, then generate + migrate.
 */
export default defineConfig({
  schema: "./src/db/drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
