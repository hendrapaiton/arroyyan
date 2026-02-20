import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "./schema";

/**
 * Create a Drizzle ORM instance using Cloudflare D1 database
 */
export function createDb(d1Database: D1Database) {
  return drizzle(d1Database, { schema });
}

export type Database = ReturnType<typeof createDb>;
