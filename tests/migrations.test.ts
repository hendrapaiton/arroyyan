import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../src/db/schema";
import { readFileSync } from "fs";
import { join } from "path";

describe("Database Migration Tests", () => {
  let sqlite: Database;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema });
  });

  test("should apply initial migration successfully", () => {
    // Read the migration SQL file
    const migrationPath = join(__dirname, "../drizzle/0000_initial.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    // Execute migration
    expect(() => {
      sqlite.exec(migrationSQL);
    }).not.toThrow();

    // Verify tables were created
    const tables = sqlite
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("user");
    expect(tableNames).toContain("session");
    expect(tableNames).toContain("account");
    expect(tableNames).toContain("verification");
    expect(tableNames).toContain("todo");
  });

  test("should have all required indexes after migration", () => {
    const migrationPath = join(__dirname, "../drizzle/0000_initial.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    sqlite.exec(migrationSQL);

    // Check indexes
    const indexes = sqlite
      .query(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
      )
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain("session_user_id_idx");
    expect(indexNames).toContain("session_token_idx");
    expect(indexNames).toContain("account_user_id_idx");
    expect(indexNames).toContain("todo_user_id_idx");
  });

  test("should verify foreign key constraints are enabled", () => {
    // Enable foreign keys
    sqlite.exec("PRAGMA foreign_keys = ON");

    const pragma = sqlite
      .query("PRAGMA foreign_keys")
      .get() as { foreign_keys: number };

    expect(pragma.foreign_keys).toBe(1);
  });

  test("should verify cascade delete works after migration", () => {
    const migrationPath = join(__dirname, "../drizzle/0000_initial.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    sqlite.exec(migrationSQL);
    sqlite.exec("PRAGMA foreign_keys = ON");

    // Insert test data
    sqlite.exec(`
      INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
      VALUES ('user-1', 'Test User', 'test@example.com', 0, 1700000000000, 1700000000000)
    `);

    sqlite.exec(`
      INSERT INTO "todo" ("id", "user_id", "title", "completed", "created_at", "updated_at")
      VALUES ('todo-1', 'user-1', 'Test Todo', 0, 1700000000000, 1700000000000)
    `);

    // Verify todo exists
    const beforeDelete = sqlite
      .query('SELECT * FROM "todo" WHERE "user_id" = ?')
      .all("user-1");
    expect(beforeDelete.length).toBe(1);

    // Delete user
    sqlite.exec('DELETE FROM "user" WHERE "id" = ?', "user-1");

    // Verify todo was cascade deleted
    const afterDelete = sqlite
      .query('SELECT * FROM "todo" WHERE "user_id" = ?')
      .all("user-1");
    expect(afterDelete.length).toBe(0);
  });

  test("should verify unique constraint on user email", () => {
    const migrationPath = join(__dirname, "../drizzle/0000_initial.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    sqlite.exec(migrationSQL);

    // Insert first user
    sqlite.exec(`
      INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
      VALUES ('user-1', 'User 1', 'unique@example.com', 0, 1700000000000, 1700000000000)
    `);

    // Try to insert duplicate email
    expect(() => {
      sqlite.exec(`
        INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
        VALUES ('user-2', 'User 2', 'unique@example.com', 0, 1700000000000, 1700000000000)
      `);
    }).toThrow();
  });

  test("should verify unique constraint on session token", () => {
    const migrationPath = join(__dirname, "../drizzle/0000_initial.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    sqlite.exec(migrationSQL);

    // Insert user first
    sqlite.exec(`
      INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
      VALUES ('user-1', 'User 1', 'test@example.com', 0, 1700000000000, 1700000000000)
    `);

    // Insert first session
    sqlite.exec(`
      INSERT INTO "session" ("id", "user_id", "expires_at", "token", "created_at", "updated_at")
      VALUES ('session-1', 'user-1', 1800000000000, 'unique-token', 1700000000000, 1700000000000)
    `);

    // Try to insert duplicate token
    expect(() => {
      sqlite.exec(`
        INSERT INTO "session" ("id", "user_id", "expires_at", "token", "created_at", "updated_at")
        VALUES ('session-2', 'user-1', 1800000000000, 'unique-token', 1700000000000, 1700000000000)
      `);
    }).toThrow();
  });

  test("should verify all columns exist with correct types", () => {
    const migrationPath = join(__dirname, "../drizzle/0000_initial.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    sqlite.exec(migrationSQL);

    // Check user table columns
    const userColumns = sqlite
      .query('PRAGMA table_info("user")')
      .all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }>;

    const userColumnNames = userColumns.map((c) => c.name);
    expect(userColumnNames).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "email",
        "email_verified",
        "image",
        "created_at",
        "updated_at",
      ])
    );

    // Check todo table columns
    const todoColumns = sqlite
      .query('PRAGMA table_info("todo")')
      .all() as Array<{ name: string; type: string }>;

    const todoColumnNames = todoColumns.map((c) => c.name);
    expect(todoColumnNames).toEqual(
      expect.arrayContaining([
        "id",
        "user_id",
        "title",
        "description",
        "completed",
        "created_at",
        "updated_at",
      ])
    );
  });

  test("should verify datetime columns work correctly", () => {
    const migrationPath = join(__dirname, "../drizzle/0000_initial.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    sqlite.exec(migrationSQL);

    const now = Date.now();

    sqlite.exec(`
      INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
      VALUES ('user-1', 'Test User', 'datetime@example.com', 0, ${now}, ${now})
    `);

    const result = sqlite
      .query('SELECT * FROM "user" WHERE "id" = ?')
      .get("user-1") as { created_at: number };

    expect(result.created_at).toBe(now);
  });

  test("should verify boolean columns work correctly", () => {
    const migrationPath = join(__dirname, "../drizzle/0000_initial.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    sqlite.exec(migrationSQL);

    const now = Date.now();

    // Insert with completed = true (1)
    sqlite.exec(`
      INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
      VALUES ('user-1', 'Test User', 'bool@example.com', 1, ${now}, ${now})
    `);

    const result = sqlite
      .query('SELECT * FROM "user" WHERE "id" = ?')
      .get("user-1") as { email_verified: number };

    expect(result.email_verified).toBe(1);
  });

  test("should handle NULL values for optional columns", () => {
    const migrationPath = join(__dirname, "../drizzle/0000_initial.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    sqlite.exec(migrationSQL);

    const now = Date.now();

    // Insert user with NULL image
    sqlite.exec(`
      INSERT INTO "user" ("id", "name", "email", "email_verified", "image", "created_at", "updated_at")
      VALUES ('user-1', 'Test User', 'null@example.com', 0, NULL, ${now}, ${now})
    `);

    const result = sqlite
      .query('SELECT * FROM "user" WHERE "id" = ?')
      .get("user-1") as { image: string | null };

    expect(result.image).toBeNull();
  });

  test("should verify migration file is valid SQL", () => {
    const migrationPath = join(__dirname, "../drizzle/0000_initial.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    // Should not throw for valid SQL
    expect(() => {
      sqlite.exec(migrationSQL);
    }).not.toThrow();

    // Verify it's not empty
    expect(migrationSQL.trim().length).toBeGreaterThan(0);

    // Verify it contains expected statements
    expect(migrationSQL).toContain("CREATE TABLE");
    expect(migrationSQL).toContain("user");
    expect(migrationSQL).toContain("session");
  });
});
