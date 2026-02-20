import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";
import { HTTPException } from "hono/http-exception";
import { config } from "../config";

const JWT_SECRET = config.jwt.secret;

export interface JWTPayload {
  userId: string;
  username: string;
  role: "admin" | "cashier" | "guest";
  iat: number;
  exp: number;
}

export interface UserContext {
  user: JWTPayload;
}

/**
 * Middleware untuk verify JWT token
 * Menambahkan user info ke context jika token valid
 */
export async function authMiddleware(c: Context<{ Variables: UserContext }>, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HTTPException(401, {
      message: "Token tidak ditemukan",
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    c.set("user", decoded);
    await next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new HTTPException(401, {
        message: "Token sudah expired",
      });
    }

    throw new HTTPException(401, {
      message: "Token tidak valid",
    });
  }
}

/**
 * Middleware untuk role-based access control
 * @param allowedRoles - Array role yang diizinkan
 * 
 * Usage:
 * app.post("/api/produk", authMiddleware, requireRole(["admin"]), createProductHandler);
 */
export function requireRole(...allowedRoles: Array<"admin" | "cashier" | "guest">) {
  return async (c: Context<{ Variables: UserContext }>, next: Next) => {
    const user = c.get("user");

    if (!user) {
      throw new HTTPException(401, {
        message: "Unauthorized",
      });
    }

    if (!allowedRoles.includes(user.role)) {
      throw new HTTPException(403, {
        message: `Akses ditolak. Diperlukan role: ${allowedRoles.join(" atau ")}`,
      });
    }

    await next();
  };
}

/**
 * Optional auth middleware - tidak error jika tidak ada token
 * Berguna untuk endpoint yang bisa diakses public tapi ada fitur tambahan untuk logged-in user
 */
export async function optionalAuthMiddleware(
  c: Context<{ Variables: UserContext }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    await next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    c.set("user", decoded);
  } catch (error) {
    // Ignore error, lanjutkan tanpa user context
  }

  await next();
}
