import { Hono } from "hono";
import type { Bindings, Variables } from "../app";
import { createAuth } from "@/auth";
import { createDb } from "@/db";
import { loginSchema, createUserSchema } from "@/lib/schemas";
import { validate, apiResponse, errorResponse } from "@/lib/utils";

/**
 * Authentication routes using Better-Auth
 */
export const authRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Sign up
authRoutes.post("/signup", validate(createUserSchema), async (c) => {
  try {
    const db = createDb(c.env.DB);
    const baseURL = c.req.header("origin") || `http://${c.req.header("host")}`;
    const auth = createAuth(db, baseURL);

    const { email, password, name } = c.req.valid("json");

    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
      headers: c.req.raw.headers,
    });

    return c.json(apiResponse(result, "Account created successfully"), 201);
  } catch (error) {
    console.error("Signup error:", error);
    return c.json(
      errorResponse("Failed to create account. Email may already be in use."),
      400
    );
  }
});

// Sign in
authRoutes.post("/signin", validate(loginSchema), async (c) => {
  try {
    const db = createDb(c.env.DB);
    const baseURL = c.req.header("origin") || `http://${c.req.header("host")}`;
    const auth = createAuth(db, baseURL);

    const { email, password } = c.req.valid("json");

    const result = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: c.req.raw.headers,
    });

    return c.json(apiResponse(result, "Signed in successfully"));
  } catch (error) {
    console.error("Signin error:", error);
    return c.json(errorResponse("Invalid email or password"), 401);
  }
});

// Sign out
authRoutes.post("/signout", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const baseURL = c.req.header("origin") || `http://${c.req.header("host")}`;
    const auth = createAuth(db, baseURL);

    await auth.api.signOut({
      headers: c.req.raw.headers,
    });

    return c.json(apiResponse(null, "Signed out successfully"));
  } catch (error) {
    console.error("Signout error:", error);
    return c.json(errorResponse("Failed to sign out"), 500);
  }
});

// Get current session
authRoutes.get("/session", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const baseURL = c.req.header("origin") || `http://${c.req.header("host")}`;
    const auth = createAuth(db, baseURL);

    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json(errorResponse("Not authenticated", "Unauthorized"), 401);
    }

    return c.json(apiResponse(session));
  } catch (error) {
    console.error("Session error:", error);
    return c.json(errorResponse("Failed to get session"), 500);
  }
});
