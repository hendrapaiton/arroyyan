import {Hono} from "hono";
import {cors} from "hono/cors";
import {logger} from "hono/logger";
import {secureHeaders} from "hono/secure-headers";
import {HTTPException} from "hono/http-exception";

// Import modules
import {auth} from "./modules/auth";
import {produk} from "./modules/produk";
import {pasokan} from "./modules/pasokan";
import {etalase} from "./modules/etalase";
import {penjualan} from "./modules/penjualan";
import {dashboard} from "./modules/dashboard";

export type Bindings = {
    DB: D1Database;
    ENVIRONMENT: string;
};

export type Variables = {
    userId?: string;
};

/**
 * Create the main Hono application with all middleware and routes
 */
export function createApp() {
    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

    // Global middleware
    app.use("*", logger());
    app.use("*", secureHeaders());
    app.use(
        "*",
        cors({
            origin: ["http://localhost:3000", "http://localhost:8787"],
            allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowHeaders: ["Content-Type", "Authorization"],
            exposeHeaders: ["Content-Length"],
            maxAge: 600,
            credentials: true,
        })
    );

    // Root endpoint - API information
    app.get("/", (c) => {
        return c.json({
            name: "Petshop Management System",
            url: "www.karnarupa.com",
        });
    });

    // Health check endpoint
    app.get("/health", (c) => {
        return c.json({
            status: "healthy",
            timestamp: new Date().toISOString(),
        });
    });

    // API routes
    app.route("/api/auth", auth);
    app.route("/api/produk", produk);
    app.route("/api/pasokan", pasokan);
    app.route("/api/etalase", etalase);
    app.route("/api/penjualan", penjualan);
    app.route("/api/dashboard", dashboard);

    // 404 handler
    app.notFound((c) => {
        return c.json(
            {
                success: false,
                error: "Not Found",
                message: `Route ${c.req.path} not found`,
            },
            404
        );
    });

    // Error handler - handles all errors including HTTPException from middleware
    app.onError((err, c) => {
        console.error("Error:", err);

        // Handle HTTPException from Hono middleware (auth, etc.)
        if (err instanceof HTTPException) {
            return c.json(
                {
                    success: false,
                    error: err.message,
                },
                err.status
            );
        }

        return c.json(
            {
                success: false,
                error: "Internal Server Error",
                message: err.message || "An unexpected error occurred",
            },
            500
        );
    });

    return app;
}
