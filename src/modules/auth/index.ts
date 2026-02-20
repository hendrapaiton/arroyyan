import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createDb, type Bindings, type Variables } from "../../db";
import { users, sessions, type UserRole } from "../../db/schema";
import { config } from "../../config";

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

function generateJWT(userId: string, username: string, role: UserRole): string {
  return jwt.sign(
    {
      userId,
      username,
      role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
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
 * Login dan generate JWT token
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

    // Generate JWT
    const token = generateJWT(user.id, user.username, user.role as UserRole);

    // Decode token untuk dapat expiry
    const decoded = jwt.decode(token) as { exp?: number };
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000).toISOString()
      : new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Simpan session ke database
    const sessionId = generateSessionId();
    const now = new Date().toISOString();

    await createDb(c.env.DB).insert(sessions).values({
      id: sessionId,
      userId: user.id,
      token,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: c.req.header("X-Forwarded-For") || c.req.header("CF-Connecting-IP") || "",
      userAgent: c.req.header("User-Agent") || "",
    });

    return c.json({
      success: true,
      message: "Login berhasil",
      data: {
        token,
        expiresAt,
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
 * Logout dan invalidate session
 */
auth.post("/logout", async (c) => {
  try {
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

    // Delete session dari database
    await createDb(c.env.DB).delete(sessions).where(eq(sessions.token, token));

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

export { auth };
