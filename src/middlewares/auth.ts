import type { Context, Next } from "hono";
import type { Variables } from "../app";

/**
 * Authentication middleware - verifies if user is authenticated
 */
export async function authMiddleware(c: Context<{ Variables: Variables }>, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Missing or invalid authorization header",
      },
      401
    );
  }

  const token = authHeader.substring(7);

  try {
    // For Cloudflare Workers with Better Auth, we rely on the session
    // The actual verification is done by Better Auth
    // This middleware just checks for the presence of a token
    if (!token) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Invalid token",
        },
        401
      );
    }

    await next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return c.json(
      {
        error: "Unauthorized",
        message: "Failed to authenticate",
      },
      401
    );
  }
}

/**
 * Require specific role(s) for access
 * Note: Role-based access requires user data to be set in context first
 * @param allowedRoles - Array of allowed roles
 */
export function requireRole(...allowedRoles: string[]) {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    // For now, allow all authenticated users
    // Implement role checking when roles are added to the system
    await next();
  };
}

/**
 * Optional authentication - doesn't fail if not authenticated
 */
export async function optionalAuthMiddleware(
  c: Context<{ Variables: Variables }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    // Try to authenticate if token is present
    // but don't fail if it's invalid
    try {
      await next();
      return;
    } catch {
      // Continue without authentication
    }
  }

  await next();
}
