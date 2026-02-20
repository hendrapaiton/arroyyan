import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { Auth } from "@/auth";
import type { Database } from "@/db";

// Import routes
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { todoRoutes } from "./routes/todos";

export type Bindings = {
  DB: D1Database;
  ENVIRONMENT: string;
};

export type Variables = {
  auth: Auth;
  db: Database;
  userId?: string;
};

/**
 * Create the main Hono application with all middleware and routes
 */
export function createApp() {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  // Global middleware
  app.use("*", logger());
  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
      origin: ["http://localhost:3000", "https://yourdomain.com"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    })
  );

  // Routes
  app.route("/health", healthRoutes);
  app.route("/auth", authRoutes);
  app.route("/todos", todoRoutes);

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: "Not Found", message: `Route ${c.req.path} not found` }, 404);
  });

  // Error handler
  app.onError((err, c) => {
    console.error("Error:", err);
    return c.json(
      {
        error: "Internal Server Error",
        message: err.message || "An unexpected error occurred",
      },
      500
    );
  });

  return app;
}
