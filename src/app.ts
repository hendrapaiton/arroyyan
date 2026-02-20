import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { Auth } from "@/auth";
import type { Database } from "@/db";
import { getConfig } from "./config";

// Import modules
import { health } from "./modules/health";
import { auth } from "./modules/auth";
import { customers } from "./modules/customers";
import { products } from "./modules/products";

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
  const config = getConfig();
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  // Global middleware
  app.use("*", logger());
  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
      origin: config.corsOrigins,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    })
  );

  // Root endpoint - API information
  app.get("/", (c) => {
    return c.json({
      name: "Arroyyan - Petshop Management System",
      url: "www.karnarupa.com",
    });
  });

  // Health check endpoint
  app.route("/health", health);

  // API routes
  app.route("/api/auth", auth);
  app.route("/api/customers", customers);
  app.route("/api/products", products);

  // 404 handler
  app.notFound((c) => {
    return c.json(
      {
        error: "Not Found",
        message: `Route ${c.req.path} not found`,
      },
      404
    );
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
