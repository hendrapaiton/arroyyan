# JWT Refresh Token dengan httpOnly Cookies

Implementasi JWT refresh token yang dikirimkan melalui httpOnly cookies untuk keamanan yang lebih baik.

## Fitur

- **Access Token**: JWT token dengan expiry 15 menit, dikirimkan di response body
- **Refresh Token**: JWT token dengan expiry 7 hari, dikirimkan sebagai httpOnly cookie
- **Token Rotation**: Refresh token dapat di-rotate untuk keamanan tambahan
- **Revocation**: Refresh token dapat di-revoke secara manual

## Flow Authentication

### 1. Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2024-01-01T12:15:00.000Z",
    "user": {
      "id": "user_123",
      "username": "admin",
      "name": "Administrator",
      "role": "admin"
    }
  }
}
```

**Cookie yang di-set:**
```
Set-Cookie: refreshToken=<refresh_token>; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=<date>
```

### 2. Menggunakan Access Token

Setiap request ke endpoint protected memerlukan access token di header:

```bash
GET /api/auth/me
Authorization: Bearer <access_token>
```

### 3. Refresh Access Token

Ketika access token expired, gunakan refresh endpoint:

```bash
POST /api/auth/refresh
Cookie: refreshToken=<refresh_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Token berhasil di-refresh",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2024-01-01T12:30:00.000Z"
  }
}
```

### 4. Logout

```bash
POST /api/auth/logout
Authorization: Bearer <access_token>
```

Response akan clear refresh token cookie dan invalidate semua token di database.

## Keamanan

### httpOnly Cookie Properties

- **HttpOnly**: Tidak dapat diakses oleh JavaScript (mencegah XSS attacks)
- **Secure**: Hanya dikirimkan melalui HTTPS (di production)
- **SameSite=Strict**: Mencegah CSRF attacks
- **Path=/**: Cookie dikirim ke semua endpoint

### Token Storage

- **Access Token**: Disimpan di client (localStorage/memory) untuk dikirim via Authorization header
- **Refresh Token**: Disimpan di server (database) sebagai hash, client hanya menerima plain token via cookie

### Token Expiry

- **Access Token**: 15 menit (configurable via `JWT_EXPIRES_IN`)
- **Refresh Token**: 7 hari (configurable via `JWT_REFRESH_EXPIRES_IN`)

## Environment Variables

```env
JWT_SECRET=your-super-secret-key-min-32-characters-long
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Endpoint Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/auth/register | Register user baru | ❌ |
| POST | /api/auth/login | Login dengan username & password | ❌ |
| POST | /api/auth/logout | Logout dan invalidate tokens | ✅ |
| GET | /api/auth/me | Get current user info | ✅ |
| POST | /api/auth/refresh | Refresh access token | Cookie only |

## Client-Side Implementation Example

```javascript
// Login
async function login(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include' // Important: include cookies
  });
  
  const data = await response.json();
  if (data.success) {
    // Save access token in memory/localStorage
    localStorage.setItem('accessToken', data.data.token);
  }
  return data;
}

// Refresh token
async function refreshToken() {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include' // Send refresh token cookie
  });
  
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('accessToken', data.data.token);
    return data.data.token;
  }
  throw new Error('Refresh failed');
}

// API call with auto-refresh
async function apiCall(endpoint, options = {}) {
  let token = localStorage.getItem('accessToken');
  
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
    credentials: 'include'
  });
  
  // If token expired, refresh and retry
  if (response.status === 401) {
    try {
      token = await refreshToken();
      const retryResponse = await fetch(endpoint, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include'
      });
      return retryResponse.json();
    } catch (error) {
      // Redirect to login
      window.location.href = '/login';
    }
  }
  
  return response.json();
}
```

## Database Schema

Tabel `refresh_tokens`:

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| user_id | TEXT | Foreign key to users |
| token | TEXT | Hashed refresh token |
| expires_at | TEXT | Token expiry timestamp |
| created_at | TEXT | Creation timestamp |
| revoked_at | TEXT | Revocation timestamp (nullable) |
| replaced_by_token | TEXT | Token rotation tracking (nullable) |
| ip_address | TEXT | Client IP address |
| user_agent | TEXT | Client user agent |

## Best Practices

1. **Selalu gunakan HTTPS di production** untuk mencegah man-in-the-middle attacks
2. **Implementasi token rotation** untuk keamanan tambahan (opsional)
3. **Monitor suspicious activity** seperti multiple refresh dari IP berbeda
4. **Clear tokens saat logout** untuk mencegah reuse
5. **Gunakan short-lived access tokens** (15-30 menit)
6. **Implementasi rate limiting** pada endpoint login dan refresh
