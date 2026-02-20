-- Arroyyan Petshop Management System - Initial Schema
-- Migration file for Petshop tables

-- ============================================
-- Better Auth Tables
-- ============================================

-- User table
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" integer DEFAULT 0 NOT NULL,
  "image" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

-- Session table
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

-- Account table (for OAuth providers)
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

-- Verification table (for email verification, password reset, etc.)
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" integer NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

-- ============================================
-- Petshop Application Tables
-- ============================================

-- Customer table
CREATE TABLE IF NOT EXISTS "customer" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "phone" text NOT NULL,
  "address" text,
  "notes" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

-- Pet table
CREATE TABLE IF NOT EXISTS "pet" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_id" text NOT NULL REFERENCES "customer"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "species" text NOT NULL,
  "breed" text,
  "date_of_birth" integer,
  "gender" text,
  "weight" real,
  "color" text,
  "medical_notes" text,
  "photo_url" text,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

-- Service table
CREATE TABLE IF NOT EXISTS "service" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" real NOT NULL,
  "duration" integer,
  "category" text NOT NULL,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

-- Product table
CREATE TABLE IF NOT EXISTS "product" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "sku" text NOT NULL UNIQUE,
  "category" text NOT NULL,
  "price" real NOT NULL,
  "cost" real,
  "stock" integer NOT NULL DEFAULT 0,
  "min_stock" integer NOT NULL DEFAULT 5,
  "unit" text,
  "photo_url" text,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

-- Appointment table
CREATE TABLE IF NOT EXISTS "appointment" (
  "id" text PRIMARY KEY NOT NULL,
  "pet_id" text NOT NULL REFERENCES "pet"("id") ON DELETE CASCADE,
  "service_id" text NOT NULL REFERENCES "service"("id") ON DELETE RESTRICT,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "appointment_date" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "notes" text,
  "total_price" real,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

-- Sale table
CREATE TABLE IF NOT EXISTS "sale" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_id" text REFERENCES "customer"("id") ON DELETE SET NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "sale_date" integer NOT NULL,
  "total_amount" real NOT NULL,
  "discount" real DEFAULT 0,
  "final_amount" real NOT NULL,
  "payment_method" text NOT NULL,
  "notes" text,
  "created_at" integer NOT NULL
);

-- Sale Item table
CREATE TABLE IF NOT EXISTS "sale_item" (
  "id" text PRIMARY KEY NOT NULL,
  "sale_id" text NOT NULL REFERENCES "sale"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "product"("id") ON DELETE RESTRICT,
  "quantity" integer NOT NULL,
  "price" real NOT NULL,
  "subtotal" real NOT NULL
);

-- ============================================
-- Indexes for better query performance
-- ============================================

-- Auth indexes
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session"("user_id");
CREATE INDEX IF NOT EXISTS "session_token_idx" ON "session"("token");
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account"("user_id");
CREATE INDEX IF NOT EXISTS "account_provider_idx" ON "account"("provider_id", "account_id");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");

-- Customer indexes
CREATE INDEX IF NOT EXISTS "customer_user_id_idx" ON "customer"("user_id");
CREATE INDEX IF NOT EXISTS "customer_email_idx" ON "customer"("email");

-- Pet indexes
CREATE INDEX IF NOT EXISTS "pet_customer_id_idx" ON "pet"("customer_id");
CREATE INDEX IF NOT EXISTS "pet_species_idx" ON "pet"("species");
CREATE INDEX IF NOT EXISTS "pet_is_active_idx" ON "pet"("is_active");

-- Service indexes
CREATE INDEX IF NOT EXISTS "service_category_idx" ON "service"("category");
CREATE INDEX IF NOT EXISTS "service_is_active_idx" ON "service"("is_active");

-- Product indexes
CREATE INDEX IF NOT EXISTS "product_sku_idx" ON "product"("sku");
CREATE INDEX IF NOT EXISTS "product_category_idx" ON "product"("category");
CREATE INDEX IF NOT EXISTS "product_is_active_idx" ON "product"("is_active");

-- Appointment indexes
CREATE INDEX IF NOT EXISTS "appointment_pet_id_idx" ON "appointment"("pet_id");
CREATE INDEX IF NOT EXISTS "appointment_service_id_idx" ON "appointment"("service_id");
CREATE INDEX IF NOT EXISTS "appointment_date_idx" ON "appointment"("appointment_date");
CREATE INDEX IF NOT EXISTS "appointment_status_idx" ON "appointment"("status");

-- Sale indexes
CREATE INDEX IF NOT EXISTS "sale_customer_id_idx" ON "sale"("customer_id");
CREATE INDEX IF NOT EXISTS "sale_user_id_idx" ON "sale"("user_id");
CREATE INDEX IF NOT EXISTS "sale_date_idx" ON "sale"("sale_date");

-- Sale Item indexes
CREATE INDEX IF NOT EXISTS "sale_item_sale_id_idx" ON "sale_item"("sale_id");
CREATE INDEX IF NOT EXISTS "sale_item_product_id_idx" ON "sale_item"("product_id");
