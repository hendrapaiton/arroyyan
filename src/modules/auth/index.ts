import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createDb, type Bindings, type Variables } from "../../db";
import { users, sessions, refreshTokens, type UserRole } from "../../db/schema";
import { config } from "../../config";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
  decodeRefreshToken,
  getTokenExpiryDate,
} from "../../lib/refresh-token";

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "Username harus alphanumeric"),
  name: z.string().min(4).max(50).trim(),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: z.enum(["admin", "cashier", "guest"]).optional().default("guest"),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// ============================================================================
// HELPERS
// ============================================================================

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Set refresh token as httpOnly cookie
 */
function setRefreshTokenCookie(c: any, token: string, expiresAt: Date) {
  c.header("Set-Cookie", `refreshToken=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=${expiresAt.toUTCString()}`);
}

/**
 * Clear refresh token cookie
 */
function clearRefreshTokenCookie(c: any) {
  c.header("Set-Cookie", "refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/auth/register
 * Register user baru
 */
auth.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: "Validasi gagal",
          details: validation.error.flatten(),
        },
        400
      );
    }

    const { username, name, password, role } = validation.data;

    // Cek username sudah ada
    const existingUser = await createDb(c.env.DB).query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUser) {
      return c.json(
        {
          success: false,
          error: "Username sudah digunakan",
        },
        409
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    // Insert user
    await createDb(c.env.DB).insert(users).values({
      id: userId,
      username,
      name,
      password: hashedPassword,
      role,
      createdAt: now,
      updatedAt: now,
    });

    return c.json(
      {
        success: true,
        message: "User berhasil didaftarkan",
        data: {
          id: userId,
          username,
          name,
          role,
        },
      },
      201
    );
  } catch (error) {
    console.error("Register error:", error);
    return c.json(
      {
        success: false,
        error: "Terjadi kesalahan server",
      },
      500
    );
  }
});

/**
 * POST /api/auth/login
 * Login dan generate JWT token + refresh token (httpOnly cookie)
 */
auth.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: "Validasi gagal",
          details: validation.error.flatten(),
        },
        400
      );
    }

    const { username, password } = validation.data;

    // Find user by username
    const user = await createDb(c.env.DB).query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
      return c.json(
        {
          success: false,
          error: "Username atau password salah",
        },
        401
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return c.json(
        {
          success: false,
          error: "Username atau password salah",
        },
        401
      );
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.username, user.role as UserRole);
    const refreshToken = generateRefreshToken(user.id);

    // Decode tokens untuk dapat expiry
    const accessDecoded = jwt.decode(accessToken) as { exp?: number };
    const refreshDecoded = jwt.decode(refreshToken) as { exp?: number };
    
    const accessExpiresAt = accessDecoded?.exp
      ? new Date(accessDecoded.exp * 1000).toISOString()
      : new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    const refreshExpiresAt = refreshDecoded?.exp
      ? new Date(refreshDecoded.exp * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Hash refresh token untuk storage
    const hashedRefreshToken = await hashRefreshToken(refreshToken);

    // Simpan session ke database
    const sessionId = generateSessionId();
    const now = new Date().toISOString();

    await createDb(c.env.DB).insert(sessions).values({
      id: sessionId,
      userId: user.id,
      token: accessToken,
      expiresAt: accessExpiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: c.req.header("X-Forwarded-For") || c.req.header("CF-Connecting-IP") || "",
      userAgent: c.req.header("User-Agent") || "",
    });

    // Simpan refresh token ke database
    const refreshTokenId = `refresh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    await createDb(c.env.DB).insert(refreshTokens).values({
      id: refreshTokenId,
      userId: user.id,
      token: hashedRefreshToken,
      expiresAt: refreshExpiresAt,
      createdAt: now,
      ipAddress: c.req.header("X-Forwarded-For") || c.req.header("CF-Connecting-IP") || "",
      userAgent: c.req.header("User-Agent") || "",
    });

    // Set refresh token sebagai httpOnly cookie
    const refreshExpiryDate = new Date(refreshExpiresAt);
    setRefreshTokenCookie(c, refreshToken, refreshExpiryDate);

    return c.json({
      success: true,
      message: "Login berhasil",
      data: {
        token: accessToken,
        expiresAt: accessExpiresAt,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json(
      {
        success: false,
        error: "Terjadi kesalahan server",
      },
      500
    );
  }
});

/**
 * POST /api/auth/logout
 * Logout dan invalidate session + refresh token
 */
auth.post("/logout", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");

    // Clear refresh token cookie
    clearRefreshTokenCookie(c);

    // Delete access token session dari database
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      await createDb(c.env.DB).delete(sessions).where(eq(sessions.token, token));
    }

    // Delete all refresh tokens untuk user ini
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
        await createDb(c.env.DB).delete(refreshTokens).where(eq(refreshTokens.userId, decoded.userId));
      } catch (error) {
        // Token tidak valid, skip delete by userId
      }
    }

    return c.json({
      success: true,
      message: "Logout berhasil",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return c.json(
      {
        success: false,
        error: "Terjadi kesalahan server",
      },
      500
    );
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
auth.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        success: false,
        error: "Token tidak ditemukan",
      },
      401
    );
  }

  const token = authHeader.substring(7);

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
      username: string;
      role: UserRole;
    };

    // Get user from database
    const user = await createDb(c.env.DB).query.users.findFirst({
      where: eq(users.id, decoded.userId),
      columns: {
        password: false, // Jangan return password
      },
    });

    if (!user) {
      return c.json(
        {
          success: false,
          error: "User tidak ditemukan",
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return c.json(
        {
          success: false,
          error: "Token sudah expired",
        },
        401
      );
    }

    return c.json(
      {
        success: false,
        error: "Token tidak valid",
      },
      401
    );
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token menggunakan refresh token dari httpOnly cookie
 */
auth.post("/refresh", async (c) => {
  try {
    // Get refresh token dari cookie
    const refreshToken = c.req.header("Cookie")
      ?.split(";")
      .find((cookie) => cookie.trim().startsWith("refreshToken="))
      ?.split("=")[1];

    if (!refreshToken) {
      return c.json(
        {
          success: false,
          error: "Refresh token tidak ditemukan",
        },
        401
      );
    }

    // Verify refresh token
    let decoded: { userId: string; type: "refresh"; exp: number };
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        // Clear expired token cookie
        clearRefreshTokenCookie(c);
        return c.json(
          {
            success: false,
            error: "Refresh token sudah expired",
          },
          401
        );
      }
      return c.json(
        {
          success: false,
          error: "Refresh token tidak valid",
        },
        401
      );
    }

    // Check apakah refresh token ada di database
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    const dbRefreshToken = await createDb(c.env.DB).query.refreshTokens.findFirst({
      where: eq(refreshTokens.userId, decoded.userId),
    });

    if (!dbRefreshToken) {
      clearRefreshTokenCookie(c);
      return c.json(
        {
          success: false,
          error: "Refresh token tidak ditemukan",
        },
        401
      );
    }

    // Verify hash
    const isValidToken = await bcrypt.compare(refreshToken, dbRefreshToken.token);
    if (!isValidToken) {
      clearRefreshTokenCookie(c);
      return c.json(
        {
          success: false,
          error: "Refresh token tidak valid",
        },
        401
      );
    }

    // Check apakah token sudah di-revoke
    if (dbRefreshToken.revokedAt) {
      clearRefreshTokenCookie(c);
      return c.json(
        {
          success: false,
          error: "Refresh token sudah di-revoke",
        },
        401
      );
    }

    // Check apakah token sudah expired di database
    if (new Date(dbRefreshToken.expiresAt) < new Date()) {
      clearRefreshTokenCookie(c);
      return c.json(
        {
          success: false,
          error: "Refresh token sudah expired",
        },
        401
      );
    }

    // Get user info
    const user = await createDb(c.env.DB).query.users.findFirst({
      where: eq(users.id, decoded.userId),
    });

    if (!user) {
      clearRefreshTokenCookie(c);
      return c.json(
        {
          success: false,
          error: "User tidak ditemukan",
        },
        404
      );
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user.id, user.username, user.role as UserRole);
    const newAccessDecoded = jwt.decode(newAccessToken) as { exp?: number };
    const newAccessExpiresAt = newAccessDecoded?.exp
      ? new Date(newAccessDecoded.exp * 1000).toISOString()
      : new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Simpan session baru
    const sessionId = generateSessionId();
    const now = new Date().toISOString();

    await createDb(c.env.DB).insert(sessions).values({
      id: sessionId,
      userId: user.id,
      token: newAccessToken,
      expiresAt: newAccessExpiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: c.req.header("X-Forwarded-For") || c.req.header("CF-Connecting-IP") || "",
      userAgent: c.req.header("User-Agent") || "",
    });

    return c.json({
      success: true,
      message: "Token berhasil di-refresh",
      data: {
        token: newAccessToken,
        expiresAt: newAccessExpiresAt,
      },
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return c.json(
      {
        success: false,
        error: "Terjadi kesalahan server",
      },
      500
    );
  }
});

export { auth };
