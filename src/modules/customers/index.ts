import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { customer, pet, type NewCustomer, session } from "@/db/schema";
import type { Bindings, Variables } from "../../app";
import type { Context } from "hono";
import { createDb } from "@/db";
import { createCustomerSchema, updateCustomerSchema } from "@/lib/schemas";
import { validate, apiResponse, errorResponse } from "@/lib/utils";
import { nanoid } from "@/lib/nanoid";

/**
 * Customer module
 * Handles CRUD operations for petshop customers
 */
const customers = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * Authentication middleware for customer routes
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

// Apply auth middleware to all customer routes
customers.use("*", authMiddleware);

/**
 * GET /api/customers
 * Get all customers for current user
 */
customers.get("/", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const userId = c.get("userId") as string;

    const customers = await db
      .select()
      .from(customer)
      .where(eq(customer.userId, userId))
      .orderBy(customer.createdAt);

    return c.json(apiResponse(customers));
  } catch (error) {
    console.error("Get customers error:", error);
    return c.json(errorResponse("Failed to fetch customers"), 500);
  }
});

/**
 * GET /api/customers/:id
 * Get single customer by ID with pets
 */
customers.get("/:id", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const userId = c.get("userId") as string;
    const id = c.req.param("id");

    const customers = await db
      .select()
      .from(customer)
      .where(eq(customer.id, id) && eq(customer.userId, userId))
      .limit(1);

    const customerItem = customers[0];

    if (!customerItem) {
      return c.json(errorResponse("Customer not found"), 404);
    }

    // Get customer's pets
    const pets = await db
      .select()
      .from(pet)
      .where(eq(pet.customerId, id));

    return c.json(apiResponse({
      ...customerItem,
      pets,
    }));
  } catch (error) {
    console.error("Get customer error:", error);
    return c.json(errorResponse("Failed to fetch customer"), 500);
  }
});

/**
 * POST /api/customers
 * Create a new customer
 */
customers.post("/", validate(createCustomerSchema), async (c) => {
  try {
    const db = createDb(c.env.DB);
    const userId = c.get("userId") as string;
    const { name, email, phone, address, notes } = c.req.valid("json");

    const newCustomer: NewCustomer = {
      id: nanoid(),
      userId: userId,
      name,
      email,
      phone,
      address: address || null,
      notes: notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.insert(customer).values(newCustomer).returning();

    return c.json(apiResponse(result[0], "Customer created successfully"), 201);
  } catch (error: any) {
    console.error("Create customer error:", error);
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return c.json(errorResponse("Customer with this email already exists"), 400);
    }
    return c.json(errorResponse("Failed to create customer"), 500);
  }
});

/**
 * PATCH /api/customers/:id
 * Update an existing customer
 */
customers.patch("/:id", validate(updateCustomerSchema), async (c) => {
  try {
    const db = createDb(c.env.DB);
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const updates = c.req.valid("json");

    // Check if customer exists and belongs to user
    const existing = await db
      .select()
      .from(customer)
      .where(eq(customer.id, id) && eq(customer.userId, userId))
      .limit(1);

    if (!existing[0]) {
      return c.json(errorResponse("Customer not found"), 404);
    }

    const result = await db
      .update(customer)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(customer.id, id))
      .returning();

    return c.json(apiResponse(result[0], "Customer updated successfully"));
  } catch (error: any) {
    console.error("Update customer error:", error);
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return c.json(errorResponse("Customer with this email already exists"), 400);
    }
    return c.json(errorResponse("Failed to update customer"), 500);
  }
});

/**
 * DELETE /api/customers/:id
 * Delete a customer
 */
customers.delete("/:id", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const userId = c.get("userId") as string;
    const id = c.req.param("id");

    // Check if customer exists and belongs to user
    const existing = await db
      .select()
      .from(customer)
      .where(eq(customer.id, id) && eq(customer.userId, userId))
      .limit(1);

    if (!existing[0]) {
      return c.json(errorResponse("Customer not found"), 404);
    }

    await db.delete(customer).where(eq(customer.id, id));

    return c.json(apiResponse(null, "Customer deleted successfully"));
  } catch (error) {
    console.error("Delete customer error:", error);
    return c.json(errorResponse("Failed to delete customer"), 500);
  }
});

export { customers };
