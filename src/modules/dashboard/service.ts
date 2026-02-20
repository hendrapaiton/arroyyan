/**
 * Module: Dashboard
 * Business logic untuk dashboard
 */

import { db } from "../../db";
import { sales, products, inventory, users } from "../../db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardData {
  period: "daily" | "weekly" | "monthly";
  startDate: string;
  endDate: string;
  totalRevenue: number;
  lowStockCount: number;
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  saleNumber: string;
  saleDate: string;
  totalAmount: number;
  paymentMethod: "cash" | "qris";
  cashierName: string;
  itemCount: number;
  createdAt: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get date range based on period
 */
function getDateRange(period: "daily" | "weekly" | "monthly"): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const today = now.toISOString().split("T")[0]!; // YYYY-MM-DD
  const endDate = today;

  let startDate = today;

  if (period === "weekly") {
    // Start of this week (Monday)
    const dayOfWeek = now.getDay() || 7; // Convert Sunday to 7
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    startDate = monday.toISOString().split("T")[0]!;
  } else if (period === "monthly") {
    // Start of this month
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate = firstDay.toISOString().split("T")[0]!;
  }

  return { startDate, endDate };
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Get dashboard data
 * Returns: totalRevenue, lowStockCount, transactions
 */
export async function getDashboardData(
  period: "daily" | "weekly" | "monthly" = "daily"
): Promise<DashboardData> {
  // Get date range based on period
  const dateRange = getDateRange(period);

  // Get total revenue for the period
  const totalRevenue = await getTotalRevenue(dateRange.startDate, dateRange.endDate);

  // Get low stock count
  const lowStockCount = await getLowStockCount();

  // Get transactions within the period
  const transactions = await getTransactions(dateRange.startDate, dateRange.endDate, 20);

  return {
    period,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    totalRevenue,
    lowStockCount,
    transactions,
  };
}

/**
 * Get total revenue for a date range
 */
export async function getTotalRevenue(
  startDate: string,
  endDate: string
): Promise<number> {
  const allSales = await db.query.sales.findMany({
    where: and(
      gte(sales.saleDate, startDate),
      lte(sales.saleDate, endDate)
    ),
    columns: {
      totalAmount: true,
    },
  });

  return allSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
}

/**
 * Get count of products with low stock (threshold: 10)
 */
export async function getLowStockCount(threshold: number = 10): Promise<number> {
  const allInventory = await db.query.inventory.findMany({
    with: {
      product: {
        columns: {
          isActive: true,
        },
      },
    },
  });

  let count = 0;

  for (const inv of allInventory) {
    // Skip inactive products
    if (!inv.product.isActive) continue;

    const totalStock = inv.warehouseStock + inv.displayStock;
    if (totalStock < threshold) {
      count++;
    }
  }

  return count;
}

/**
 * Get transactions within a date range
 */
export async function getTransactions(
  startDate: string,
  endDate: string,
  limit: number = 20
): Promise<Transaction[]> {
  const allSales = await db.query.sales.findMany({
    where: and(
      gte(sales.saleDate, startDate),
      lte(sales.saleDate, endDate)
    ),
    with: {
      items: true,
      cashier: {
        columns: {
          name: true,
        },
      },
    },
    orderBy: [desc(sales.createdAt)],
    limit: limit * 2,
  });

  return allSales.slice(0, limit).map((sale) => ({
    id: sale.id,
    saleNumber: sale.saleNumber,
    saleDate: sale.saleDate,
    totalAmount: sale.totalAmount,
    paymentMethod: sale.paymentMethod as "cash" | "qris",
    cashierName: sale.cashier?.name || "Unknown",
    itemCount: sale.items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: sale.createdAt,
  }));
}

// ============================================================================
// ADDITIONAL DASHBOARD FUNCTIONS
// ============================================================================

/**
 * Get quick summary for dashboard widgets
 * Access: All authenticated users
 */
export interface QuickSummary {
  date: string;
  totalRevenue: number;
  totalTransactions: number;
  lowStockCount: number;
}

export async function getQuickSummary(): Promise<QuickSummary> {
  const today = new Date().toISOString().split("T")[0]!;

  const todaySales = await db.query.sales.findMany({
    where: eq(sales.saleDate, today),
    columns: { totalAmount: true },
  });

  const totalRevenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTransactions = todaySales.length;
  const lowStockCount = await getLowStockCount();

  return {
    date: today,
    totalRevenue,
    totalTransactions,
    lowStockCount,
  };
}

/**
 * Get sales trend for charts
 * Access: All authenticated users
 */
export interface TrendData {
  date: string;
  revenue: number;
  transactions: number;
}

export async function getSalesTrend(
  startDate: string,
  endDate: string
): Promise<TrendData[]> {
  const allSales = await db.query.sales.findMany({
    where: and(
      gte(sales.saleDate, startDate),
      lte(sales.saleDate, endDate)
    ),
    columns: { saleDate: true, totalAmount: true },
    orderBy: [desc(sales.saleDate)],
  });

  // Group by date
  const trendMap = new Map<string, { revenue: number; transactions: number }>();

  for (const sale of allSales) {
    const existing = trendMap.get(sale.saleDate) || { revenue: 0, transactions: 0 };
    trendMap.set(sale.saleDate, {
      revenue: existing.revenue + sale.totalAmount,
      transactions: existing.transactions + 1,
    });
  }

  return Array.from(trendMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get top selling products
 * Access: All authenticated users
 */
export interface TopProduct {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: number;
  revenue: number;
}

export async function getTopProducts(
  limit: number = 10,
  startDate?: string,
  endDate?: string
): Promise<TopProduct[]> {
  const conditions = [];
  if (startDate) conditions.push(gte(sales.saleDate, startDate));
  if (endDate) conditions.push(lte(sales.saleDate, endDate));

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
    },
  });

  // Aggregate by product
  const productStats = new Map<
    string,
    { productId: string; productName: string; sku: string; quantitySold: number; revenue: number }
  >();

  for (const sale of allSales) {
    for (const item of sale.items) {
      const existing = productStats.get(item.productId) || {
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        quantitySold: 0,
        revenue: 0,
      };

      productStats.set(item.productId, {
        ...existing,
        quantitySold: existing.quantitySold + item.quantity,
        revenue: existing.revenue + item.subtotal,
      });
    }
  }

  return Array.from(productStats.values())
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, limit);
}

/**
 * Get custom date range statistics
 * Access: Admin only
 */
export interface CustomStats {
  period: {
    startDate: string;
    endDate: string;
  };
  totalRevenue: number;
  totalTransactions: number;
  averageTransactionValue: number;
  topProducts: TopProduct[];
  trend: TrendData[];
}

export async function getCustomStats(
  startDate: string,
  endDate: string
): Promise<CustomStats> {
  const totalRevenue = await getTotalRevenue(startDate, endDate);
  const allSales = await db.query.sales.findMany({
    where: and(
      gte(sales.saleDate, startDate),
      lte(sales.saleDate, endDate)
    ),
    columns: { totalAmount: true },
  });
  const totalTransactions = allSales.length;
  const topProducts = await getTopProducts(10, startDate, endDate);
  const trend = await getSalesTrend(startDate, endDate);

  return {
    period: { startDate, endDate },
    totalRevenue,
    totalTransactions,
    averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
    topProducts,
    trend,
  };
}
