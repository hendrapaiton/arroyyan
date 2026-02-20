/**
 * Module: Dashboard
 * Routes & Handlers untuk dashboard
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getDashboardData, getQuickSummary, getSalesTrend, getTopProducts, getCustomStats } from "./service";
import { dashboardQuerySchema } from "./schema";
import { authMiddleware, requireRole } from "../../middlewares/auth";
import { createDb, type Bindings, type Variables } from "../../db";

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/dashboard
 * Get dashboard data with period filter
 * Access: All authenticated users
 *
 * Query Parameters:
 * - period: daily | weekly | monthly (default: daily)
 *   - daily = Today (from midnight to now)
 *   - weekly = This week (from Monday to now)
 *   - monthly = This month (from 1st to now)
 *
 * Response:
 * - period: Selected period
 * - startDate: Start date of the period (YYYY-MM-DD)
 * - endDate: End date of the period (YYYY-MM-DD)
 * - totalRevenue: Total nominal penjualan dalam periode
 * - lowStockCount: Jumlah item dengan stok menipis
 * - transactions: Daftar transaksi penjualan (max 20)
 */
dashboard.get("/", authMiddleware, async (c) => {
  try {
    // Parse query parameters
    const queryValidation = dashboardQuerySchema.safeParse(c.req.query());

    if (!queryValidation.success) {
      return c.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: queryValidation.error.flatten(),
        },
        400
      );
    }

    const { period } = queryValidation.data;

    // Get dashboard data
    const data = await getDashboardData(createDb(c.env.DB), period);

    return c.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get dashboard error:", error);
    return c.json(
      {
        success: false,
        error: "Terjadi kesalahan server",
      },
      500
    );
  }
});

export { dashboard };

// ============================================================================
// ADDITIONAL ROUTES
// ============================================================================

/**
 * GET /api/dashboard/quick
 * Get quick summary for dashboard widgets
 * Access: All authenticated users
 */
dashboard.get("/quick", authMiddleware, async (c) => {
  try {
    const summary = await getQuickSummary(createDb(c.env.DB));

    return c.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Get quick summary error:", error);
    return c.json(
      {
        success: false,
        error: "Terjadi kesalahan server",
      },
      500
    );
  }
});

/**
 * GET /api/dashboard/trend
 * Get sales trend for charts
 * Access: All authenticated users
 */
dashboard.get("/trend", authMiddleware, async (c) => {
  try {
    const { startDate, endDate } = c.req.query();

    if (!startDate || !endDate) {
      return c.json(
        {
          success: false,
          error: "startDate dan endDate required",
        },
        400
      );
    }

    const trend = await getSalesTrend(createDb(c.env.DB), startDate, endDate);

    return c.json({
      success: true,
      data: trend,
    });
  } catch (error) {
    console.error("Get sales trend error:", error);
    return c.json(
      {
        success: false,
        error: "Terjadi kesalahan server",
      },
      500
    );
  }
});

/**
 * GET /api/dashboard/top-products
 * Get top selling products
 * Access: All authenticated users
 */
dashboard.get("/top-products", authMiddleware, async (c) => {
  try {
    const { limit, startDate, endDate } = c.req.query();

    const products = await getTopProducts(createDb(c.env.DB), parseInt(limit || "10"), startDate, endDate);

    return c.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get top products error:", error);
    return c.json(
      {
        success: false,
        error: "Terjadi kesalahan server",
      },
      500
    );
  }
});

/**
 * GET /api/dashboard/stats
 * Get custom date range statistics
 * Access: Admin only
 */
dashboard.get("/stats", authMiddleware, requireRole("admin"), async (c) => {
  try {
    const { startDate, endDate } = c.req.query();

    if (!startDate || !endDate) {
      return c.json(
        {
          success: false,
          error: "startDate dan endDate required",
        },
        400
      );
    }

    const stats = await getCustomStats(createDb(c.env.DB), startDate, endDate);

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get custom stats error:", error);
    return c.json(
      {
        success: false,
        error: "Terjadi kesalahan server",
      },
      500
    );
  }
});
