import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ============================================
// Better Auth Tables
// ============================================

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ============================================
// Petshop Application Tables
// ============================================

/**
 * Customers table - stores customer/pet owner information
 */
export const customer = sqliteTable("customer", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  address: text("address"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Pets table - stores pet information
 */
export const pet = sqliteTable("pet", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  species: text("species").notNull(), // dog, cat, bird, etc.
  breed: text("breed"),
  dateOfBirth: integer("date_of_birth", { mode: "timestamp" }),
  gender: text("gender"), // male, female
  weight: real("weight"), // in kg
  color: text("color"),
  medicalNotes: text("medical_notes"),
  photoUrl: text("photo_url"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Services table - stores available petshop services
 */
export const service = sqliteTable("service", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  duration: integer("duration"), // in minutes
  category: text("category").notNull(), // grooming, veterinary, boarding, etc.
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Products table - stores petshop products inventory
 */
export const product = sqliteTable("product", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku").notNull().unique(),
  category: text("category").notNull(), // food, toys, accessories, etc.
  price: real("price").notNull(),
  cost: real("cost"), // cost price for profit calculation
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(5), // reorder point
  unit: text("unit"), // kg, pcs, pack, etc.
  photoUrl: text("photo_url"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Appointments table - stores service appointments/bookings
 */
export const appointment = sqliteTable("appointment", {
  id: text("id").primaryKey(),
  petId: text("pet_id")
    .notNull()
    .references(() => pet.id, { onDelete: "cascade" }),
  serviceId: text("service_id")
    .notNull()
    .references(() => service.id, { onDelete: "restrict" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  appointmentDate: integer("appointment_date", { mode: "timestamp" }).notNull(),
  status: text("status").notNull().default("pending"), // pending, confirmed, completed, cancelled
  notes: text("notes"),
  totalPrice: real("total_price"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Sales table - stores product sales transactions
 */
export const sale = sqliteTable("sale", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .references(() => customer.id, { onDelete: "set null" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  saleDate: integer("sale_date", { mode: "timestamp" }).notNull(),
  totalAmount: real("total_amount").notNull(),
  discount: real("discount").default(0),
  finalAmount: real("final_amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, card, transfer
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Sale Items table - stores individual items in each sale
 */
export const saleItem = sqliteTable("sale_item", {
  id: text("id").primaryKey(),
  saleId: text("sale_id")
    .notNull()
    .references(() => sale.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  price: real("price").notNull(), // price at time of sale
  subtotal: real("subtotal").notNull(),
});

// Export all tables for Drizzle
export const schema = {
  user,
  session,
  account,
  verification,
  customer,
  pet,
  service,
  product,
  appointment,
  sale,
  saleItem,
};

// Type exports
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
export type Customer = typeof customer.$inferSelect;
export type NewCustomer = typeof customer.$inferInsert;
export type Pet = typeof pet.$inferSelect;
export type NewPet = typeof pet.$inferInsert;
export type Service = typeof service.$inferSelect;
export type NewService = typeof service.$inferInsert;
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type Appointment = typeof appointment.$inferSelect;
export type NewAppointment = typeof appointment.$inferInsert;
export type Sale = typeof sale.$inferSelect;
export type NewSale = typeof sale.$inferInsert;
export type SaleItem = typeof saleItem.$inferSelect;
export type NewSaleItem = typeof saleItem.$inferInsert;
