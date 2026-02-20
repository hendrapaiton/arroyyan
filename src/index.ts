import { createApp, type Bindings, type Variables } from "./app";
import { createAuth } from "./auth";
import { createDb } from "./db";

// Export types for Cloudflare Workers
export type { Bindings, Variables };

// Create the main app instance
const app = createApp();

// Export the Hono app for Cloudflare Workers
export default {
  fetch: (request: Request, env: Bindings, ctx: ExecutionContext) => {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Bindings>;

// Export for other uses
export { createApp, createAuth, createDb };
