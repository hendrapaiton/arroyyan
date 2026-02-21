import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ============================================================================
// AUTH SCHEMA (Better Auth with JWT - Username Based)
// ============================================================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(), // Login identifier
  name: text("name").notNull(), // Full name
  password: text("password").notNull(), // Hashed password
  role: text("role", { enum: ["admin", "cashier", "guest"] }).notNull().default("guest"),
  image: text("image"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  usernameIdx: index("users_username_idx").on(table.username),
  roleIdx: index("users_role_idx").on(table.role),
}));

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), // JWT token
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => ({
  userIdIdx: index("sessions_user_id_idx").on(table.userId),
  tokenIdx: index("sessions_token_idx").on(table.token),
  expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
}));

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), // Refresh token hash
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"), // For manual revocation
  replacedByToken: text("replaced_by_token"), // Token rotation tracking
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => ({
  userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
  tokenIdx: index("refresh_tokens_token_idx").on(table.token),
  expiresAtIdx: index("refresh_tokens_expires_at_idx").on(table.expiresAt),
}));

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ============================================================================
// CORE BUSINESS SCHEMA
// ============================================================================

// -----------------------------------------------------------------------------
// Products - Master data produk yang dijual
// -----------------------------------------------------------------------------
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(), // Stock Keeping Unit - kode unik produk
  sellingPrice: real("selling_price").notNull(), // Harga jual satuan
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  skuIdx: index("products_sku_idx").on(table.sku),
  isActiveIdx: index("products_is_active_idx").on(table.isActive),
  nameIdx: index("products_name_idx").on(table.name),
}));

// -----------------------------------------------------------------------------
// Suppliers - Data supplier/pemasok
// -----------------------------------------------------------------------------
export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// -----------------------------------------------------------------------------
// Supply Orders - Penerimaan pasokan dari supplier ke gudang
// Setiap supply order menambah stok gudang
// -----------------------------------------------------------------------------
export const supplyOrders = sqliteTable("supply_orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(), // Nomor referensi supply order
  supplierId: text("supplier_id").notNull().references(() => suppliers.id, { onDelete: "restrict" }),
  orderDate: text("order_date").notNull(), // Tanggal penerimaan barang
  totalAmount: real("total_amount").notNull().default(0), // Total nilai pembelian
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const supplyOrderItems = sqliteTable("supply_order_items", {
  id: text("id").primaryKey(),
  supplyOrderId: text("supply_order_id").notNull().references(() => supplyOrders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(), // Jumlah barang yang diterima
  purchasePrice: real("purchase_price").notNull(), // Harga beli satuan dari supplier
  subtotal: real("subtotal").notNull(), // quantity * purchasePrice
  createdAt: text("created_at").notNull(),
});

// -----------------------------------------------------------------------------
// Inventory - Stok barang di gudang dan etalase
// Memisahkan stok gudang (warehouse) dan etalase (display)
// -----------------------------------------------------------------------------
export const inventory = sqliteTable("inventory", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  warehouseStock: integer("warehouse_stock").notNull().default(0), // Stok di gudang
  displayStock: integer("display_stock").notNull().default(0), // Stok di etalase
  lastStockUpdate: text("last_stock_update").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// -----------------------------------------------------------------------------
// Stock Transfers - Pemindahan stok dari gudang ke etalase
// -----------------------------------------------------------------------------
export const stockTransfers = sqliteTable("stock_transfers", {
  id: text("id").primaryKey(),
  transferNumber: text("transfer_number").notNull().unique(), // Nomor referensi transfer
  transferDate: text("transfer_date").notNull(), // Tanggal transfer
  notes: text("notes"),
  performedBy: text("performed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
});

export const stockTransferItems = sqliteTable("stock_transfer_items", {
  id: text("id").primaryKey(),
  transferId: text("transfer_id").notNull().references(() => stockTransfers.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(), // Jumlah yang dipindahkan
  createdAt: text("created_at").notNull(),
});

// -----------------------------------------------------------------------------
// Sales - Transaksi penjualan di kasir
// -----------------------------------------------------------------------------
export const sales = sqliteTable("sales", {
  id: text("id").primaryKey(),
  saleNumber: text("sale_number").notNull().unique(), // Nomor referensi transaksi
  saleDate: text("sale_date").notNull(), // Tanggal transaksi
  referenceNumber: text("reference_number"), // Nomor referensi tambahan (jika ada)
  totalAmount: real("total_amount").notNull().default(0), // Total penjualan
  paymentMethod: text("payment_method", { enum: ["cash", "qris"] }).notNull(), // Metode pembayaran
  paidAmount: real("paid_amount").notNull(), // Jumlah yang dibayar
  changeAmount: real("change_amount").notNull().default(0), // Kembalian
  notes: text("notes"),
  cashierId: text("cashier_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  saleDateIdx: index("sales_sale_date_idx").on(table.saleDate),
  saleNumberIdx: index("sales_sale_number_idx").on(table.saleNumber),
  cashierIdIdx: index("sales_cashier_id_idx").on(table.cashierId),
}));

export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey(),
  saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(), // Jumlah barang yang dijual
  unitPrice: real("unit_price").notNull(), // Harga jual satuan saat transaksi
  subtotal: real("subtotal").notNull(), // quantity * unitPrice
  createdAt: text("created_at").notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  refreshTokens: many(refreshTokens),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  supplyOrderItems: many(supplyOrderItems),
  stockTransferItems: many(stockTransferItems),
  saleItems: many(saleItems),
  inventory: many(inventory),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  supplyOrders: many(supplyOrders),
}));

export const supplyOrdersRelations = relations(supplyOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [supplyOrders.supplierId],
    references: [suppliers.id],
  }),
  items: many(supplyOrderItems),
}));

export const supplyOrderItemsRelations = relations(supplyOrderItems, ({ one }) => ({
  supplyOrder: one(supplyOrders, {
    fields: [supplyOrderItems.supplyOrderId],
    references: [supplyOrders.id],
  }),
  product: one(products, {
    fields: [supplyOrderItems.productId],
    references: [products.id],
  }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
}));

export const stockTransfersRelations = relations(stockTransfers, ({ one, many }) => ({
  performedBy: one(users, {
    fields: [stockTransfers.performedBy],
    references: [users.id],
  }),
  items: many(stockTransferItems),
}));

export const stockTransferItemsRelations = relations(stockTransferItems, ({ one }) => ({
  transfer: one(stockTransfers, {
    fields: [stockTransferItems.transferId],
    references: [stockTransfers.id],
  }),
  product: one(products, {
    fields: [stockTransferItems.productId],
    references: [products.id],
  }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  cashier: one(users, {
    fields: [sales.cashierId],
    references: [users.id],
  }),
  items: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS (untuk TypeScript)
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type UserRole = "admin" | "cashier" | "guest";

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type SupplyOrder = typeof supplyOrders.$inferSelect;
export type NewSupplyOrder = typeof supplyOrders.$inferInsert;
export type SupplyOrderItem = typeof supplyOrderItems.$inferSelect;
export type NewSupplyOrderItem = typeof supplyOrderItems.$inferInsert;
export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;
export type StockTransfer = typeof stockTransfers.$inferSelect;
export type NewStockTransfer = typeof stockTransfers.$inferInsert;
export type StockTransferItem = typeof stockTransferItems.$inferSelect;
export type NewStockTransferItem = typeof stockTransferItems.$inferInsert;
export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;
export type SaleItem = typeof saleItems.$inferSelect;
export type NewSaleItem = typeof saleItems.$inferInsert;
