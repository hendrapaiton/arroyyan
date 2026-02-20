# API Documentation

## Base URL

**Development:** `http://localhost:8787`  
**Production:** `https://arroyyan.karnarupa.workers.dev`

## Overview

Arroyyan is a RESTful API built with Hono on Cloudflare Workers, providing authentication and todo management functionality.

## Root Endpoint

### GET /

Returns API information.

**Response:**
```json
{
  "name": "Karnaval Purwarupa",
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

## Todo Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/todos | List all todos | Yes |
| GET | /api/todos/:id | Get single todo | Yes |
| POST | /api/todos | Create todo | Yes |
| PATCH | /api/todos/:id | Update todo | Yes |
| DELETE | /api/todos/:id | Delete todo | Yes |

See [TODOS.md](./TODOS.md) for detailed documentation.

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

Most endpoints require authentication using a Bearer token:

```
Authorization: Bearer <session_token>
```

### Getting a Token

1. Sign in via `POST /api/auth/signin`
2. Receive session token in response
3. Include token in subsequent requests

## CORS

The API supports CORS for cross-origin requests from allowed origins:

- `http://localhost:3000` (development)
- `http://localhost:8787` (local workers)
- `https://yourdomain.com` (production)
- `https://karnarupa.com` (production)
- `https://www.karnarupa.com` (production)

## Rate Limiting

Rate limiting is recommended for production deployments to prevent abuse.

## Examples

### Complete Authentication Flow

```bash
# 1. Register
curl -X POST http://localhost:8787/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"John"}'

# 2. Sign in
curl -X POST http://localhost:8787/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# 3. Create todo (use token from sign-in response)
curl -X POST http://localhost:8787/api/todos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title":"My first todo"}'

# 4. Get all todos
curl -X GET http://localhost:8787/api/todos \
  -H "Authorization: Bearer <token>"
```
