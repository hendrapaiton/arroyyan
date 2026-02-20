# API Documentation

## Base URL

**Development:** `http://localhost:8787`  
**Production:** `https://arroyyan.karnarupa.workers.dev`

## Overview

Arroyyan is a **Petshop Management System** API built with Hono on Cloudflare Workers, providing authentication, customer management, pet records, product inventory, services, appointments, and sales tracking.

## Root Endpoint

### GET /

Returns API information.

**Response:**
```json
{
  "name": "Arroyyan - Petshop Management System",
  "url": "www.karnarupa.com"
}
```

## Health Check Endpoints

### GET /health

General health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-20T00:00:00.000Z"
}
```

### GET /health/ready

Readiness probe for all dependencies.

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": "ok",
    "auth": "ok"
  }
}
```

### GET /health/live

Liveness probe.

**Response:**
```json
{
  "alive": true
}
```

## Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/signup | Register new user |
| POST | /api/auth/signin | Sign in user |
| POST | /api/auth/signout | Sign out user |
| GET | /api/auth/session | Get current session |

See [AUTH.md](./AUTH.md) for detailed documentation.

## Customer Endpoints

All customer endpoints require authentication.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/customers | List all customers | Yes |
| GET | /api/customers/:id | Get customer with pets | Yes |
| POST | /api/customers | Create customer | Yes |
| PATCH | /api/customers/:id | Update customer | Yes |
| DELETE | /api/customers/:id | Delete customer | Yes |

### Example: Create Customer

```bash
curl -X POST http://localhost:8787/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "08123456789",
    "address": "Jl. Example No. 123"
  }'
```

See [CUSTOMERS.md](./CUSTOMERS.md) for detailed documentation.

## Product Endpoints

All product endpoints require authentication.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/products | List all products | Yes |
| GET | /api/products/low-stock | Get low stock products | Yes |
| GET | /api/products/:id | Get single product | Yes |
| POST | /api/products | Create product | Yes |
| PATCH | /api/products/:id | Update product | Yes |
| DELETE | /api/products/:id | Delete product | Yes |

### Example: Create Product

```bash
curl -X POST http://localhost:8787/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
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

See [PRODUCTS.md](./PRODUCTS.md) for detailed documentation.

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error type",
  "message": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error |

## Authentication

All protected endpoints require authentication using a Bearer token:

```
Authorization: Bearer <session_token>
```

### Getting a Token

1. Sign in via `POST /api/auth/signin`
2. Receive session token in response
3. Include token in subsequent requests

## Database Schema

### Auth Tables
- **user** - User accounts (staff/admin)
- **session** - User sessions
- **account** - OAuth accounts
- **verification** - Verification tokens

### Petshop Tables
- **customer** - Customer/pet owner information
- **pet** - Pet records
- **product** - Product inventory
- **service** - Available services
- **appointment** - Service bookings
- **sale** - Sales transactions
- **sale_item** - Sale line items

## CORS

The API supports CORS for cross-origin requests from allowed origins:

- `http://localhost:3000` (development)
- `http://localhost:8787` (local workers)
- `https://karnarupa.com` (production)
- `https://www.karnarupa.com` (production)

## Examples

### Complete Flow: Register Customer and Create Sale

```bash
# 1. Sign in
curl -X POST http://localhost:8787/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@petshop.com","password":"password123"}'

# 2. Create customer (use token from sign-in)
curl -X POST http://localhost:8787/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "08123456789"
  }'

# 3. Create product
curl -X POST http://localhost:8787/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Cat Food",
    "sku": "CF-001",
    "category": "food",
    "price": 75000,
    "stock": 100
  }'

# 4. Get all customers
curl -X GET http://localhost:8787/api/customers \
  -H "Authorization: Bearer <token>"

# 5. Get low stock products
curl -X GET http://localhost:8787/api/products/low-stock \
  -H "Authorization: Bearer <token>"
```
