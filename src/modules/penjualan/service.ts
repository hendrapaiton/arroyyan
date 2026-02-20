/**
 * Module: Penjualan (Point of Sale)
 * Business logic untuk transaksi penjualan kasir
 */

import { createDb, type Bindings } from "../../db";
import {
  sales,
  saleItems,
  inventory,
  products,
  users,
  type Sale as SaleType,
  type SaleItem,
  type NewSale,
  type NewSaleItem,
} from "../../db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

// ============================================================================
// TYPES
// ============================================================================

export interface SaleItemInput {
  productId: string;
  quantity: number;
}

export interface CreateSaleInput {
  saleDate?: string;
  referenceNumber?: string;
  notes?: string;
  paymentMethod: "cash" | "qris";
  paidAmount: number;
  items: SaleItemInput[];
  cashierId?: string;
}

export interface SaleWithDetails extends SaleType {
  items: (SaleItem & {
    product: {
      id: string;
      name: string;
      sku: string;
      sellingPrice: number;
    };
  })[];
  cashier?: {
    id: string;
    username: string;
    name: string;
  } | null;
}

export interface SalesStats {
  totalTransactions: number;
  totalRevenue: number;
  totalItemsSold: number;
  averageTransactionValue: number;
  cashTransactions: number;
  qrisTransactions: number;
  topProducts: {
    productId: string;
    productName: string;
    sku: string;
    quantitySold: number;
    revenue: number;
  }[];
}

export interface TodaySummary {
  date: string;
  totalTransactions: number;
  totalRevenue: number;
  totalItemsSold: number;
  cashRevenue: number;
  qrisRevenue: number;
  openingStock: number;
  closingStock: number;
  stockMoved: number;
}

// ============================================================================
// ERRORS
// ============================================================================

export class SaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleError";
  }
}

export class InsufficientDisplayStockError extends SaleError {
  constructor(productId: string, requested: number, available: number) {
    super(`Stok etalase tidak cukup untuk product ${productId}. Diminta: ${requested}, Tersedia: ${available}`);
    this.name = "InsufficientDisplayStockError";
  }
}

export class InvalidProductError extends SaleError {
  constructor(productId: string, reason: string) {
    super(`Product ${productId} tidak valid: ${reason}`);
    this.name = "InvalidProductError";
  }
}

export class PaymentError extends SaleError {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate ID unik dengan prefix
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate sale number dengan format: INV-YYYYMMDD-XXX
 */
function generateSaleNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]!.replace(/-/g, ""); // YYYYMMDD
  const randomNum = Math.floor(Math.random() * 900) + 100; // 100-999

  return `INV-${dateStr}-${randomNum}`;
}

/**
 * Get current timestamp in ISO format
 */
function now(): string {
  return new Date().toISOString();
}

/**
 * Format date to YYYY-MM-DD
 */
function toDateOnly(date: Date | string): string {
  return new Date(date).toISOString().split("T")[0]!;
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Validate sale items before creation
 * - Check products exist and are active
 * - Check display stock is sufficient
 */
export async function validateSaleItems(
  items: SaleItemInput[]
): Promise<void> {
  for (const item of items) {
    // Validate quantity
    if (item.quantity < 1) {
      throw new InvalidProductError(item.productId, "Quantity harus minimal 1");
    }

    // Check product exists and is active
    const product = await db.query.products.findFirst({
      where: eq(products.id, item.productId),
    });

    if (!product) {
      throw new InvalidProductError(item.productId, "Product tidak ditemukan");
    }

    if (!product.isActive) {
      throw new InvalidProductError(item.productId, "Product tidak aktif");
    }

    // Check display stock
    const inv = await db.query.inventory.findFirst({
      where: eq(inventory.productId, item.productId),
    });

    const availableStock = inv !== undefined ? inv.displayStock : 0;

    if (availableStock < item.quantity) {
      throw new InsufficientDisplayStockError(
        item.productId,
        item.quantity,
        availableStock
      );
    }
  }
}

/**
 * Create sale transaction
 * - Creates sale record
 * - Creates sale items
 * - Updates inventory (display_stock -= quantity)
 * - Calculates totals automatically
 */
export async function createSale(
  db: ReturnType<typeof createDb>,
  input: CreateSaleInput
): Promise<SaleWithDetails> {
  const {
    saleDate,
    referenceNumber,
    notes,
    paymentMethod,
    paidAmount,
    items,
    cashierId,
  } = input;

  // Validate items first
  await validateSaleItems(items);

  // Calculate total amount based on current product prices
  let totalAmount = 0;
  const itemsWithPrices: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }> = [];

  for (const item of items) {
    const product = await db.query.products.findFirst({
      where: eq(products.id, item.productId),
    });

    if (!product) {
      throw new InvalidProductError(item.productId, "Product tidak ditemukan");
    }

    const unitPrice = product.sellingPrice;
    const subtotal = item.quantity * unitPrice;
    
    totalAmount += subtotal;
    itemsWithPrices.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      subtotal,
    });
  }

  // Validate payment
  if (paidAmount < totalAmount) {
    throw new PaymentError(
      `Uang pembayaran (${paidAmount}) kurang dari total (${totalAmount})`
    );
  }

  const changeAmount = paidAmount - totalAmount;

  const saleId = generateId("sale");
  const saleNumber = generateSaleNumber();
  const timestamp = now();
  const saleDateValue = saleDate || timestamp.split("T")[0]!;

  // Create sale using transaction for data consistency
  await db.transaction(async (tx) => {
    // 1. Insert sale record
    const saleInsert: NewSale = {
      id: saleId,
      saleNumber,
      saleDate: saleDateValue,
      referenceNumber: referenceNumber || null,
      totalAmount,
      paymentMethod,
      paidAmount,
      changeAmount,
      notes: notes || null,
      cashierId: cashierId !== undefined ? cashierId : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await tx.insert(sales).values(saleInsert);

    // 2. Insert sale items and update inventory
    for (const item of itemsWithPrices) {
      // Insert sale item
      await tx.insert(saleItems).values({
        id: generateId("salei"),
        saleId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        createdAt: timestamp,
      } satisfies NewSaleItem);

      // Update inventory: display_stock -= quantity
      const inv = await tx.query.inventory.findFirst({
        where: eq(inventory.productId, item.productId),
      });

      if (inv) {
        await tx
          .update(inventory)
          .set({
            displayStock: inv.displayStock - item.quantity,
            lastStockUpdate: timestamp,
            updatedAt: timestamp,
          })
          .where(eq(inventory.productId, item.productId));
      } else {
        throw new InvalidProductError(
          item.productId,
          "Inventory record tidak ditemukan"
        );
      }
    }
  });

  // Fetch and return created sale with details
  return getSaleById(saleId);
}

/**
 * Get sale by ID with full details
 */
export async function getSaleById(
  db: ReturnType<typeof createDb>,
  id: string
): Promise<SaleWithDetails> {
  const sale = await db.query.sales.findFirst({
    where: eq(sales.id, id),
    with: {
      items: {
        with: {
          product: {
            columns: {
              id: true,
              name: true,
              sku: true,
              sellingPrice: true,
            },
          },
        },
      },
      cashier: {
        columns: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
  });

  if (!sale) {
    throw new SaleError(`Sale ${id} tidak ditemukan`);
  }

  return sale as SaleWithDetails;
}

/**
 * Get all sales with pagination and filters
 */
export interface GetSalesFilters {
  startDate?: string;
  endDate?: string;
  cashierId?: string;
  paymentMethod?: "cash" | "qris";
  page?: number;
  limit?: number;
}

export interface GetSalesResult {
  sales: SaleWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export async function getSales(
  db: ReturnType<typeof createDb>,
  filters: GetSalesFilters = {}
): Promise<GetSalesResult> {
  const {
    startDate,
    endDate,
    cashierId,
    paymentMethod,
    page = 1,
    limit = 20,
  } = filters;

  // Build where conditions
  const conditions = [];

  if (startDate) {
    conditions.push(gte(sales.saleDate, startDate));
  }

  if (endDate) {
    conditions.push(lte(sales.saleDate, endDate));
  }

  if (cashierId) {
    conditions.push(eq(sales.cashierId, cashierId));
  }

  if (paymentMethod) {
    conditions.push(eq(sales.paymentMethod, paymentMethod));
  }

  // Fetch all sales first (for pagination)
  const allSales = await db.query.sales.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      items: {
        with: {
          product: {
            columns: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      },
      cashier: {
        columns: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
    orderBy: [desc(sales.saleDate), desc(sales.createdAt)],
  });

  // Pagination
  const total = allSales.length;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedSales = allSales.slice(startIndex, endIndex);

  return {
    sales: paginatedSales as SaleWithDetails[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: endIndex < total,
    },
  };
}

/**
 * Get sale items by sale ID
 */
export async function getSaleItems(
  db: ReturnType<typeof createDb>,
  saleId: string
): Promise<(SaleItem & { product: { id: string; name: string; sku: string } })[]> {
  // Check sale exists
  const sale = await db.query.sales.findFirst({
    where: eq(sales.id, saleId),
  });

  if (!sale) {
    throw new SaleError(`Sale ${saleId} tidak ditemukan`);
  }

  // Fetch items with product details
  const items = await db.query.saleItems.findMany({
    where: eq(saleItems.saleId, saleId),
    with: {
      product: {
        columns: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
  });

  return items as (SaleItem & {
    product: { id: string; name: string; sku: string };
  })[];
}

/**
 * Get sales statistics
 */
export async function getSalesStats(
  db: ReturnType<typeof createDb>,
  startDate?: string,
  endDate?: string
): Promise<SalesStats> {
  // Get all sales in date range
  const conditions = [];
  if (startDate) conditions.push(gte(sales.saleDate, startDate));
  if (endDate) conditions.push(lte(sales.saleDate, endDate));

  const allSales = await db.query.sales.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      items: true,
    },
  });

  // Calculate statistics
  const totalTransactions = allSales.length;
  const totalRevenue = allSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalItemsSold = allSales.reduce(
    (sum, sale) => sum + sale.items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const cashTransactions = allSales.filter((s) => s.paymentMethod === "cash").length;
  const qrisTransactions = allSales.filter((s) => s.paymentMethod === "qris").length;

  // Calculate top products
  const productStats = new Map<
    string,
    { productId: string; productName: string; sku: string; quantitySold: number; revenue: number }
  >();

  for (const sale of allSales) {
    for (const item of sale.items) {
      const existing = productStats.get(item.productId);
      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue += item.subtotal;
      } else {
        const product = await db.query.products.findFirst({
          where: eq(products.id, item.productId),
          columns: { id: true, name: true, sku: true },
        });
        
        if (product) {
          productStats.set(item.productId, {
            productId: item.productId,
            productName: product.name,
            sku: product.sku,
            quantitySold: item.quantity,
            revenue: item.subtotal,
          });
        }
      }
    }
  }

  // Sort by quantity sold and take top 10
  const topProducts = Array.from(productStats.values())
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 10);

  return {
    totalTransactions,
    totalRevenue,
    totalItemsSold,
    averageTransactionValue,
    cashTransactions,
    qrisTransactions,
    topProducts,
  };
}

/**
 * Get today's sales summary
 */
export async function getTodaySummary(
  db: ReturnType<typeof createDb>
): Promise<TodaySummary> {
  const today = toDateOnly(new Date());

  // Get today's sales
  const todaySales = await db.query.sales.findMany({
    where: eq(sales.saleDate, today),
    with: {
      items: true,
    },
  });

  const totalTransactions = todaySales.length;
  const totalRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalItemsSold = todaySales.reduce(
    (sum, sale) => sum + sale.items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const cashRevenue = todaySales
    .filter((s) => s.paymentMethod === "cash")
    .reduce((sum, sale) => sum + sale.totalAmount, 0);
  const qrisRevenue = todaySales
    .filter((s) => s.paymentMethod === "qris")
    .reduce((sum, sale) => sum + sale.totalAmount, 0);

  // Get stock movement (sum of all items sold today)
  const stockMoved = totalItemsSold;

  // Get current total display stock
  const allInventory = await db.query.inventory.findMany();
  const closingStock = allInventory.reduce((sum, inv) => sum + inv.displayStock, 0);
  const openingStock = closingStock + stockMoved; // Opening = closing + sold

  return {
    date: today,
    totalTransactions,
    totalRevenue,
    totalItemsSold,
    cashRevenue,
    qrisRevenue,
    openingStock,
    closingStock,
    stockMoved,
  };
}

/**
 * Get sales by cashier
 */
export async function getSalesByCashier(
  db: ReturnType<typeof createDb>,
  cashierId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  cashier: { id: string; username: string; name: string } | null;
  totalTransactions: number;
  totalRevenue: number;
  totalItemsSold: number;
  sales: SaleWithDetails[];
}> {
  // Get cashier info
  const cashierResult = await db.query.users.findFirst({
    where: eq(users.id, cashierId),
    columns: { id: true, username: true, name: true },
  });
  const cashier: { id: string; username: string; name: string } | null = cashierResult || null;

  // Get sales
  const conditions = [eq(sales.cashierId, cashierId)];
  if (startDate) conditions.push(gte(sales.saleDate, startDate));
  if (endDate) conditions.push(lte(sales.saleDate, endDate));

  const salesList = await db.query.sales.findMany({
    where: and(...conditions),
    with: {
      items: {
        with: {
          product: {
            columns: { id: true, name: true, sku: true },
          },
        },
      },
    },
    orderBy: [desc(sales.saleDate), desc(sales.createdAt)],
  });

  const totalTransactions = salesList.length;
  const totalRevenue = salesList.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalItemsSold = salesList.reduce(
    (sum, sale) => sum + sale.items.reduce((s, i) => s + i.quantity, 0),
    0
  );

  return {
    cashier,
    totalTransactions,
    totalRevenue,
    totalItemsSold,
    sales: salesList as SaleWithDetails[],
  };
}
