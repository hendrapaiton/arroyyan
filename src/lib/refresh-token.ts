import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config";

/**
 * Generate a refresh token
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    {
      userId,
      type: "refresh",
    },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

/**
 * Generate an access token
 */
export function generateAccessToken(
  userId: string,
  username: string,
  role: "admin" | "cashier" | "guest"
): string {
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

/**
 * Hash a refresh token for storage
 */
export async function hashRefreshToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string) {
  return jwt.verify(token, config.jwt.secret) as {
    userId: string;
    type: "refresh";
    iat: number;
    exp: number;
  };
}

/**
 * Decode a refresh token without verification
 */
export function decodeRefreshToken(token: string) {
  return jwt.decode(token) as {
    userId: string;
    type: "refresh";
    iat: number;
    exp: number;
  } | null;
}

/**
 * Get token expiry date from config
 */
export function getTokenExpiryDate(expiresIn: string): Date {
  const now = new Date();
  
  // Parse expiresIn string (e.g., "15m", "7d", "1h")
  const match = expiresIn.match(/^(\d+)([mhd])$/);
  if (!match) {
    return new Date(now.getTime() + 15 * 60 * 1000); // Default 15 minutes
  }

  const value = parseInt(match[1], 10);
  const unit = match[2]!;
  
  switch (unit) {
    case "m":
      return new Date(now.getTime() + value * 60 * 1000);
    case "h":
      return new Date(now.getTime() + value * 60 * 60 * 1000);
    case "d":
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 15 * 60 * 1000);
  }
}
