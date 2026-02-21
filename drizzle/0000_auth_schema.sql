-- Arroyyan Petshop Management System - Auth Schema
-- Better Auth with JWT (Username Based)

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "username" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "password" text NOT NULL,
  "role" text DEFAULT 'guest' NOT NULL,
  "image" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

-- Sessions table (for JWT tokens)
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expires_at" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "ip_address" text,
  "user_agent" text
);

-- Refresh tokens table (for token rotation)
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expires_at" text NOT NULL,
  "created_at" text NOT NULL,
  "revoked_at" text,
  "replaced_by_token" text,
  "ip_address" text,
  "user_agent" text
);

-- Accounts table (for OAuth providers - optional)
CREATE TABLE IF NOT EXISTS "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

-- Indexes for auth tables
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions"("token");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_token_idx" ON "refresh_tokens"("token");
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
