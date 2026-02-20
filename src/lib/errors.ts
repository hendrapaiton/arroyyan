import { Context } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * Professional error handler for API modules
 * Converts errors to proper HTTP responses with correct status codes
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string = "Validation failed") {
    super(400, "VALIDATION_ERROR", message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "Forbidden") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = "Resource conflict") {
    super(409, "CONFLICT", message);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = "Bad request") {
    super(400, "BAD_REQUEST", message);
  }
}

/**
 * Handle API errors and return proper JSON response
 * Usage: return handleError(error) in catch blocks
 */
export function handleError(error: unknown) {
  // Handle HTTPException from Hono middleware
  if (error instanceof HTTPException) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "HTTP_EXCEPTION",
        message: error.message,
      }),
      {
        status: error.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (error instanceof ApiError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.code,
        message: error.message,
      }),
      {
        status: error.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Handle specific module errors
  if (error instanceof Error) {
    // Auth-related errors (check first)
    if (error.message.includes("Token") || error.message.includes("token")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "UNAUTHORIZED",
          message: error.message,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (error.message.includes("Akses ditolak") || error.message.includes("role") || error.message.includes("Forbidden")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "FORBIDDEN",
          message: error.message,
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Stock-related errors
    if (error.message.includes("stock") || error.message.includes("Stock")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INSUFFICIENT_STOCK",
          message: error.message,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Product-related errors
    if (error.message.includes("product") || error.message.includes("Product")) {
      const isNotFound = error.message.includes("tidak ditemukan") || error.message.includes("not found");
      return new Response(
        JSON.stringify({
          success: false,
          error: isNotFound ? "NOT_FOUND" : "BAD_REQUEST",
          message: error.message,
        }),
        {
          status: isNotFound ? 404 : 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Log unknown errors and return 500
    console.error("Unhandled error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Unknown error type
  return new Response(
    JSON.stringify({
      success: false,
      error: "UNKNOWN_ERROR",
      message: "An unexpected error occurred",
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Type-safe error handler for Hono contexts
 * Usage: return handleApiError(c, error) in catch blocks
 */
export function handleApiError(c: Context, error: unknown) {
  const response = handleError(error);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

/**
 * Simplified error handler that returns JSON directly
 * Usage in catch blocks: return handleErrorJson(error)
 */
export function handleErrorJson(error: unknown): { status: number; body: { success: boolean; error: string; message?: string } } {
  // Handle HTTPException from Hono middleware
  if (error instanceof HTTPException) {
    return {
      status: error.status,
      body: {
        success: false,
        error: "HTTP_EXCEPTION",
        message: error.message,
      },
    };
  }

  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        success: false,
        error: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof Error) {
    // Sale-related errors (check for SaleError)
    if (error.name === "SaleError" || error.constructor.name === "SaleError") {
      const isNotFound = error.message.includes("tidak ditemukan") || error.message.includes("not found");
      return {
        status: isNotFound ? 404 : 400,
        body: {
          success: false,
          error: isNotFound ? "NOT_FOUND" : "SALE_ERROR",
          message: error.message,
        },
      };
    }

    // Auth-related errors (check first)
    if (error.message.includes("Token") || error.message.includes("token")) {
      return {
        status: 401,
        body: {
          success: false,
          error: "UNAUTHORIZED",
          message: error.message,
        },
      };
    }

    if (error.message.includes("Akses ditolak") || error.message.includes("role") || error.message.includes("Forbidden")) {
      return {
        status: 403,
        body: {
          success: false,
          error: "FORBIDDEN",
          message: error.message,
        },
      };
    }

    // Stock-related errors
    if (error.message.includes("stock") || error.message.includes("Stock")) {
      return {
        status: 400,
        body: {
          success: false,
          error: "INSUFFICIENT_STOCK",
          message: error.message,
        },
      };
    }

    // Product-related errors
    if (error.message.includes("product") || error.message.includes("Product")) {
      const isNotFound = error.message.includes("tidak ditemukan") || error.message.includes("not found");
      return {
        status: isNotFound ? 404 : 400,
        body: {
          success: false,
          error: isNotFound ? "NOT_FOUND" : "BAD_REQUEST",
          message: error.message,
        },
      };
    }

    // Log and return 500
    console.error("Unhandled error:", error);
    return {
      status: 500,
      body: {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: error.message,
      },
    };
  }

  // Unknown error type
  return {
    status: 500,
    body: {
      success: false,
      error: "UNKNOWN_ERROR",
      message: "An unexpected error occurred",
    },
  };
}
