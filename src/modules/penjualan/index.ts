/**
 * Module: Penjualan (Point of Sale)
 * Routes & Handlers untuk transaksi penjualan
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createSale,
  getSaleById,
  getSales,
  getSaleItems,
  getSalesStats,
  getTodaySummary,
  getSalesByCashier,
  SaleError,
  InsufficientDisplayStockError,
  InvalidProductError,
  PaymentError,
} from "./service";
import { createSaleSchema, salesQuerySchema, cashierQuerySchema } from "./schema";
import { authMiddleware, requireRole } from "../../middlewares/auth";
import { createDb, type Bindings, type Variables } from "../../db";
import { handleErrorJson } from "../../lib/errors";

const penjualan = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// ERROR HANDLING HELPER
// ============================================================================

/**
 * Handle service errors and return proper JSON response
 */
function handleServiceError(error: unknown) {
  if (error instanceof InsufficientDisplayStockError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (error instanceof InvalidProductError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (error instanceof PaymentError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (error instanceof SaleError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Log and return 500 for unknown errors
  if (error instanceof Error) {
    console.error("Service error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: "Unknown error",
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/penjualan
 * Create sale transaction
 * Access: Admin, Cashier
 */
penjualan.post("/", authMiddleware, requireRole("admin", "cashier"), async (c) => {
  try {
    const body = await c.req.json();
    const validation = createSaleSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: "Validasi gagal",
          details: validation.error.flatten(),
        },
        400
      );
    }

    // Get user from context (set by authMiddleware)
    const user = c.get("user");

    const sale = await createSale(createDb(c.env.DB), {
      ...validation.data,
      cashierId: user?.userId,
    });

    return c.json(
      {
        success: true,
        message: "Transaksi penjualan berhasil dibuat",
        data: sale,
      },
      201
    );
  } catch (error) {
    const errorResponse = handleServiceError(error);
    return new Response(errorResponse.body, {
      status: errorResponse.status,
      headers: errorResponse.headers,
    });
  }
});

/**
 * GET /api/penjualan
 * List all sales with filters
 * Access: Admin, Cashier
 */
penjualan.get("/", authMiddleware, async (c) => {
  try {
    // Parse query parameters
    const queryValidation = salesQuerySchema.safeParse(c.req.query());

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

    const { startDate, endDate, cashierId, paymentMethod, page, limit } =
      queryValidation.data;

    const result = await getSales(createDb(c.env.DB), {
      startDate,
      endDate,
      cashierId,
      paymentMethod,
      page,
      limit,
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * GET /api/penjualan/stats
 * Get sales statistics
 * Access: Admin only
 */
penjualan.get("/stats", authMiddleware, requireRole("admin"), async (c) => {
  try {
    const { startDate, endDate } = c.req.query();

    const stats = await getSalesStats(createDb(c.env.DB), startDate, endDate);

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * GET /api/penjualan/today
 * Get today's sales summary
 * Access: Admin, Cashier
 */
penjualan.get("/today", authMiddleware, async (c) => {
  try {
    const summary = await getTodaySummary(createDb(c.env.DB));

    return c.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * GET /api/penjualan/cashier/:id
 * Get sales by cashier
 * Access: Admin only
 */
penjualan.get(
  "/cashier/:id",
  authMiddleware,
  requireRole("admin"),
  async (c) => {
    try {
      const cashierId = c.req.param("id");
      const { startDate, endDate } = c.req.query();

      const result = await getSalesByCashier(createDb(c.env.DB), cashierId, startDate, endDate);

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const err = handleErrorJson(error);
      return c.json(err.body, err.status);
    }
  }
);

/**
 * GET /api/penjualan/:id
 * Get sale details by ID
 * Access: Admin, Cashier
 */
penjualan.get("/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");

    const sale = await getSaleById(createDb(c.env.DB), id);

    return c.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * GET /api/penjualan/:id/items
 * Get sale items by sale ID
 * Access: Admin, Cashier
 */
penjualan.get("/:id/items", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");

    const items = await getSaleItems(createDb(c.env.DB), id);

    return c.json({
      success: true,
      data: {
        saleId: id,
        items,
      },
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

export { penjualan };
