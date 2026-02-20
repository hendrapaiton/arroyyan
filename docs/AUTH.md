# Authentication Module

The authentication module handles user registration, login, logout, and session management using Better-Auth with a D1 database backend.

## Database Schema

### Users Table
| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key (nanoid) |
| name | text | User's full name |
| email | text | Unique email address |
| emailVerified | boolean | Email verification status |
| image | text | Profile image URL |
| createdAt | timestamp | Account creation date |
| updatedAt | timestamp | Last update date |

### Sessions Table
| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| userId | text | Reference to user.id |
| token | text | Unique session token |
| expiresAt | timestamp | Session expiration |
| createdAt | timestamp | Session creation |
| updatedAt | timestamp | Last update |
| ipAddress | text | Client IP address |
| userAgent | text | Client user agent |

### Accounts Table
| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| userId | text | Reference to user.id |
| accountId | text | Provider account ID |
| providerId | text | Provider name |
| accessToken | text | OAuth access token |
| refreshToken | text | OAuth refresh token |
| accessTokenExpiresAt | timestamp | Token expiration |
| scope | text | OAuth scope |

## API Endpoints

### POST /api/auth/signup

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "user_abc123",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

### POST /api/auth/signin

Sign in with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Signed in successfully",
  "data": {
    "session": {
      "token": "session_token_xyz",
      "expiresAt": "2026-02-27T00:00:00.000Z"
    }
  }
}
```

### POST /api/auth/signout

Sign out current session.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

### GET /api/auth/session

Get current user session information.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "session_abc123",
      "userId": "user_xyz789",
      "expiresAt": "2026-02-27T00:00:00.000Z"
    },
    "user": {
      "id": "user_xyz789",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

## Authentication Flow

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│  Client │      │  API    │      │  D1 DB  │
└────┬────┘      └────┬────┘      └────┬────┘
     │                │                │
     │  POST /signup  │                │
     │───────────────>│                │
     │                │  Create user   │
     │                │───────────────>│
     │                │                │
     │  POST /signin  │                │
     │───────────────>│                │
     │                │  Verify creds  │
     │                │───────────────>│
     │                │                │
     │  Session token │                │
     │<───────────────│                │
     │                │                │
     │  GET /todos    │                │
     │  (with token)  │                │
     │───────────────>│                │
     │                │  Validate      │
     │                │───────────────>│
     │                │                │
     │  Todos data    │                │
     │<───────────────│                │
     │                │                │
```

## Security Best Practices

1. **Password Requirements**: Minimum 8 characters, mix of letters and numbers
2. **Session Expiration**: Sessions expire after 7 days
3. **Secure Cookies**: Use secure cookies in production (HTTPS)
4. **Rate Limiting**: Implement rate limiting on auth endpoints
5. **CORS**: Configure allowed origins per environment

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| ENVIRONMENT | Environment name | development |
| CORS_ORIGINS | Allowed origins | localhost:3000 |

## Testing

```bash
# Run auth tests
bun test tests/auth.test.ts
```
