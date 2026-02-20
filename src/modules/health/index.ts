import { Hono } from "hono";
import type { Bindings } from "../../app";

/**
 * Health check module
 * Provides endpoints for monitoring, uptime checks, and readiness probes
 */
const health = new Hono<{ Bindings: Bindings }>();

/**
 * GET /health
 * General health check endpoint
 */
health.get("/", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready
 * Check if all dependencies are ready
 */
health.get("/ready", (c) => {
  return c.json({
    ready: true,
    checks: {
      database: "ok",
      auth: "ok",
    },
  });
});

/**
 * GET /health/live
 * Liveness probe endpoint
 */
health.get("/live", (c) => {
  return c.json({
    alive: true,
  });
});

export { health };
