import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "../src/db/schema";

/**
 * Create an in-memory SQLite database for testing
 */
export function createTestDatabase() {
  // Create in-memory database
  const sqlite = new Database(":memory:");
  
  // Enable foreign keys
  sqlite.exec("PRAGMA foreign_keys = ON");
  
  const db = drizzle(sqlite, { schema });

  // Create all tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "email" text NOT NULL UNIQUE,
      "email_verified" integer DEFAULT 0 NOT NULL,
      "image" text,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "session" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "expires_at" integer NOT NULL,
      "token" text NOT NULL UNIQUE,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL,
      "ip_address" text,
      "user_agent" text
    );

    CREATE TABLE IF NOT EXISTS "account" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "account_id" text NOT NULL,
      "provider_id" text NOT NULL,
      "access_token" text,
      "refresh_token" text,
      "access_token_expires_at" integer,
      "refresh_token_expires_at" integer,
      "scope" text,
      "id_token" text,
      "password" text,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "verification" (
      "id" text PRIMARY KEY NOT NULL,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expires_at" integer NOT NULL,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "todo" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "title" text NOT NULL,
      "description" text,
      "completed" integer DEFAULT 0 NOT NULL,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session"("user_id");
    CREATE INDEX IF NOT EXISTS "session_token_idx" ON "session"("token");
    CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account"("user_id");
    CREATE INDEX IF NOT EXISTS "account_provider_idx" ON "account"("provider_id", "account_id");
    CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");
    CREATE INDEX IF NOT EXISTS "todo_user_id_idx" ON "todo"("user_id");
  `);

  return { db, sqlite };
}

/**
 * Test data factories
 */
export const factories = {
  user: (overrides: Partial<schema.NewUser> = {}) => {
    const now = new Date();
    const randomId = Math.random().toString(36).substring(2, 10);
    return {
      id: `user_${Date.now()}_${randomId}`,
      name: "Test User",
      email: `test_${randomId}@example.com`,
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    } as schema.NewUser;
  },

  session: (userId: string, overrides: Partial<schema.NewSession> = {}) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    return {
      id: `session_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      userId,
      expiresAt,
      token: `token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      createdAt: now,
      updatedAt: now,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
      ...overrides,
    } as schema.NewSession;
  },

  todo: (userId: string, overrides: Partial<schema.NewTodo> = {}) => {
    const now = new Date();
    return {
      id: `todo_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      userId,
      title: "Test Todo",
      description: "Test Description",
      completed: false,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    } as schema.NewTodo;
  },
};
