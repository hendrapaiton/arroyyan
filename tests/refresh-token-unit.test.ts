import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { db } from "../src/db/local.ts";
import { users, sessions, refreshTokens } from "../src/db/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../src/config.ts";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
} from "../src/lib/refresh-token.ts";

// ============================================================================
// REFRESH TOKEN UTILITIES TESTS
// ============================================================================

describe("Refresh Token Utilities", () => {
  describe("generateAccessToken", () => {
    it("menghasilkan valid JWT access token", () => {
      const token = generateAccessToken("user123", "testuser", "admin");
      
      expect(token).toBeDefined();
      expect(token).toMatch(/^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
    });

    it("access token memiliki payload yang benar", () => {
      const token = generateAccessToken("user123", "testuser", "admin");
      const payload = jwt.decode(token) as any;
      
      expect(payload.userId).toBe("user123");
      expect(payload.username).toBe("testuser");
      expect(payload.role).toBe("admin");
      expect(payload.type).toBeUndefined(); // Access token tidak punya type claim
    });

    it("access token memiliki expiry 15 menit", () => {
      const token = generateAccessToken("user123", "testuser", "admin");
      const payload = jwt.decode(token) as any;
      
      const now = Math.floor(Date.now() / 1000);
      const exp = payload.exp;
      const diff = exp - now;
      
      // Should be approximately 15 minutes (900 seconds)
      expect(diff).toBeGreaterThan(800); // > 13 minutes
      expect(diff).toBeLessThan(1000); // < 16 minutes
    });
  });

  describe("generateRefreshToken", () => {
    it("menghasilkan valid JWT refresh token", () => {
      const token = generateRefreshToken("user123");
      
      expect(token).toBeDefined();
      expect(token).toMatch(/^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
    });

    it("refresh token memiliki payload yang benar", () => {
      const token = generateRefreshToken("user123");
      const payload = jwt.decode(token) as any;
      
      expect(payload.userId).toBe("user123");
      expect(payload.type).toBe("refresh");
      expect(payload.username).toBeUndefined(); // Refresh token tidak punya username
      expect(payload.role).toBeUndefined(); // Refresh token tidak punya role
    });

    it("refresh token memiliki expiry 7 hari", () => {
      const token = generateRefreshToken("user123");
      const payload = jwt.decode(token) as any;
      
      const now = Math.floor(Date.now() / 1000);
      const exp = payload.exp;
      const diff = exp - now;
      
      // Should be approximately 7 days (604800 seconds)
      expect(diff).toBeGreaterThan(600000); // > 6.9 days
      expect(diff).toBeLessThan(610000); // < 7.1 days
    });
  });

  describe("hashRefreshToken", () => {
    it("menghasilkan bcrypt hash dari refresh token", async () => {
      const token = generateRefreshToken("user123");
      const hash = await hashRefreshToken(token);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(token);
      expect(hash).toMatch(/^\$2[aby]\$\d+\$.{53}$/);
    });

    it("hash dapat diverifikasi dengan bcrypt.compare", async () => {
      const token = generateRefreshToken("user123");
      const hash = await hashRefreshToken(token);
      
      const isValid = await bcrypt.compare(token, hash);
      expect(isValid).toBe(true);
    });

    it("hash berbeda untuk token yang sama (random salt)", async () => {
      const token = generateRefreshToken("user123");
      const hash1 = await hashRefreshToken(token);
      const hash2 = await hashRefreshToken(token);
      
      expect(hash1).not.toBe(hash2);
      
      // Tapi keduanya harus valid
      expect(await bcrypt.compare(token, hash1)).toBe(true);
      expect(await bcrypt.compare(token, hash2)).toBe(true);
    });
  });

  describe("verifyRefreshToken", () => {
    it("verifikasi refresh token yang valid", () => {
      const token = generateRefreshToken("user123");
      
      const payload = verifyRefreshToken(token);
      
      expect(payload.userId).toBe("user123");
      expect(payload.type).toBe("refresh");
    });

    it("melempar error untuk token yang tidak valid", () => {
      expect(() => verifyRefreshToken("invalid-token")).toThrow();
    });

    it("melempar error untuk token dengan signature yang tampered", () => {
      const token = generateRefreshToken("user123");
      const parts = token.split(".");
      const tampered = `${parts[0]}.${parts[1]}.tampered-signature`;
      
      expect(() => verifyRefreshToken(tampered)).toThrow();
    });
  });
});

// ============================================================================
// DATABASE INTEGRATION TESTS
// ============================================================================

describe("Refresh Token Database Integration", () => {
  beforeEach(async () => {
    // Cleanup before each test
    await db.delete(refreshTokens).execute();
    await db.delete(sessions).execute();
    await db.delete(users).execute();
  });

  afterEach(async () => {
    // Cleanup after each test
    await db.delete(refreshTokens).execute();
    await db.delete(sessions).execute();
    await db.delete(users).execute();
  });

  it("menyimpan refresh token dengan hash ke database", async () => {
    // Create user
    const hashedPassword = await bcrypt.hash("password123", 10);
    const userId = `user_${Date.now()}`;
    const now = new Date().toISOString();
    
    await db.insert(users).values({
      id: userId,
      username: "testuser",
      name: "Test User",
      password: hashedPassword,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });

    // Generate and hash refresh token
    const refreshToken = generateRefreshToken(userId);
    const hashedToken = await hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Save to database
    await db.insert(refreshTokens).values({
      id: `refresh_${Date.now()}`,
      userId,
      token: hashedToken,
      expiresAt,
      createdAt: now,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    // Verify exists in database
    const dbToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.userId, userId),
    });

    expect(dbToken).toBeDefined();
    expect(dbToken!.token).toBe(hashedToken);
    expect(dbToken!.userId).toBe(userId);
    
    // Verify token can be validated
    const isValid = await bcrypt.compare(refreshToken, dbToken!.token);
    expect(isValid).toBe(true);
  });

  it("dapat menyimpan multiple refresh tokens untuk user yang sama", async () => {
    // Create user
    const hashedPassword = await bcrypt.hash("password123", 10);
    const userId = `user_${Date.now()}`;
    const now = new Date().toISOString();
    
    await db.insert(users).values({
      id: userId,
      username: "testuser",
      name: "Test User",
      password: hashedPassword,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });

    // Save multiple refresh tokens
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    for (let i = 0; i < 3; i++) {
      const refreshToken = generateRefreshToken(userId);
      const hashedToken = await hashRefreshToken(refreshToken);
      
      await db.insert(refreshTokens).values({
        id: `refresh_${Date.now()}_${i}`,
        userId,
        token: hashedToken,
        expiresAt,
        createdAt: now,
        ipAddress: "127.0.0.1",
        userAgent: "Test Agent",
      });
    }

    // Verify all tokens exist
    const dbTokens = await db.query.refreshTokens.findMany({
      where: eq(refreshTokens.userId, userId),
    });

    expect(dbTokens.length).toBe(3);
  });

  it("dapat merevoke refresh token", async () => {
    // Create user
    const hashedPassword = await bcrypt.hash("password123", 10);
    const userId = `user_${Date.now()}`;
    const now = new Date().toISOString();
    
    await db.insert(users).values({
      id: userId,
      username: "testuser",
      name: "Test User",
      password: hashedPassword,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });

    // Save refresh token
    const refreshToken = generateRefreshToken(userId);
    const hashedToken = await hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.insert(refreshTokens).values({
      id: `refresh_${Date.now()}`,
      userId,
      token: hashedToken,
      expiresAt,
      createdAt: now,
    });

    // Revoke token
    const revokedAt = new Date().toISOString();
    await db.update(refreshTokens)
      .set({ revokedAt })
      .where(eq(refreshTokens.userId, userId));

    // Verify token is revoked
    const dbToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.userId, userId),
    });

    expect(dbToken!.revokedAt).toBeDefined();
    expect(dbToken!.revokedAt).toBe(revokedAt);
  });

  it("dapat menghapus refresh token yang expired", async () => {
    // Create user
    const hashedPassword = await bcrypt.hash("password123", 10);
    const userId = `user_${Date.now()}`;
    const now = new Date().toISOString();
    
    await db.insert(users).values({
      id: userId,
      username: "testuser",
      name: "Test User",
      password: hashedPassword,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });

    // Save refresh token with past expiry
    const refreshToken = generateRefreshToken(userId);
    const hashedToken = await hashRefreshToken(refreshToken);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago

    await db.insert(refreshTokens).values({
      id: `refresh_${Date.now()}`,
      userId,
      token: hashedToken,
      expiresAt: pastDate,
      createdAt: now,
    });

    // Delete expired tokens
    await db.delete(refreshTokens).where(
      eq(refreshTokens.expiresAt, pastDate)
    );

    // Verify token is deleted
    const dbToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.userId, userId),
    });

    expect(dbToken).toBeUndefined();
  });
});

// ============================================================================
// COOKIE SIMULATION TESTS
// ============================================================================

describe("Cookie Security Simulation", () => {
  it("cookie string memiliki format yang benar", () => {
    const refreshToken = "test-refresh-token";
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const cookieString = `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=${expiresAt.toUTCString()}`;
    
    expect(cookieString).toContain("refreshToken=");
    expect(cookieString).toContain("HttpOnly");
    expect(cookieString).toContain("Secure");
    expect(cookieString).toContain("SameSite=Strict");
    expect(cookieString).toContain("Path=/");
    expect(cookieString).toContain("Expires=");
  });

  it("cookie dapat di-parse dari Set-Cookie header", () => {
    const cookieString = "refreshToken=abc123; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=Fri, 28 Feb 2026 00:00:00 GMT";
    
    const match = cookieString.match(/refreshToken=([^;]+)/);
    expect(match).toBeDefined();
    expect(match![1]).toBe("abc123");
  });

  it("clear cookie string memiliki Max-Age=0", () => {
    const clearCookieString = "refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
    
    expect(clearCookieString).toContain("Max-Age=0");
    expect(clearCookieString).toContain("refreshToken=");
  });
});

// ============================================================================
// JWT PAYLOAD TESTS
// ============================================================================

describe("JWT Payload Structure", () => {
  it("access token dan refresh token memiliki struktur payload berbeda", () => {
    const accessToken = generateAccessToken("user123", "testuser", "admin");
    const refreshToken = generateRefreshToken("user123");
    
    const accessPayload = jwt.decode(accessToken) as any;
    const refreshPayload = jwt.decode(refreshToken) as any;
    
    // Access token fields
    expect(accessPayload.userId).toBe("user123");
    expect(accessPayload.username).toBe("testuser");
    expect(accessPayload.role).toBe("admin");
    expect(accessPayload.iat).toBeDefined();
    expect(accessPayload.exp).toBeDefined();
    
    // Refresh token fields
    expect(refreshPayload.userId).toBe("user123");
    expect(refreshPayload.type).toBe("refresh");
    expect(refreshPayload.username).toBeUndefined();
    expect(refreshPayload.role).toBeUndefined();
    expect(refreshPayload.iat).toBeDefined();
    expect(refreshPayload.exp).toBeDefined();
  });

  it("access token tidak memiliki type claim", () => {
    const accessToken = generateAccessToken("user123", "testuser", "admin");
    const payload = jwt.decode(accessToken) as any;
    
    expect(payload.type).toBeUndefined();
  });

  it("refresh token wajib memiliki type claim 'refresh'", () => {
    const refreshToken = generateRefreshToken("user123");
    const payload = jwt.decode(refreshToken) as any;
    
    expect(payload.type).toBe("refresh");
  });
});

// ============================================================================
// TOKEN EXPIRY TESTS
// ============================================================================

describe("Token Expiry", () => {
  it("access token expiry lebih pendek dari refresh token", () => {
    const accessToken = generateAccessToken("user123", "testuser", "admin");
    const refreshToken = generateRefreshToken("user123");
    
    const accessPayload = jwt.decode(accessToken) as any;
    const refreshPayload = jwt.decode(refreshToken) as any;
    
    expect(accessPayload.exp).toBeLessThan(refreshPayload.exp);
  });

  it("access token dapat di-verify sebelum expired", () => {
    const token = generateAccessToken("user123", "testuser", "admin");
    
    try {
      const verified = jwt.verify(token, config.jwt.secret);
      expect(verified).toBeDefined();
    } catch (error) {
      expect(error).toBeUndefined();
    }
  });

  it("refresh token dapat di-verify sebelum expired", () => {
    const token = generateRefreshToken("user123");
    
    try {
      const verified = jwt.verify(token, config.jwt.secret);
      expect(verified).toBeDefined();
    } catch (error) {
      expect(error).toBeUndefined();
    }
  });
});
