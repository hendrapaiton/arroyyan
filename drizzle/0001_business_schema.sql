-- Arroyyan Petshop Management System - Business Schema
-- Core tables for Petshop operations

-- Products table (master data produk)
CREATE TABLE IF NOT EXISTS "products" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "sku" text NOT NULL UNIQUE,
  "selling_price" real NOT NULL,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

-- Suppliers table (data pemasok)
CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "contact_person" text,
  "phone" text,
  "email" text,
  "address" text,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

-- Supply Orders table (penerimaan pasokan dari supplier)
CREATE TABLE IF NOT EXISTS "supply_orders" (
  "id" text PRIMARY KEY NOT NULL,
  "order_number" text NOT NULL UNIQUE,
  "supplier_id" text NOT NULL REFERENCES "suppliers"("id") ON DELETE RESTRICT,
  "order_date" text NOT NULL,
  "total_amount" real DEFAULT 0 NOT NULL,
  "notes" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

-- Supply Order Items table (item pasokan)
CREATE TABLE IF NOT EXISTS "supply_order_items" (
  "id" text PRIMARY KEY NOT NULL,
  "supply_order_id" text NOT NULL REFERENCES "supply_orders"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "quantity" integer NOT NULL,
  "purchase_price" real NOT NULL,
  "subtotal" real NOT NULL,
  "created_at" text NOT NULL
);

-- Inventory table (stok gudang & etalase)
CREATE TABLE IF NOT EXISTS "inventory" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "warehouse_stock" integer DEFAULT 0 NOT NULL,
  "display_stock" integer DEFAULT 0 NOT NULL,
  "last_stock_update" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

-- Stock Transfers table (pemindahan stok gudang → etalase)
CREATE TABLE IF NOT EXISTS "stock_transfers" (
  "id" text PRIMARY KEY NOT NULL,
  "transfer_number" text NOT NULL UNIQUE,
  "transfer_date" text NOT NULL,
  "notes" text,
  "performed_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" text NOT NULL
);

-- Stock Transfer Items table (item transfer)
CREATE TABLE IF NOT EXISTS "stock_transfer_items" (
  "id" text PRIMARY KEY NOT NULL,
  "transfer_id" text NOT NULL REFERENCES "stock_transfers"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "quantity" integer NOT NULL,
  "created_at" text NOT NULL
);

-- Sales table (transaksi penjualan)
CREATE TABLE IF NOT EXISTS "sales" (
  "id" text PRIMARY KEY NOT NULL,
  "sale_number" text NOT NULL UNIQUE,
  "sale_date" text NOT NULL,
  "reference_number" text,
  "total_amount" real DEFAULT 0 NOT NULL,
  "payment_method" text NOT NULL,
  "paid_amount" real NOT NULL,
  "change_amount" real DEFAULT 0 NOT NULL,
  "notes" text,
  "cashier_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

-- Sale Items table (item penjualan)
CREATE TABLE IF NOT EXISTS "sale_items" (
  "id" text PRIMARY KEY NOT NULL,
  "sale_id" text NOT NULL REFERENCES "sales"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "quantity" integer NOT NULL,
  "unit_price" real NOT NULL,
  "subtotal" real NOT NULL,
  "created_at" text NOT NULL
);

-- Indexes for products
CREATE INDEX IF NOT EXISTS "products_sku_idx" ON "products"("sku");
CREATE INDEX IF NOT EXISTS "products_is_active_idx" ON "products"("is_active");
CREATE INDEX IF NOT EXISTS "products_name_idx" ON "products"("name");

-- Indexes for supply orders
CREATE INDEX IF NOT EXISTS "supply_orders_order_number_idx" ON "supply_orders"("order_number");
CREATE INDEX IF NOT EXISTS "supply_orders_supplier_id_idx" ON "supply_orders"("supplier_id");
CREATE INDEX IF NOT EXISTS "supply_orders_order_date_idx" ON "supply_orders"("order_date");

-- Indexes for sales
CREATE INDEX IF NOT EXISTS "sales_sale_number_idx" ON "sales"("sale_number");
CREATE INDEX IF NOT EXISTS "sales_sale_date_idx" ON "sales"("sale_date");
CREATE INDEX IF NOT EXISTS "sales_cashier_id_idx" ON "sales"("cashier_id");

-- Indexes for inventory
CREATE INDEX IF NOT EXISTS "inventory_product_id_idx" ON "inventory"("product_id");
