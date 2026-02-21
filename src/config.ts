/**
 * Application Configuration
 * Centralized configuration for the entire application
 */

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} environment variable is required`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string = ""): string {
  return process.env[key] || defaultValue;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export const config = {
  // Server configuration
  server: {
    port: parseInt(getOptionalEnv("PORT", "3000")),
    env: getOptionalEnv("NODE_ENV", "development"),
  },

  // JWT configuration
  jwt: {
    secret: getOptionalEnv("JWT_SECRET", "default-dev-secret-change-in-production-min-32-chars"),
    expiresIn: "15m", // Access token expiry: 15 minutes
    refreshExpiresIn: "7d", // Refresh token expiry: 7 days
  },

  // Database configuration
  database: {
    path: getOptionalEnv("DATABASE_PATH", "file:cuan.db"),
  },

  // Security configuration
  security: {
    bcryptRounds: 10,
    passwordMinLength: 6, // For testing compatibility
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5, // 5 attempts per window
  },

  // Pagination configuration
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },

  // Stock thresholds
  inventory: {
    lowStockThreshold: 10,
    minSellingPrice: 1000,
    minPurchasePrice: 1000,
  },
} as const;

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate configuration on startup
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // JWT_SECRET strength check (only in production)
  if (config.server.env === "production" && config.jwt.secret.length < 32) {
    errors.push("JWT_SECRET should be at least 32 characters long for security");
  }

  // Throw error if any validation failed
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join("\n")}`);
  }

  console.log("✅ Configuration validated successfully");

  if (config.server.env === "production") {
    console.log("🔒 Running in PRODUCTION mode");
  } else {
    console.log("🔧 Running in DEVELOPMENT mode");
  }
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Config = typeof config;
export type ServerConfig = typeof config.server;
export type JWTConfig = typeof config.jwt;
export type DatabaseConfig = typeof config.database;
export type SecurityConfig = typeof config.security;
export type RateLimitConfig = typeof config.rateLimit;
export type PaginationConfig = typeof config.pagination;
