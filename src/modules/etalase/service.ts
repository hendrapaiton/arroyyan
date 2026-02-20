/**
 * Module: Etalase (Stock Transfer)
 * Business logic untuk transfer stok dari gudang ke etalase
 */

import { createDb, type Bindings } from "../../db";
import {
  stockTransfers,
  stockTransferItems,
  inventory,
  products,
  type StockTransfer as StockTransferType,
  type StockTransferItem,
  type NewStockTransfer,
  type NewStockTransferItem,
  type Inventory,
} from "../../db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";

// ============================================================================
// TYPES
// ============================================================================

export interface TransferItemInput {
  productId: string;
  quantity: number;
}

export interface CreateTransferInput {
  transferDate?: string;
  notes?: string;
  items: TransferItemInput[];
  performedBy?: string;
}

export interface TransferWithDetails extends StockTransferType {
  items: (StockTransferItem & {
    product: {
      id: string;
      name: string;
      sku: string;
    };
  })[];
  performedByUser?: {
    id: string;
    username: string;
    name: string;
  } | null;
}

export interface TransferStats {
  totalProducts: number;
  totalWarehouseStock: number;
  totalDisplayStock: number;
  lowStockProducts: number; // Products with display_stock < 10
  outOfStockProducts: number; // Products with display_stock = 0
}

// ============================================================================
// ERRORS
// ============================================================================

export class TransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferError";
  }
}

export class InsufficientStockError extends TransferError {
  constructor(productId: string, requested: number, available: number) {
    super(`Stok gudang tidak cukup untuk product ${productId}. Diminta: ${requested}, Tersedia: ${available}`);
    this.name = "InsufficientStockError";
  }
}

export class InvalidProductError extends TransferError {
  constructor(productId: string, reason: string) {
    super(`Product ${productId} tidak valid: ${reason}`);
    this.name = "InvalidProductError";
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
 * Generate transfer number dengan format: TRF-YYYYMMDD-XXX
 */
function generateTransferNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]!.replace(/-/g, ""); // YYYYMMDD
  const randomNum = Math.floor(Math.random() * 900) + 100; // 100-999

  return `TRF-${dateStr}-${randomNum}`;
}

/**
 * Get current timestamp in ISO format
 */
function now(): string {
  return new Date().toISOString();
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Validate transfer items before creation
 * - Check products exist and are active
 * - Check warehouse stock is sufficient
 */
export async function validateTransferItems(
  db: ReturnType<typeof createDb>,
  items: TransferItemInput[]
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

    // Check warehouse stock
    const inv = await db.query.inventory.findFirst({
      where: eq(inventory.productId, item.productId),
    });

    const availableStock = inv?.warehouseStock ?? 0;

    if (availableStock < item.quantity) {
      throw new InsufficientStockError(item.productId, item.quantity, availableStock);
    }
  }
}

/**
 * Create stock transfer
 * - Creates transfer record
 * - Creates transfer items
 * - Updates inventory (warehouse - quantity, display + quantity)
 */
export async function createTransfer(
  db: ReturnType<typeof createDb>,
  input: CreateTransferInput
): Promise<TransferWithDetails> {
  const { transferDate, notes, items, performedBy } = input;

  // Validate items first
  await validateTransferItems(db, items);

  const transferId = generateId("trf");
  const transferNumber = generateTransferNumber();
  const timestamp = now();
  const transferDateValue = transferDate || timestamp.split("T")[0]!;

  // Create transfer using transaction for data consistency
  await db.transaction(async (tx) => {
    // 1. Insert transfer record
    const transferInsert: NewStockTransfer = {
      id: transferId,
      transferNumber,
      transferDate: transferDateValue,
      notes: notes || null,
      performedBy: performedBy !== undefined ? performedBy : null,
      createdAt: timestamp,
    };
    await tx.insert(stockTransfers).values(transferInsert);

    // 2. Insert transfer items and update inventory
    for (const item of items) {
      // Insert transfer item
      await tx.insert(stockTransferItems).values({
        id: generateId("trfi"),
        transferId,
        productId: item.productId,
        quantity: item.quantity,
        createdAt: timestamp,
      } satisfies NewStockTransferItem);

      // Update inventory: warehouse -= quantity, display += quantity
      const inv = await tx.query.inventory.findFirst({
        where: eq(inventory.productId, item.productId),
      });

      if (inv) {
        await tx
          .update(inventory)
          .set({
            warehouseStock: inv.warehouseStock - item.quantity,
            displayStock: inv.displayStock + item.quantity,
            lastStockUpdate: timestamp,
            updatedAt: timestamp,
          })
          .where(eq(inventory.productId, item.productId));
      } else {
        // This shouldn't happen as we validated stock exists
        throw new InvalidProductError(
          item.productId,
          "Inventory record tidak ditemukan"
        );
      }
    }
  });

  // Fetch and return created transfer with details
  return getTransferById(transferId);
}

/**
 * Get transfer by ID with full details
 */
export async function getTransferById(
  db: ReturnType<typeof createDb>,
  id: string
): Promise<TransferWithDetails> {
  const transfer = await db.query.stockTransfers.findFirst({
    where: eq(stockTransfers.id, id),
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
      performedBy: {
        columns: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
  });

  if (!transfer) {
    throw new TransferError(`Transfer ${id} tidak ditemukan`);
  }

  return transfer as TransferWithDetails;
}

/**
 * Get all transfers with pagination and filters
 */
export interface GetTransfersFilters {
  startDate?: string;
  endDate?: string;
  performedBy?: string;
  page?: number;
  limit?: number;
}

export interface GetTransfersResult {
  transfers: TransferWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export async function getTransfers(
  filters: GetTransfersFilters = {}
): Promise<GetTransfersResult> {
  const {
    startDate,
    endDate,
    performedBy,
    page = 1,
    limit = 20,
  } = filters;

  // Build where conditions
  const conditions = [];

  if (startDate) {
    conditions.push(gte(stockTransfers.transferDate, startDate));
  }

  if (endDate) {
    conditions.push(lte(stockTransfers.transferDate, endDate));
  }

  if (performedBy) {
    conditions.push(eq(stockTransfers.performedBy, performedBy));
  }

  // Fetch all transfers first (for pagination)
  const allTransfers = await db.query.stockTransfers.findMany({
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
      performedBy: {
        columns: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
    orderBy: [desc(stockTransfers.transferDate)],
  });

  // Pagination
  const total = allTransfers.length;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedTransfers = allTransfers.slice(startIndex, endIndex);

  return {
    transfers: paginatedTransfers as TransferWithDetails[],
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
 * Get transfer items by transfer ID
 */
export async function getTransferItems(
  transferId: string
): Promise<(StockTransferItem & { product: { id: string; name: string; sku: string } })[]> {
  // Check transfer exists
  const transfer = await db.query.stockTransfers.findFirst({
    where: eq(stockTransfers.id, transferId),
  });

  if (!transfer) {
    throw new TransferError(`Transfer ${transferId} tidak ditemukan`);
  }

  // Fetch items with product details
  const items = await db.query.stockTransferItems.findMany({
    where: eq(stockTransferItems.transferId, transferId),
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

  return items as (StockTransferItem & {
    product: { id: string; name: string; sku: string };
  })[];
}

/**
 * Get stock statistics (gudang vs etalase)
 */
export async function getStockStats(): Promise<TransferStats> {
  const allInventory = await db.query.inventory.findMany({
    with: {
      product: {
        columns: {
          id: true,
          isActive: true,
        },
      },
    },
  });

  const activeInventory = allInventory.filter(
    (inv) => inv.product.isActive
  );

  const totalProducts = activeInventory.length;
  const totalWarehouseStock = activeInventory.reduce(
    (sum, inv) => sum + inv.warehouseStock,
    0
  );
  const totalDisplayStock = activeInventory.reduce(
    (sum, inv) => sum + inv.displayStock,
    0
  );
  const lowStockProducts = activeInventory.filter(
    (inv) => inv.displayStock > 0 && inv.displayStock < 10
  ).length;
  const outOfStockProducts = activeInventory.filter(
    (inv) => inv.displayStock === 0
  ).length;

  return {
    totalProducts,
    totalWarehouseStock,
    totalDisplayStock,
    lowStockProducts,
    outOfStockProducts,
  };
}

/**
 * Get products that need restocking (low display stock, high warehouse stock)
 */
export interface RestockSuggestion {
  productId: string;
  productName: string;
  sku: string;
  warehouseStock: number;
  displayStock: number;
  suggestedQuantity: number;
}

export async function getRestockSuggestions(
  minWarehouseStock: number = 10
): Promise<RestockSuggestion[]> {
  const allInventory = await db.query.inventory.findMany({
    with: {
      product: {
        columns: {
          id: true,
          name: true,
          sku: true,
          isActive: true,
        },
      },
    },
  });

  const suggestions: RestockSuggestion[] = [];

  for (const inv of allInventory) {
    // Skip inactive products
    if (!inv.product.isActive) continue;

    // Skip if warehouse stock is low
    if (inv.warehouseStock < minWarehouseStock) continue;

    // Suggest restock if display stock is low (< 10) and warehouse has stock
    if (inv.displayStock < 10 && inv.warehouseStock > 0) {
      const suggestedQuantity = Math.min(
        20 - inv.displayStock, // Target 20 items at display
        inv.warehouseStock // Can't transfer more than available
      );

      if (suggestedQuantity > 0) {
        suggestions.push({
          productId: inv.product.id,
          productName: inv.product.name,
          sku: inv.product.sku,
          warehouseStock: inv.warehouseStock,
          displayStock: inv.displayStock,
          suggestedQuantity,
        });
      }
    }
  }

  return suggestions;
}
