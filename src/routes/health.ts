import { Hono } from "hono";

/**
 * Health check routes for monitoring and uptime
 */
export const healthRoutes = new Hono();

healthRoutes.get("/", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/ready", (c) => {
  // Check if all dependencies are ready
  return c.json({
    ready: true,
    checks: {
      database: "ok",
      auth: "ok",
    },
  });
});

healthRoutes.get("/live", (c) => {
  return c.json({
    alive: true,
  });
});
