/**
 * Module: Etalase (Stock Transfer)
 * Routes & Handlers untuk transfer stok gudang → etalase
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createTransfer,
  getTransferById,
  getTransfers,
  getTransferItems,
  getStockStats,
  getRestockSuggestions,
  TransferError,
  InsufficientStockError,
  InvalidProductError,
} from "./service";
import { createTransferSchema, transferQuerySchema, restockQuerySchema } from "./schema";
import { authMiddleware, requireRole } from "../../middlewares/auth";
import { createDb, type Bindings, type Variables } from "../../db";
import { handleErrorJson } from "../../lib/errors";

const etalase = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// ERROR HANDLING HELPER
// ============================================================================

/**
 * Handle service errors and return proper JSON response
 */
function handleServiceError(error: unknown) {
  if (error instanceof InsufficientStockError) {
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

  if (error instanceof TransferError) {
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
 * POST /api/etalase
 * Create stock transfer (gudang → etalase)
 * Access: Admin, Cashier
 */
etalase.post("/", authMiddleware, requireRole("admin", "cashier"), async (c) => {
  try {
    const body = await c.req.json();
    const validation = createTransferSchema.safeParse(body);

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

    const transfer = await createTransfer(createDb(c.env.DB), {
      ...validation.data,
      performedBy: user?.userId,
    });

    return c.json(
      {
        success: true,
        message: "Transfer stok berhasil dibuat",
        data: transfer,
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
 * GET /api/etalase
 * List all stock transfers with filters
 * Access: Admin, Cashier
 */
etalase.get("/", authMiddleware, async (c) => {
  try {
    // Parse query parameters
    const queryValidation = transferQuerySchema.safeParse(c.req.query());

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

    const { startDate, endDate, performedBy, page, limit } = queryValidation.data;

    const result = await getTransfers(createDb(c.env.DB), {
      startDate,
      endDate,
      performedBy,
      page,
      limit,
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get transfers error:", error);
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
 * GET /api/etalase/stats
 * Get stock statistics (gudang vs etalase)
 * Access: All authenticated users
 */
etalase.get("/stats", authMiddleware, async (c) => {
  try {
    const stats = await getStockStats(createDb(c.env.DB));

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get stock stats error:", error);
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
 * GET /api/etalase/restock-suggestions
 * Get products that need restocking at display
 * Access: Admin, Cashier
 */
etalase.get("/restock-suggestions", authMiddleware, async (c) => {
  try {
    // Parse query parameters
    const queryValidation = restockQuerySchema.safeParse(c.req.query());

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

    const { minWarehouseStock } = queryValidation.data;

    const suggestions = await getRestockSuggestions(createDb(c.env.DB), minWarehouseStock);

    return c.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length,
      },
    });
  } catch (error) {
    console.error("Get restock suggestions error:", error);
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
 * GET /api/etalase/:id
 * Get transfer details by ID
 * Access: Admin, Cashier
 */
etalase.get("/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");

    const transfer = await getTransferById(createDb(c.env.DB), id);

    return c.json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    if (error instanceof TransferError) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        404
      );
    }

    console.error("Get transfer error:", error);
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
 * GET /api/etalase/:id/items
 * Get transfer items by transfer ID
 * Access: Admin, Cashier
 */
etalase.get("/:id/items", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");

    const items = await getTransferItems(createDb(c.env.DB), id);

    return c.json({
      success: true,
      data: {
        transferId: id,
        items,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    if (error instanceof TransferError) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        404
      );
    }

    console.error("Get transfer items error:", error);
    return c.json(
      {
        success: false,
        error: "Terjadi kesalahan server",
      },
      500
    );
  }
});

export { etalase };
