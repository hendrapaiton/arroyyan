import { Hono } from "hono";
import { eq, and, desc, like, or, gte, lte } from "drizzle-orm";
import { db } from "../../db";
import {
  suppliers,
  supplyOrders,
  supplyOrderItems,
  inventory,
  products,
  type NewSupplier,
  type NewSupplyOrder,
  type NewSupplyOrderItem,
} from "../../db/schema";
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
  createSupplyOrderSchema,
  supplyOrderQuerySchema,
} from "./schema";
import { authMiddleware, requireRole } from "../../middlewares/auth";
import { handleErrorJson } from "../../lib/errors";

const pasokan = new Hono();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate ID unik
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate order number untuk supply order
 * Format: SUP-YYYYMMDD-XXX
 */
function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]!.replace(/-/g, ""); // YYYYMMDD
  const randomNum = Math.floor(Math.random() * 900) + 100; // 100-999

  return `SUP-${dateStr}-${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}`;
}

/**
 * Get current timestamp in ISO format
 */
function now(): string {
  return new Date().toISOString();
}

// ============================================================================
// SUPPLIERS ROUTES
// ============================================================================

/**
 * POST /api/pasokan/suppliers
 * Create supplier baru
 * Access: Admin only
 */
pasokan.post("/suppliers", authMiddleware, requireRole("admin"), async (c) => {
  try {
    const body = await c.req.json();
    const validation = createSupplierSchema.safeParse(body);

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

    const { name, contactPerson, phone, address } = validation.data;

    const supplierId = generateId("supp");
    const timestamp = now();

    await db.insert(suppliers).values({
      id: supplierId,
      name,
      contactPerson: contactPerson || null,
      phone: phone || null,
      address: address || null,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies NewSupplier);

    // Fetch created supplier
    const createdSupplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, supplierId),
    });

    return c.json(
      {
        success: true,
        message: "Supplier berhasil dibuat",
        data: createdSupplier,
      },
      201
    );
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * GET /api/pasokan/suppliers
 * List semua supplier dengan filter & pagination
 * Access: All authenticated users
 */
pasokan.get("/suppliers", authMiddleware, async (c) => {
  try {
    // Parse query parameters
    const queryValidation = supplierQuerySchema.safeParse(c.req.query());

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

    const { search, isActive, page, limit } = queryValidation.data;

    // Build where conditions
    const conditions = [];

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          like(suppliers.name, searchPattern),
          like(suppliers.contactPerson, searchPattern),
          like(suppliers.phone, searchPattern)
        )
      );
    }

    if (isActive !== undefined) {
      conditions.push(eq(suppliers.isActive, isActive));
    }

    // Fetch suppliers
    const allSuppliers = await db.query.suppliers.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: (suppliers, { desc }) => [desc(suppliers.createdAt)],
    });

    // Pagination
    const total = allSuppliers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSuppliers = allSuppliers.slice(startIndex, endIndex);

    return c.json({
      success: true,
      data: {
        suppliers: paginatedSuppliers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: endIndex < total,
        },
      },
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * GET /api/pasokan/suppliers/:id
 * Get detail supplier by ID
 * Access: All authenticated users
 */
pasokan.get("/suppliers/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");

    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, id),
    });

    if (!supplier) {
      return c.json(
        {
          success: false,
          error: "Supplier tidak ditemukan",
        },
        404
      );
    }

    return c.json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * PUT /api/pasokan/suppliers/:id
 * Update supplier
 * Access: Admin only
 */
pasokan.put("/suppliers/:id", authMiddleware, requireRole("admin"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const validation = updateSupplierSchema.safeParse(body);

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

    // Check supplier exists
    const existingSupplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, id),
    });

    if (!existingSupplier) {
      return c.json(
        {
          success: false,
          error: "Supplier tidak ditemukan",
        },
        404
      );
    }

    // Build update object
    const updateData: Partial<typeof suppliers.$inferInsert> = {
      updatedAt: now(),
    };

    if (validation.data.name !== undefined) {
      updateData.name = validation.data.name;
    }
    if (validation.data.contactPerson !== undefined) {
      updateData.contactPerson = validation.data.contactPerson || null;
    }
    if (validation.data.phone !== undefined) {
      updateData.phone = validation.data.phone || null;
    }
    if (validation.data.address !== undefined) {
      updateData.address = validation.data.address || null;
    }
    if (validation.data.isActive !== undefined) {
      updateData.isActive = validation.data.isActive;
    }

    // Update supplier
    await db.update(suppliers).set(updateData).where(eq(suppliers.id, id));

    // Fetch updated supplier
    const updatedSupplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, id),
    });

    return c.json({
      success: true,
      message: "Supplier berhasil diupdate",
      data: updatedSupplier,
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * DELETE /api/pasokan/suppliers/:id
 * Soft delete supplier
 * Access: Admin only
 */
pasokan.delete("/suppliers/:id", authMiddleware, requireRole("admin"), async (c) => {
  try {
    const id = c.req.param("id");

    // Check supplier exists
    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, id),
    });

    if (!supplier) {
      return c.json(
        {
          success: false,
          error: "Supplier tidak ditemukan",
        },
        404
      );
    }

    // Check if supplier has orders
    const orderCount = await db.query.supplyOrders.findMany({
      where: eq(supplyOrders.supplierId, id),
      columns: { id: true },
    });

    if (orderCount && orderCount.length > 0) {
      return c.json(
        {
          success: false,
          error: "Tidak bisa menghapus supplier yang masih memiliki riwayat pasokan",
          details: {
            orderCount: orderCount.length,
          },
        },
        400
      );
    }

    // Soft delete
    await db
      .update(suppliers)
      .set({
        isActive: false,
        updatedAt: now(),
      })
      .where(eq(suppliers.id, id));

    return c.json({
      success: true,
      message: "Supplier berhasil dihapus (non-aktif)",
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

// ============================================================================
// SUPPLY ORDERS ROUTES
// ============================================================================

/**
 * POST /api/pasokan/orders
 * Create pasokan masuk
 * Access: Admin only
 */
pasokan.post("/orders", authMiddleware, requireRole("admin"), async (c) => {
  try {
    const body = await c.req.json();
    const validation = createSupplyOrderSchema.safeParse(body);

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

    const { supplierId, orderDate, notes, items } = validation.data;

    // Check supplier exists and is active
    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, supplierId),
    });

    if (!supplier) {
      return c.json(
        {
          success: false,
          error: "Supplier tidak ditemukan",
        },
        404
      );
    }

    if (!supplier.isActive) {
      return c.json(
        {
          success: false,
          error: "Supplier tidak aktif",
        },
        400
      );
    }

    // Validate items - check products exist and are active
    for (const item of items) {
      const product = await db.query.products.findFirst({
        where: eq(products.id, item.productId),
      });

      if (!product) {
        return c.json(
          {
            success: false,
            error: `Produk tidak ditemukan: ${item.productId}`,
          },
          400
        );
      }

      if (!product.isActive) {
        return c.json(
          {
            success: false,
            error: `Produk tidak aktif: ${product.name}`,
          },
          400
        );
      }
    }

    const orderId = generateId("supo");
    const orderNumber = generateOrderNumber();
    const timestamp = now();
    const orderDateValue = orderDate || timestamp.split("T")[0]!;

    // Calculate total amount
    const totalAmount = items.reduce(
      (sum, item) => sum + item.quantity * item.purchasePrice,
      0
    );

    // Insert supply order
    const orderInsert: NewSupplyOrder = {
      id: orderId,
      orderNumber,
      supplierId,
      orderDate: orderDateValue,
      totalAmount,
      notes: notes || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.insert(supplyOrders).values(orderInsert);

    // Insert supply order items and update inventory
    for (const item of items) {
      const subtotal = item.quantity * item.purchasePrice;

      // Insert item
      await db.insert(supplyOrderItems).values({
        id: generateId("supi"),
        supplyOrderId: orderId,
        productId: item.productId,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        subtotal,
        createdAt: timestamp,
      } satisfies NewSupplyOrderItem);

      // Update inventory - add to warehouse stock
      const existingInventory = await db.query.inventory.findFirst({
        where: eq(inventory.productId, item.productId),
      });

      if (existingInventory) {
        await db
          .update(inventory)
          .set({
            warehouseStock: existingInventory.warehouseStock + item.quantity,
            lastStockUpdate: timestamp,
            updatedAt: timestamp,
          })
          .where(eq(inventory.productId, item.productId));
      } else {
        // Create new inventory record if not exists
        await db.insert(inventory).values({
          id: generateId("inv"),
          productId: item.productId,
          warehouseStock: item.quantity,
          displayStock: 0,
          lastStockUpdate: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    // Fetch created order with items
    const createdOrder = await db.query.supplyOrders.findFirst({
      where: eq(supplyOrders.id, orderId),
      with: {
        supplier: true,
        items: {
          with: {
            product: true,
          },
        },
      },
    });

    return c.json(
      {
        success: true,
        message: "Pasokan berhasil dibuat",
        data: createdOrder,
      },
      201
    );
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * GET /api/pasokan/orders
 * List semua supply orders dengan filter
 * Access: All authenticated users
 */
pasokan.get("/orders", authMiddleware, async (c) => {
  try {
    // Parse query parameters
    const queryValidation = supplyOrderQuerySchema.safeParse(c.req.query());

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

    const { supplierId, startDate, endDate, page, limit } = queryValidation.data;

    // Build where conditions
    const conditions = [];

    if (supplierId) {
      conditions.push(eq(supplyOrders.supplierId, supplierId));
    }

    if (startDate) {
      conditions.push(gte(supplyOrders.orderDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(supplyOrders.orderDate, endDate));
    }

    // Fetch orders
    const allOrders = await db.query.supplyOrders.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        supplier: true,
        items: {
          with: {
            product: true,
          },
        },
      },
      orderBy: (supplyOrders, { desc }) => [desc(supplyOrders.orderDate)],
    });

    // Pagination
    const total = allOrders.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = allOrders.slice(startIndex, endIndex);

    return c.json({
      success: true,
      data: {
        orders: paginatedOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: endIndex < total,
        },
      },
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * GET /api/pasokan/orders/:id
 * Get detail supply order by ID
 * Access: All authenticated users
 */
pasokan.get("/orders/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");

    const order = await db.query.supplyOrders.findFirst({
      where: eq(supplyOrders.id, id),
      with: {
        supplier: true,
        items: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return c.json(
        {
          success: false,
          error: "Pasokan tidak ditemukan",
        },
        404
      );
    }

    return c.json({
      success: true,
      data: order,
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * GET /api/pasokan/orders/:id/items
 * Get items dari supply order
 * Access: All authenticated users
 */
pasokan.get("/orders/:id/items", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");

    // Check order exists
    const order = await db.query.supplyOrders.findFirst({
      where: eq(supplyOrders.id, id),
    });

    if (!order) {
      return c.json(
        {
          success: false,
          error: "Pasokan tidak ditemukan",
        },
        404
      );
    }

    // Fetch items
    const items = await db.query.supplyOrderItems.findMany({
      where: eq(supplyOrderItems.supplyOrderId, id),
      with: {
        product: true,
      },
    });

    return c.json({
      success: true,
      data: {
        orderId: id,
        orderNumber: order.orderNumber,
        items,
      },
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

export { pasokan };
