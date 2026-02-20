import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

/**
 * Custom validator for Zod schemas with proper error handling
 */
export function validate<T extends z.ZodType>(schema: T) {
  return zValidator("json", schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: "Validation Error",
          message: result.error.issues.map((issue) => issue.message).join(", "),
          details: result.error.issues,
        },
        400
      );
    }
  });
}

/**
 * Create a standardized API response
 */
export function apiResponse<T>(data: T, message?: string) {
  return {
    success: true,
    message,
    data,
  };
}

/**
 * Create a standardized error response
 */
export function errorResponse(message: string, error = "Bad Request") {
  return {
    error,
    message,
  };
}
