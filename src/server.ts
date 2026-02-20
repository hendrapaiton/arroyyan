/**
 * Development server for local testing with Bun
 * Run with: bun run --hot src/server.ts
 */

import { createApp } from "./app";
import { validateConfig, config } from "./config";

// Validate configuration
validateConfig();

// Create the app
const app = createApp();

// Get port from config
const PORT = config.server.port;

console.log(`🚀 Server starting on http://localhost:${PORT}`);
console.log(`📝 Environment: ${config.server.env}`);

// Start server
export default {
  port: PORT,
  fetch: app.fetch,
};
