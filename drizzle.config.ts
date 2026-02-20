import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    // For local development with wrangler
    // The actual D1 database is accessed through Cloudflare's binding
    url: "./dev.db",
  },
});
