# Arroyyan

Professional Cloudflare Workers API with Hono, Better-Auth, Drizzle ORM, Zod validation, and D1 Database.

## 🚀 Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | Cloudflare Workers |
| **Framework** | Hono |
| **Authentication** | Better-Auth |
| **ORM** | Drizzle ORM |
| **Database** | Cloudflare D1 (SQLite) |
| **Validation** | Zod |
| **Language** | TypeScript |

## 📁 Project Structure

```
arroyyan/
├── src/
│   ├── index.ts          # Worker entry point
│   ├── app.ts            # Hono app configuration
│   ├── auth/
│   │   └── index.ts      # Better-Auth setup
│   ├── db/
│   │   ├── index.ts      # Drizzle ORM setup
│   │   └── schema.ts     # Database schema
│   ├── routes/
│   │   ├── health.ts     # Health check endpoints
│   │   ├── auth.ts       # Authentication endpoints
│   │   └── todos.ts      # Todo CRUD endpoints
│   ├── lib/
│   │   ├── schemas.ts    # Zod schemas
│   │   ├── utils.ts      # Utility functions
│   │   └── nanoid.ts     # ID generator
│   └── types/            # TypeScript types
├── drizzle/
│   └── 0000_initial.sql  # Database migrations
├── drizzle.config.ts     # Drizzle Kit config
├── wrangler.toml         # Cloudflare Workers config
├── tsconfig.json         # TypeScript config
└── package.json
```

## 🛠️ Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.3.9+ or Node.js v18+
- Cloudflare account (for D1 and Workers)

### Installation

```bash
bun install
```

### Setup D1 Database

1. Create a new D1 database:

```bash
npx wrangler d1 create arroyyan-db
```

2. Update `wrangler.toml` with your database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "arroyyan-db"
database_id = "your-database-id-here"
```

3. Run migrations:

```bash
bun run db:migrate
```

### Development

```bash
bun run dev
```

The API will be available at `http://localhost:8787`

## 📡 API Endpoints

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health status |
| GET | `/health/ready` | Readiness check |
| GET | `/health/live` | Liveness check |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Create new account |
| POST | `/auth/signin` | Sign in |
| POST | `/auth/signout` | Sign out |
| GET | `/auth/session` | Get current session |

### Todos (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/todos` | Get all todos |
| GET | `/todos/:id` | Get single todo |
| POST | `/todos` | Create todo |
| PATCH | `/todos/:id` | Update todo |
| DELETE | `/todos/:id` | Delete todo |

## 📝 Usage Examples

### Sign Up

```bash
curl -X POST http://localhost:8787/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'
```

### Sign In

```bash
curl -X POST http://localhost:8787/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Create Todo (Authenticated)

```bash
curl -X POST http://localhost:8787/todos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "title": "Buy groceries",
    "description": "Milk, eggs, bread"
  }'
```

### Get All Todos

```bash
curl -X GET http://localhost:8787/todos \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## 🚢 Deployment

### Deploy to Cloudflare

```bash
bun run deploy
```

### Production Environment

For production deployment:

```bash
bun run deploy --env production
```

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server |
| `bun run deploy` | Deploy to Cloudflare |
| `bun run db:generate` | Generate new migrations |
| `bun run db:migrate` | Apply migrations to D1 |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run typecheck` | Type check the project |
| `bun test` | Run all tests |
| `bun test:watch` | Run tests in watch mode |
| `bun test:coverage` | Run tests with coverage report |

## 🧪 Testing

The project includes comprehensive tests using **Bun's built-in test runner**.

### Run Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage

# Run specific test file
bun test tests/database.test.ts
```

### Test Structure

| File | Description |
|------|-------------|
| `tests/utils.ts` | Test utilities and factories |
| `tests/database.test.ts` | Database schema tests |
| `tests/auth.test.ts` | Authentication flow tests |
| `tests/todos.test.ts` | Todo CRUD integration tests |
| `tests/migrations.test.ts` | Migration validation tests |

### Test Coverage

Tests cover:
- **Database Schema**: User, Session, Account, Verification, Todo tables
- **Constraints**: Unique, Foreign Key, Cascade Delete
- **Auth Flows**: Registration, Login, Session Management, OAuth
- **CRUD Operations**: Create, Read, Update, Delete with proper isolation
- **Migrations**: SQL validation, indexes, constraints

### Writing New Tests

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDatabase, factories } from "./utils";
import * as schema from "../src/db/schema";

describe("My Feature Tests", () => {
  let db: ReturnType<typeof createTestDatabase>["db"];

  beforeEach(() => {
    const testDb = createTestDatabase();
    db = testDb.db;
  });

  test("should do something", async () => {
    // Your test here
  });
});
```

## 🔐 Authentication Flow

1. User signs up via `/auth/signup`
2. User signs in via `/auth/signin`
3. Session token is returned
4. Include token in `Authorization: Bearer <token>` header for protected routes

## 🗄️ Database Schema

The project includes the following tables:

- **user** - User accounts
- **session** - User sessions
- **account** - OAuth provider accounts
- **verification** - Email verification tokens
- **todo** - Example application table

## 📚 Additional Resources

- [Hono Documentation](https://hono.dev/docs)
- [Better-Auth Documentation](https://www.better-auth.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)

## 📄 License

This project is licensed under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 Hendra Dwi Saputra

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

## 👨‍💻 Author

**Hendra Dwi Saputra**  
Website: [www.karnarupa.com](https://www.karnarupa.com)
