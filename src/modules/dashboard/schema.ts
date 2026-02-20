import { z } from "zod";

/**
 * Schema for dashboard query parameters
 */
export const dashboardQuerySchema = z.object({
  period: z.enum(["daily", "weekly", "monthly"]).optional().default("daily"),
});

/**
 * Type inference
 */
export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
