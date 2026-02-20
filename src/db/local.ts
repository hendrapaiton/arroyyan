/**
 * Database connection for local development with Bun
 * Uses libsql SQLite for local testing
 */

import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const sqlite = createClient({
  url: "file:cuan.db",
});

export const db = drizzle(sqlite, { schema });

// Export createDb for consistency
export function createDb() {
  return db;
}

export type Database = typeof db;
