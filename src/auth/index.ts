import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "@/db";

/**
 * Better-Auth configuration for Cloudflare Workers
 * Uses Drizzle adapter with D1 database
 */
export function createAuth(db: Database, baseURL: string) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    baseURL,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Set to true in production with email service
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    user: {
      additionalFields: {
        emailVerified: {
          type: "boolean",
          required: false,
        },
      },
    },
    advanced: {
      // Disable cookies for API-only usage
      useSecureCookies: false,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
