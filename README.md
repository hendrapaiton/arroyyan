# Arroyyan - Petshop Management System

Professional Cloudflare Workers API for Petshop Management with Hono, Better-Auth, Drizzle ORM, Zod validation, and D1 Database.

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
│   ├── config.ts         # Environment configuration
│   ├── auth/
│   │   └── index.ts      # Better-Auth setup
│   ├── db/
│   │   ├── index.ts      # Drizzle ORM setup
│   │   └── schema.ts     # Database schema
│   ├── middlewares/
│   │   └── auth.ts       # Authentication middleware
│   ├── modules/
│   │   ├── auth/
│   │   │   └── index.ts  # Auth module
│   │   ├── customers/
│   │   │   └── index.ts  # Customer management
│   │   ├── products/
│   │   │   └── index.ts  # Product inventory
│   │   └── health/
│   │       └── index.ts  # Health check module
│   ├── lib/
│   │   ├── schemas.ts    # Zod schemas
│   │   ├── utils.ts      # Utility functions
│   │   └── nanoid.ts     # ID generator
│   └── types/            # TypeScript types
├── docs/
│   ├── API.md            # API documentation
│   ├── AUTH.md           # Auth module docs
│   ├── CUSTOMERS.md      # Customer management docs
│   ├── PRODUCTS.md       # Product inventory docs
│   └── QWEN.md           # Project context
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

## 🌐 Live Deployment

**Production URL:** https://arroyyan.karnarupa.workers.dev

### Live Endpoints

| Endpoint | URL |
|----------|-----|
| API Info | `https://arroyyan.karnarupa.workers.dev/` |
| Health Check | `https://arroyyan.karnarupa.workers.dev/health` |
| Auth Signup | `https://arroyyan.karnarupa.workers.dev/api/auth/signup` |
| Auth Signin | `https://arroyyan.karnarupa.workers.dev/api/auth/signin` |
| Customers | `https://arroyyan.karnarupa.workers.dev/api/customers` |
| Products | `https://arroyyan.karnarupa.workers.dev/api/products` |

## 📡 API Endpoints

### Root

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API information |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health status |
| GET | `/health/ready` | Readiness check |
| GET | `/health/live` | Liveness check |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create new account |
| POST | `/api/auth/signin` | Sign in |
| POST | `/api/auth/signout` | Sign out |
| GET | `/api/auth/session` | Get current session |

### Customers (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List all customers |
| GET | `/api/customers/:id` | Get customer with pets |
| POST | `/api/customers` | Create customer |
| PATCH | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Delete customer |

### Products (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List all products |
| GET | `/api/products/low-stock` | Low stock alert |
| GET | `/api/products/:id` | Get single product |
| POST | `/api/products` | Create product |
| PATCH | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

## 📝 Usage Examples

### API Info

```bash
curl http://localhost:8787/
```

### Sign Up

```bash
curl -X POST http://localhost:8787/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@petshop.com",
    "password": "password123",
    "name": "Admin"
  }'
```

### Sign In

```bash
curl -X POST http://localhost:8787/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@petshop.com",
    "password": "password123"
  }'
```

### Create Customer (Authenticated)

```bash
curl -X POST http://localhost:8787/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "08123456789"
  }'
```

### Create Product (Authenticated)

```bash
curl -X POST http://localhost:8787/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "name": "Dog Food Premium",
    "sku": "DF-001",
    "category": "food",
    "price": 150000,
    "cost": 100000,
    "stock": 50,
    "minStock": 10,
    "unit": "kg"
  }'
```

### Get All Customers

```bash
curl -X GET http://localhost:8787/api/customers \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Get Low Stock Products

```bash
curl -X GET http://localhost:8787/api/products/low-stock \
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
| `bun run db:migrate` | Apply migrations to local D1 |
| `bun run db:migrate:remote` | Apply migrations to remote D1 |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run typecheck` | Type check the project |
| `bun test` | Run all tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run test:coverage` | Run tests with coverage report |

## 🔐 Authentication Flow

1. Staff user signs up via `/api/auth/signup`
2. User signs in via `/api/auth/signin`
3. Session token is returned
4. Include token in `Authorization: Bearer <token>` header for protected routes

## 🗄️ Database Schema

### Auth Tables
- **user** - Staff/admin user accounts
- **session** - User sessions
- **account** - OAuth provider accounts
- **verification** - Email verification tokens

### Petshop Tables
- **customer** - Customer/pet owner information
- **pet** - Pet records (linked to customers)
- **product** - Product inventory
- **service** - Available services
- **appointment** - Service bookings
- **sale** - Sales transactions
- **sale_item** - Sale line items

## 📚 Documentation

- [API Documentation](./docs/API.md) - Complete API reference
- [Auth Module](./docs/AUTH.md) - Authentication details
- [Customers Module](./docs/CUSTOMERS.md) - Customer management
- [Products Module](./docs/PRODUCTS.md) - Product inventory
- [Project Context](./docs/QWEN.md) - Architecture and patterns

## 📚 Additional Resources

- [Hono Documentation](https://hono.dev/docs)
- [Better-Auth Documentation](https://www.better-auth.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)

## 📄 License

This project is licensed under the [MIT License](LICENSE).
