import { Hono } from "hono";
import { eq, and, lt } from "drizzle-orm";
import { product, type NewProduct, session } from "@/db/schema";
import type { Bindings, Variables } from "../../app";
import type { Context } from "hono";
import { createDb } from "@/db";
import { createProductSchema, updateProductSchema } from "@/lib/schemas";
import { validate, apiResponse, errorResponse } from "@/lib/utils";
import { nanoid } from "@/lib/nanoid";

/**
 * Product module
 * Handles CRUD operations for petshop products inventory
 */
const products = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * Authentication middleware for product routes
 */
const authMiddleware = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: () => Promise<void>
) => {
  const authHeader = c.req.header("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(errorResponse("Unauthorized - Missing or invalid token"), 401);
  }

  try {
    const db = createDb(c.env.DB);
    const token = authHeader.split(" ")[1];

    // Find session by token
    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.token, token!))
      .limit(1);

    const sessionRecord = sessions[0];

    if (!sessionRecord || new Date(sessionRecord.expiresAt!) < new Date()) {
      return c.json(errorResponse("Unauthorized - Invalid or expired token"), 401);
    }

    c.set("userId", sessionRecord.userId!);
    await next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return c.json(errorResponse("Unauthorized"), 401);
  }
};

// Apply auth middleware to all product routes
products.use("*", authMiddleware);

/**
 * GET /api/products
 * Get all products with optional filters
 */
products.get("/", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const userId = c.get("userId") as string;
    const category = c.req.query("category");
    const lowStock = c.req.query("lowStock");

    let products;

    if (category && lowStock === "true") {
      products = await db
        .select()
        .from(product)
        .where(eq(product.category, category) && lt(product.stock, product.minStock))
        .orderBy(product.name);
    } else if (category) {
      products = await db
        .select()
        .from(product)
        .where(eq(product.category, category))
        .orderBy(product.name);
    } else if (lowStock === "true") {
      products = await db
        .select()
        .from(product)
        .where(lt(product.stock, product.minStock))
        .orderBy(product.name);
    } else {
      products = await db
        .select()
        .from(product)
        .orderBy(product.name);
    }

    return c.json(apiResponse(products));
  } catch (error) {
    console.error("Get products error:", error);
    return c.json(errorResponse("Failed to fetch products"), 500);
  }
});

/**
 * GET /api/products/low-stock
 * Get products with low stock
 */
products.get("/low-stock", async (c) => {
  try {
    const db = createDb(c.env.DB);

    const products = await db
      .select()
      .from(product)
      .where(lt(product.stock, product.minStock))
      .orderBy(product.name);

    return c.json(apiResponse(products));
  } catch (error) {
    console.error("Get low stock products error:", error);
    return c.json(errorResponse("Failed to fetch low stock products"), 500);
  }
});

/**
 * GET /api/products/:id
 * Get single product by ID
 */
products.get("/:id", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const id = c.req.param("id");

    const products = await db
      .select()
      .from(product)
      .where(eq(product.id, id))
      .limit(1);

    const productItem = products[0];

    if (!productItem) {
      return c.json(errorResponse("Product not found"), 404);
    }

    return c.json(apiResponse(productItem));
  } catch (error) {
    console.error("Get product error:", error);
    return c.json(errorResponse("Failed to fetch product"), 500);
  }
});

/**
 * POST /api/products
 * Create a new product
 */
products.post("/", validate(createProductSchema), async (c) => {
  try {
    const db = createDb(c.env.DB);
    const { name, description, sku, category, price, cost, stock, minStock, unit } = c.req.valid("json");

    const newProduct: NewProduct = {
      id: nanoid(),
      name,
      description: description || null,
      sku,
      category,
      price,
      cost: cost || null,
      stock: stock || 0,
      minStock: minStock || 5,
      unit: unit || null,
      photoUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.insert(product).values(newProduct).returning();

    return c.json(apiResponse(result[0], "Product created successfully"), 201);
  } catch (error: any) {
    console.error("Create product error:", error);
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return c.json(errorResponse("Product with this SKU already exists"), 400);
    }
    return c.json(errorResponse("Failed to create product"), 500);
  }
});

/**
 * PATCH /api/products/:id
 * Update an existing product
 */
products.patch("/:id", validate(updateProductSchema), async (c) => {
  try {
    const db = createDb(c.env.DB);
    const id = c.req.param("id");
    const updates = c.req.valid("json");

    // Check if product exists
    const existing = await db
      .select()
      .from(product)
      .where(eq(product.id, id))
      .limit(1);

    if (!existing[0]) {
      return c.json(errorResponse("Product not found"), 404);
    }

    const result = await db
      .update(product)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(product.id, id))
      .returning();

    return c.json(apiResponse(result[0], "Product updated successfully"));
  } catch (error: any) {
    console.error("Update product error:", error);
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return c.json(errorResponse("Product with this SKU already exists"), 400);
    }
    return c.json(errorResponse("Failed to update product"), 500);
  }
});

/**
 * DELETE /api/products/:id
 * Delete a product (soft delete by setting isActive to false)
 */
products.delete("/:id", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const id = c.req.param("id");

    // Check if product exists
    const existing = await db
      .select()
      .from(product)
      .where(eq(product.id, id))
      .limit(1);

    if (!existing[0]) {
      return c.json(errorResponse("Product not found"), 404);
    }

    // Soft delete
    await db
      .update(product)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(product.id, id));

    return c.json(apiResponse(null, "Product deleted successfully"));
  } catch (error) {
    console.error("Delete product error:", error);
    return c.json(errorResponse("Failed to delete product"), 500);
  }
});

export { products };
