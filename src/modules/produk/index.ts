import { Hono } from "hono";
import { eq, like, or, and } from "drizzle-orm";
import { createDb, type Bindings, type Variables } from "../../db";
import { products, inventory, type NewProduct, type NewInventory } from "../../db/schema";
import { createProductSchema, updateProductSchema, productQuerySchema } from "./schema";
import { authMiddleware, requireRole } from "../../middlewares/auth";
import { handleErrorJson } from "../../lib/errors";

const produk = new Hono();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate ID unik untuk produk
 */
function generateProductId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get current timestamp in ISO format
 */
function now(): string {
  return new Date().toISOString();
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/produk
 * Create produk baru
 * Access: Admin only
 */
produk.post("/", authMiddleware, requireRole("admin"), async (c) => {
  try {
    const body = await c.req.json();
    const validation = createProductSchema.safeParse(body);

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

    const { name, sku, sellingPrice } = validation.data;

    // Cek SKU sudah ada (case-insensitive)
    const existingProduct = await createDb(c.env.DB).query.products.findFirst({
      where: eq(products.sku, sku.toUpperCase()),
    });

    if (existingProduct) {
      return c.json(
        {
          success: false,
          error: "SKU sudah digunakan",
        },
        409
      );
    }

    const productId = generateProductId();
    const timestamp = now();

    // Insert product
    await createDb(c.env.DB).insert(products).values({
      id: productId,
      name,
      sku: sku.toUpperCase(),
      sellingPrice,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies NewProduct);

    // Create inventory record with 0 stock
    await createDb(c.env.DB).insert(inventory).values({
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      productId,
      warehouseStock: 0,
      displayStock: 0,
      lastStockUpdate: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies NewInventory);

    // Fetch created product
    const createdProduct = await createDb(c.env.DB).query.products.findFirst({
      where: eq(products.id, productId),
      with: {
        inventory: true,
      },
    });

    // Format response - inventory is an array, get first element
    const formattedProduct = createdProduct ? {
      ...createdProduct,
      inventory: Array.isArray(createdProduct.inventory) 
        ? createdProduct.inventory[0] 
        : createdProduct.inventory,
    } : null;

    return c.json(
      {
        success: true,
        message: "Produk berhasil dibuat",
        data: formattedProduct,
      },
      201
    );
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * GET /api/produk
 * List semua produk dengan filter & pagination
 * Access: All authenticated users
 */
produk.get("/", authMiddleware, async (c) => {
  try {
    // Parse query parameters
    const queryValidation = productQuerySchema.safeParse(c.req.query());

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
      conditions.push(or(like(products.name, searchPattern), like(products.sku, searchPattern)));
    }

    if (isActive !== undefined) {
      conditions.push(eq(products.isActive, isActive));
    }

    // Fetch products with inventory
    const allProducts = await createDb(c.env.DB).query.products.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        inventory: true,
      },
      orderBy: (products, { desc }) => [desc(products.createdAt)],
    });

    // Pagination
    const total = allProducts.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = allProducts.slice(startIndex, endIndex);

    // Format response - inventory is an array, get first element for each product
    const formattedProducts = paginatedProducts.map(product => ({
      ...product,
      inventory: Array.isArray(product.inventory) 
        ? product.inventory[0] 
        : product.inventory,
    }));

    return c.json({
      success: true,
      data: {
        products: formattedProducts,
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
 * GET /api/produk/:id
 * Get detail produk by ID
 * Access: All authenticated users
 */
produk.get("/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");

    const product = await createDb(c.env.DB).query.products.findFirst({
      where: eq(products.id, id),
      with: {
        inventory: true,
      },
    });

    if (!product) {
      return c.json(
        {
          success: false,
          error: "Produk tidak ditemukan",
        },
        404
      );
    }

    // Format response - inventory is an array, get first element
    const formattedProduct = {
      ...product,
      inventory: Array.isArray(product.inventory) 
        ? product.inventory[0] 
        : product.inventory,
    };

    return c.json({
      success: true,
      data: formattedProduct,
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * GET /api/produk/:id/stok
 * Get stok info produk
 * Access: All authenticated users
 */
produk.get("/:id/stok", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");

    const product = await createDb(c.env.DB).query.products.findFirst({
      where: eq(products.id, id),
      with: {
        inventory: true,
      },
    });

    if (!product) {
      return c.json(
        {
          success: false,
          error: "Produk tidak ditemukan",
        },
        404
      );
    }

    // Get first inventory record (should be only one per product)
    const inv = Array.isArray(product.inventory) 
      ? product.inventory[0] 
      : product.inventory;

    return c.json({
      success: true,
      data: {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        stock: {
          warehouse: inv?.warehouseStock || 0,
          display: inv?.displayStock || 0,
          total: (inv?.warehouseStock || 0) + (inv?.displayStock || 0),
        },
        lastStockUpdate: inv?.lastStockUpdate,
      },
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * PUT /api/produk/:id
 * Update produk (nama & harga saja)
 * Access: Admin only
 */
produk.put("/:id", authMiddleware, requireRole("admin"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const validation = updateProductSchema.safeParse(body);

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

    // Check product exists
    const existingProduct = await createDb(c.env.DB).query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!existingProduct) {
      return c.json(
        {
          success: false,
          error: "Produk tidak ditemukan",
        },
        404
      );
    }

    // Build update object
    const updateData: Partial<typeof products.$inferInsert> = {
      updatedAt: now(),
    };

    if (validation.data.name !== undefined) {
      updateData.name = validation.data.name;
    }

    if (validation.data.sellingPrice !== undefined) {
      updateData.sellingPrice = validation.data.sellingPrice;
    }

    // Update product
    await createDb(c.env.DB).update(products).set(updateData).where(eq(products.id, id));

    // Fetch updated product
    const updatedProduct = await createDb(c.env.DB).query.products.findFirst({
      where: eq(products.id, id),
      with: {
        inventory: true,
      },
    });

    // Format response - inventory is an array, get first element
    const formattedProduct = updatedProduct ? {
      ...updatedProduct,
      inventory: Array.isArray(updatedProduct.inventory) 
        ? updatedProduct.inventory[0] 
        : updatedProduct.inventory,
    } : null;

    return c.json({
      success: true,
      message: "Produk berhasil diupdate",
      data: formattedProduct,
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * DELETE /api/produk/:id
 * Soft delete produk (set is_active = false)
 * Access: Admin only
 */
produk.delete("/:id", authMiddleware, requireRole("admin"), async (c) => {
  try {
    const id = c.req.param("id");

    // Check product exists
    const product = await createDb(c.env.DB).query.products.findFirst({
      where: eq(products.id, id),
      with: {
        inventory: true,
      },
    });

    if (!product) {
      return c.json(
        {
          success: false,
          error: "Produk tidak ditemukan",
        },
        404
      );
    }

    // Get first inventory record (inventory is an array)
    const inv = Array.isArray(product.inventory) 
      ? product.inventory[0] 
      : product.inventory;

    // Check if product has stock
    const totalStock =
      (inv?.warehouseStock || 0) + (inv?.displayStock || 0);

    if (totalStock > 0) {
      return c.json(
        {
          success: false,
          error: "Tidak bisa menghapus produk yang masih memiliki stok",
          details: {
            totalStock,
            warehouseStock: inv?.warehouseStock || 0,
            displayStock: inv?.displayStock || 0,
          },
        },
        400
      );
    }

    // Soft delete
    await createDb(c.env.DB)
      .update(products)
      .set({
        isActive: false,
        updatedAt: now(),
      })
      .where(eq(products.id, id));

    return c.json({
      success: true,
      message: "Produk berhasil dihapus (non-aktif)",
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

/**
 * PATCH /api/produk/:id/activate
 * Activate/deactivate produk
 * Access: Admin only
 */
produk.patch("/:id/activate", authMiddleware, requireRole("admin"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { isActive } = body;

    if (typeof isActive !== "boolean") {
      return c.json(
        {
          success: false,
          error: "isActive harus boolean (true/false)",
        },
        400
      );
    }

    // Check product exists
    const product = await createDb(c.env.DB).query.products.findFirst({
      where: eq(products.id, id),
      with: {
        inventory: true,
      },
    });

    if (!product) {
      return c.json(
        {
          success: false,
          error: "Produk tidak ditemukan",
        },
        404
      );
    }

    // Get first inventory record
    const inv = Array.isArray(product.inventory) 
      ? product.inventory[0] 
      : product.inventory;

    // Validate: cannot activate if has display stock (shouldn't happen, but safety check)
    if (isActive && (inv?.displayStock || 0) > 0) {
      // This is actually ok, just documenting
    }

    // Update
    await db
      .update(products)
      .set({
        isActive,
        updatedAt: now(),
      })
      .where(eq(products.id, id));

    return c.json({
      success: true,
      message: `Produk berhasil di-${isActive ? "aktif" : "non-aktif"}kan`,
    });
  } catch (error) {
    const err = handleErrorJson(error);
    return c.json(err.body, err.status);
  }
});

export { produk };
