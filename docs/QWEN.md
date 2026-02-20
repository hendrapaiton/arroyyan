# Arroyyan - Project Context

## Overview

Arroyyan is a RESTful API built with Hono on Cloudflare Workers, providing authentication and todo management functionality. The project follows a modular architecture similar to the Ternak project.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Hono v4 |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| ORM | Drizzle ORM |
| Auth | Better-Auth |
| Validation | Zod |
| Package Manager | Bun |

## Project Structure

```
arroyyan/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Main app configuration
│   ├── config.ts             # Environment configuration
│   ├── auth/
│   │   └── index.ts          # Better-Auth setup
│   ├── db/
│   │   ├── index.ts          # Database connection
│   │   └── schema.ts         # Drizzle schema
│   ├── middlewares/
│   │   └── auth.ts           # Auth middleware
│   ├── modules/
│   │   ├── auth/
│   │   │   └── index.ts      # Auth module
│   │   ├── todos/
│   │   │   └── index.ts      # Todos module
│   │   └── health/
│   │       └── index.ts      # Health check module
│   ├── lib/
│   │   ├── schemas.ts        # Zod schemas
│   │   ├── utils.ts          # Utility functions
│   │   └── nanoid.ts         # ID generator
│   └── types/
│       └── index.ts          # Type definitions
├── docs/
│   ├── AUTH.md               # Auth module docs
│   ├── TODOS.md              # Todos module docs
│   └── API.md                # API documentation
├── drizzle/
│   └── 0000_initial.sql      # Database migrations
├── tests/
│   └── *.test.ts             # Test files
├── package.json
├── tsconfig.json
├── wrangler.toml             # Cloudflare config
└── drizzle.config.ts         # Drizzle config
```

## Database Schema

### Auth Tables
- **user** - User accounts
- **session** - User sessions
- **account** - OAuth accounts
- **verification** - Email verification tokens

### Application Tables
- **todo** - Todo items (user-specific)

## API Endpoints

### Root
- `GET /` - API information

### Health
- `GET /health` - Health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### Authentication
- `POST /api/auth/signup` - Register user
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/session` - Get session

### Todos
- `GET /api/todos` - List todos
- `GET /api/todos/:id` - Get todo
- `POST /api/todos` - Create todo
- `PATCH /api/todos/:id` - Update todo
- `DELETE /api/todos/:id` - Delete todo

## Commands

```bash
# Development
bun run dev                    # Start dev server

# Deployment
bun run deploy                 # Deploy to Cloudflare

# Database
bun run db:generate            # Generate migrations
bun run db:migrate             # Run migrations locally
bun run db:migrate:remote      # Run migrations on remote
bun run db:studio              # Open Drizzle Studio

# Testing
bun test                       # Run tests
bun test:watch                 # Run tests in watch mode
bun test:coverage              # Run tests with coverage

# Type checking & linting
bun run typecheck              # TypeScript check
bun run lint                   # ESLint
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| ENVIRONMENT | Environment name | development |

## Configuration

### CORS Origins
- `http://localhost:3000`
- `http://localhost:8787`
- `https://yourdomain.com`
- `https://karnarupa.com`
- `https://www.karnarupa.com`

### Session Settings
- **Expires In**: 7 days
- **Update Age**: 1 day
- **Cookie Cache**: 5 minutes

## Module Pattern

Each module follows a consistent pattern:

```typescript
import { Hono } from "hono";
import type { Bindings, Variables } from "../app";

const module = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Routes
module.get("/", async (c) => { ... });
module.post("/", async (c) => { ... });

export { module };
```

## Authentication Flow

1. User registers via `/api/auth/signup`
2. User signs in via `/api/auth/signin`
3. Session token returned and stored client-side
4. Token included in `Authorization: Bearer <token>` header
5. Middleware validates token on protected routes
6. userId set in context for database queries

## Testing

Tests use Bun's built-in test runner:

```typescript
import { describe, test, expect } from "bun:test";

describe("Module", () => {
  test("should do something", async () => {
    // Test implementation
  });
});
```

## Deployment

The API is deployed to Cloudflare Workers:
- **URL**: https://arroyyan.karnarupa.workers.dev
- **Deploy Command**: `bun run deploy`

## Live URL

- **Production**: https://arroyyan.karnarupa.workers.dev
