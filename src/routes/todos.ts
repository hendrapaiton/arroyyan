import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { todo, type NewTodo, session } from "@/db/schema";
import type { Bindings, Variables } from "../app";
import type { Context } from "hono";
import { createDb } from "@/db";
import { createTodoSchema, updateTodoSchema } from "@/lib/schemas";
import { validate, apiResponse, errorResponse } from "@/lib/utils";
import { nanoid } from "@/lib/nanoid";

/**
 * Todo routes with authentication middleware
 */
export const todoRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware to protect routes (check for auth header/session)
const authMiddleware = async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: () => Promise<void>) => {
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

// Apply auth middleware to all todo routes
todoRoutes.use("*", authMiddleware);

// Get all todos for current user
todoRoutes.get("/", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const userId = c.get("userId") as string;

    const todos = await db
      .select()
      .from(todo)
      .where(eq(todo.userId, userId))
      .orderBy(todo.createdAt);

    return c.json(apiResponse(todos));
  } catch (error) {
    console.error("Get todos error:", error);
    return c.json(errorResponse("Failed to fetch todos"), 500);
  }
});

// Get single todo
todoRoutes.get("/:id", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const userId = c.get("userId") as string;
    const id = c.req.param("id");

    const todos = await db
      .select()
      .from(todo)
      .where(eq(todo.id, id) && eq(todo.userId, userId))
      .limit(1);

    const todoItem = todos[0];

    if (!todoItem) {
      return c.json(errorResponse("Todo not found"), 404);
    }

    return c.json(apiResponse(todoItem));
  } catch (error) {
    console.error("Get todo error:", error);
    return c.json(errorResponse("Failed to fetch todo"), 500);
  }
});

// Create todo
todoRoutes.post("/", validate(createTodoSchema), async (c) => {
  try {
    const db = createDb(c.env.DB);
    const userId = c.get("userId") as string;
    const { title, description } = c.req.valid("json");

    const newTodo: NewTodo = {
      id: nanoid(),
      userId: userId,
      title,
      description: description || null,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.insert(todo).values(newTodo).returning();

    return c.json(apiResponse(result[0], "Todo created successfully"), 201);
  } catch (error) {
    console.error("Create todo error:", error);
    return c.json(errorResponse("Failed to create todo"), 500);
  }
});

// Update todo
todoRoutes.patch("/:id", validate(updateTodoSchema), async (c) => {
  try {
    const db = createDb(c.env.DB);
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const updates = c.req.valid("json");

    // Check if todo exists and belongs to user
    const existing = await db
      .select()
      .from(todo)
      .where(eq(todo.id, id) && eq(todo.userId, userId))
      .limit(1);

    if (!existing[0]) {
      return c.json(errorResponse("Todo not found"), 404);
    }

    const result = await db
      .update(todo)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(todo.id, id))
      .returning();

    return c.json(apiResponse(result[0], "Todo updated successfully"));
  } catch (error) {
    console.error("Update todo error:", error);
    return c.json(errorResponse("Failed to update todo"), 500);
  }
});

// Delete todo
todoRoutes.delete("/:id", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const userId = c.get("userId") as string;
    const id = c.req.param("id");

    // Check if todo exists and belongs to user
    const existing = await db
      .select()
      .from(todo)
      .where(eq(todo.id, id) && eq(todo.userId, userId))
      .limit(1);

    if (!existing[0]) {
      return c.json(errorResponse("Todo not found"), 404);
    }

    await db.delete(todo).where(eq(todo.id, id));

    return c.json(apiResponse(null, "Todo deleted successfully"));
  } catch (error) {
    console.error("Delete todo error:", error);
    return c.json(errorResponse("Failed to delete todo"), 500);
  }
});
