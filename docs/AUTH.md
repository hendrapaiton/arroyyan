# Modul Auth - Dokumentasi

## Database Schema

### Tabel `users`

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik user |
| `username` | TEXT | UNIQUE NOT NULL | Username untuk login (3-20 char, alphanumeric) |
| `name` | TEXT | NOT NULL | Full name (min 4 char) |
| `password` | TEXT | NOT NULL | Hashed password (bcrypt) |
| `role` | TEXT | DEFAULT 'guest' | Role: admin \| cashier \| guest |
| `image` | TEXT | - | URL foto profil (optional) |
| `createdAt` | TEXT | NOT NULL | Tanggal pembuatan |
| `updatedAt` | TEXT | NOT NULL | Tanggal update terakhir |

### Tabel `sessions`

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik session |
| `userId` | TEXT | FK → users | Relasi ke user |
| `token` | TEXT | UNIQUE NOT NULL | JWT token |
| `expiresAt` | TEXT | NOT NULL | Tanggal expiry token |
| `createdAt` | TEXT | NOT NULL | Tanggal pembuatan |
| `updatedAt` | TEXT | NOT NULL | Tanggal update terakhir |
| `ipAddress` | TEXT | - | IP address client |
| `userAgent` | TEXT | - | User agent browser/app |

### Tabel `accounts` (Optional - untuk OAuth)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik account |
| `userId` | TEXT | FK → users | Relasi ke user |
| `accountId` | TEXT | NOT NULL | Account ID dari provider |
| `providerId` | TEXT | NOT NULL | Provider name (google, github, dll) |
| `accessToken` | TEXT | - | OAuth access token |
| `refreshToken` | TEXT | - | OAuth refresh token |
| `createdAt` | TEXT | NOT NULL | Tanggal pembuatan |
| `updatedAt` | TEXT | NOT NULL | Tanggal update terakhir |

---

## Roles & Permissions

| Role | Deskripsi | Akses |
|------|-----------|-------|
| `admin` | Administrator penuh | Semua endpoint |
| `cashier` | Kasir | POS, produk (read), etalase |
| `guest` | Tamu | Read-only (produk, stok) |

---

## API Endpoints

### 1. Register User Baru

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "username": "admin",
  "name": "Administrator",
  "password": "admin123",
  "role": "admin"
}
```

**Validasi:**
- `username`: 3-20 karakter, alphanumeric (a-z, A-Z, 0-9, _)
- `name`: minimal 4 karakter
- `password`: minimal 6 karakter
- `role`: optional, default "guest"

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User berhasil didaftarkan",
  "data": {
    "id": "user_1234567890_abc",
    "username": "admin",
    "name": "Administrator",
    "role": "admin"
  }
}
```

**Error Response (409 Conflict):**
```json
{
  "success": false,
  "error": "Username sudah digunakan"
}
```

---

### 2. Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2026-02-19T12:15:00.000Z",
    "user": {
      "id": "user_1234567890_abc",
      "username": "admin",
      "name": "Administrator",
      "role": "admin"
    }
  }
}
```

**JWT Token Payload:**
```json
{
  "userId": "user_1234567890_abc",
  "username": "admin",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Token Expiry:** 15 menit

---

### 3. Logout

**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout berhasil"
}
```

---

### 4. Get Current User

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "user_1234567890_abc",
    "username": "admin",
    "name": "Administrator",
    "role": "admin",
    "createdAt": "2026-02-19T10:00:00.000Z"
  }
}
```

---

## Authentication Flow

### Register → Login → Access Protected → Logout

```
┌─────────────────────────────────────────────────────────────┐
│  1. REGISTER                                                │
│  POST /api/auth/register                                    │
│  Body: { username, name, password, role }                   │
│  → User dibuat di database (password di-hash dengan bcrypt) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. LOGIN                                                   │
│  POST /api/auth/login                                       │
│  Body: { username, password }                               │
│  → Verify password                                          │
│  → Generate JWT token (exp: 15 menit)                       │
│  → Save session ke database                                 │
│  ← Return token + user info                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. ACCESS PROTECTED ENDPOINT                               │
│  GET /api/produk                                            │
│  Header: Authorization: Bearer <token>                      │
│  → Verify JWT (signature, expiry)                           │
│  → Extract user role dari token                             │
│  → Check role-based access                                  │
│  ← Return data (jika authorized)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. LOGOUT                                                  │
│  POST /api/auth/logout                                      │
│  Header: Authorization: Bearer <token>                      │
│  → Delete session dari database                             │
│  ← Token tidak bisa dipakai lagi                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Middleware Usage

### Auth Middleware (Verify JWT)

```typescript
import { Hono } from "hono";
import { authMiddleware } from "../middlewares/auth";

const app = new Hono();

// Endpoint yang butuh authentication
app.get("/api/produk", authMiddleware, async (c) => {
  const user = c.get("user");
  // user = { userId, username, role, iat, exp }
  
  return c.json({ user });
});
```

### Role-Based Middleware

```typescript
import { requireRole } from "../middlewares/auth";

// Hanya admin yang bisa akses
app.post("/api/produk", 
  authMiddleware, 
  requireRole("admin"), 
  async (c) => {
    // Only admin can reach here
  }
);

// Admin atau cashier yang bisa akses
app.post("/api/penjualan",
  authMiddleware,
  requireRole("admin", "cashier"),
  async (c) => {
    // Admin atau cashier can reach here
  }
);
```

---

## Default Users (Seed Data)

Untuk development, buat users berikut:

```typescript
// Admin
{
  username: "admin",
  name: "Administrator",
  password: "admin123",
  role: "admin"
}

// Cashier
{
  username: "kasir1",
  name: "Kasir Utama",
  password: "kasir123",
  role: "cashier"
}
```

---

## Environment Variables

```bash
# JWT Secret (WAJIB diubah di production!)
JWT_SECRET=your-super-secret-key-change-this-in-production

# Server
PORT=3000
```

---

## Security Best Practices

1. **Password Hashing** - Menggunakan bcrypt dengan salt rounds = 10
2. **JWT Expiry** - Token expired dalam 15 menit
3. **Session Storage** - Session disimpan di database untuk invalidation
4. **Username Validation** - Alphanumeric only, mencegah injection
5. **Error Messages** - Generic error untuk login (tidak reveal username exists)

---

## Testing

Jalankan unit tests:

```bash
bun test tests/auth.test.ts
```

Test coverage:
- ✅ Register user baru
- ✅ Validasi input (username, name, password)
- ✅ Duplicate username handling
- ✅ Login dengan credentials benar
- ✅ Login dengan credentials salah
- ✅ JWT token generation
- ✅ Session storage
- ✅ Protected endpoint access
- ✅ Logout & session invalidation
- ✅ Role-based access control
