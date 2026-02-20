# Arroyyan - Petshop Management System

## Overview

Arroyyan is a comprehensive **Petshop Management System** built with Hono on Cloudflare Workers. It provides complete functionality for managing customers, pets, products, services, appointments, and sales.

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
│   │   ├── customers/
│   │   │   └── index.ts      # Customer management
│   │   ├── products/
│   │   │   └── index.ts      # Product inventory
│   │   └── health/
│   │       └── index.ts      # Health check module
│   ├── lib/
│   │   ├── schemas.ts        # Zod schemas
│   │   ├── utils.ts          # Utility functions
│   │   └── nanoid.ts         # ID generator
│   └── types/
│       └── index.ts          # Type definitions
├── docs/
│   ├── API.md                # API documentation
│   ├── AUTH.md               # Auth module docs
│   ├── CUSTOMERS.md          # Customer management docs
│   └── PRODUCTS.md           # Product inventory docs
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
- **user** - Staff/admin user accounts
- **session** - User sessions
- **account** - OAuth provider accounts
- **verification** - Email verification tokens

### Petshop Tables
- **customer** - Customer/pet owner information
- **pet** - Pet records (linked to customers)
- **product** - Product inventory
- **service** - Available services (grooming, vet, etc.)
- **appointment** - Service bookings
- **sale** - Sales transactions
- **sale_item** - Sale line items

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

### Customers
- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get customer with pets
- `POST /api/customers` - Create customer
- `PATCH /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Products
- `GET /api/products` - List products
- `GET /api/products/low-stock` - Low stock alert
- `GET /api/products/:id` - Get product
- `POST /api/products` - Create product
- `PATCH /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

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
bun test:watch                 # Watch mode
bun test:coverage              # With coverage

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
import type { Bindings, Variables } from "../../app";

const module = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Auth middleware
const authMiddleware = async (c, next) => { ... };
module.use("*", authMiddleware);

// Routes
module.get("/", async (c) => { ... });
module.post("/", async (c) => { ... });

export { module };
```

## Authentication Flow

1. Staff user registers via `/api/auth/signup`
2. User signs in via `/api/auth/signin`
3. Session token returned and stored client-side
4. Token included in `Authorization: Bearer <token>` header
5. Middleware validates token on protected routes
6. userId set in context for database queries

## Testing

Tests use Bun's built-in test runner:

```typescript
import { describe, test, expect } from "bun:test";

describe("Customers Module", () => {
  test("should create customer", async () => {
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

## Business Features

### Customer Management
- Store customer contact information
- Track customer notes and preferences
- Link pets to customers

### Product Inventory
- Track stock levels
- Low stock alerts
- SKU management
- Cost and price tracking
- Profit margin calculation

### Pet Records (Planned)
- Pet profiles with medical history
- Breed, age, weight tracking
- Photo storage

### Services (Planned)
- Grooming services
- Veterinary services
- Boarding services
- Price and duration management

### Appointments (Planned)
- Service booking system
- Schedule management
- Status tracking

### Sales & POS (Planned)
- Product sales recording
- Payment method tracking
- Sales reports
