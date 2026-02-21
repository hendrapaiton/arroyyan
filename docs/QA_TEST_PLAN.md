# QA Test Plan - JWT Refresh Token dengan httpOnly Cookies

## Overview
Dokumentasi ini berisi test plan dan prosedur untuk menguji implementasi JWT refresh token yang dikirimkan melalui httpOnly cookies.

## Prerequisites
1. Server berjalan di `http://localhost:8787`
2. Database sudah di-migrate
3. Tool yang dibutuhkan:
   - cURL atau Postman
   - Bun runtime (untuk automated test)

## Test Cases

### TC-001: Register User Baru
**Tujuan**: Memastikan user baru dapat terdaftar

**Request**:
```bash
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "qatest",
    "name": "QA Test User",
    "password": "test123456",
    "role": "admin"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "User berhasil didaftarkan",
  "data": {
    "id": "user_xxx",
    "username": "qatest",
    "name": "QA Test User",
    "role": "admin"
  }
}
```

**Status Code**: 201 Created

---

### TC-002: Login dan Verifikasi httpOnly Cookie
**Tujuan**: Memastikan login berhasil dan refresh token dikirim sebagai httpOnly cookie

**Request**:
```bash
curl -v -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "qatest",
    "password": "test123456"
  }'
```

**Expected Response Headers**:
```
Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=<date>
```

**Expected Response Body**:
```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "token": "<access_token>",
    "expiresAt": "2024-01-01T12:15:00.000Z",
    "user": {
      "id": "user_xxx",
      "username": "qatest",
      "name": "QA Test User",
      "role": "admin"
    }
  }
}
```

**Verification Points**:
- [ ] Status code: 200 OK
- [ ] Set-Cookie header ada
- [ ] Cookie memiliki flag `HttpOnly`
- [ ] Cookie memiliki flag `Secure`
- [ ] Cookie memiliki flag `SameSite=Strict`
- [ ] Cookie memiliki flag `Path=/`
- [ ] Cookie memiliki `Expires` timestamp
- [ ] Access token ada di response body
- [ ] Access token adalah valid JWT

**Status Code**: 200 OK

---

### TC-003: Akses Protected Endpoint dengan Access Token
**Tujuan**: Memastikan access token dapat digunakan untuk akses protected endpoint

**Request**:
```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "user_xxx",
    "username": "qatest",
    "name": "QA Test User",
    "role": "admin",
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**Status Code**: 200 OK

---

### TC-004: Refresh Access Token
**Tujuan**: Memastikan refresh token dapat digunakan untuk mendapatkan access token baru

**Request**:
```bash
curl -v -X POST http://localhost:8787/api/auth/refresh \
  -H "Content-Type: application/json" \
  -b "refreshToken=<refresh_token>"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Token berhasil di-refresh",
  "data": {
    "token": "<new_access_token>",
    "expiresAt": "2024-01-01T12:30:00.000Z"
  }
}
```

**Verification Points**:
- [ ] Status code: 200 OK
- [ ] New access token ada
- [ ] New access token berbeda dari yang lama
- [ ] Expiry time updated

**Status Code**: 200 OK

---

### TC-005: Verifikasi Access Token Baru
**Tujuan**: Memastikan access token baru valid

**Request**:
```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer <new_access_token>"
```

**Expected Response**: Same as TC-003

**Status Code**: 200 OK

---

### TC-006: Refresh Tanpa Cookie (Negative Test)
**Tujuan**: Memastikan endpoint refresh menolak request tanpa cookie

**Request**:
```bash
curl -X POST http://localhost:8787/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response**:
```json
{
  "success": false,
  "error": "Refresh token tidak ditemukan"
}
```

**Status Code**: 401 Unauthorized

---

### TC-007: Refresh Dengan Invalid Token (Negative Test)
**Tujuan**: Memastikan endpoint refresh menolak invalid token

**Request**:
```bash
curl -X POST http://localhost:8787/api/auth/refresh \
  -H "Content-Type: application/json" \
  -b "refreshToken=invalid-token"
```

**Expected Response**:
```json
{
  "success": false,
  "error": "Refresh token tidak valid"
}
```

**Status Code**: 401 Unauthorized

---

### TC-008: Logout dan Clear Cookie
**Tujuan**: Memastikan logout berhasil dan cookie di-clear

**Request**:
```bash
curl -v -X POST http://localhost:8787/api/auth/logout \
  -H "Authorization: Bearer <access_token>"
```

**Expected Response Headers**:
```
Set-Cookie: refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0
```

**Expected Response Body**:
```json
{
  "success": true,
  "message": "Logout berhasil"
}
```

**Verification Points**:
- [ ] Status code: 200 OK
- [ ] Set-Cookie header ada
- [ ] Cookie di-clear dengan Max-Age=0

**Status Code**: 200 OK

---

### TC-009: Refresh Setelah Logout (Negative Test)
**Tujuan**: Memastikan refresh token tidak bisa digunakan setelah logout

**Request**:
```bash
curl -X POST http://localhost:8787/api/auth/refresh \
  -H "Content-Type: application/json" \
  -b "refreshToken=<old_refresh_token>"
```

**Expected Response**:
```json
{
  "success": false,
  "error": "Refresh token tidak ditemukan"
}
```

**Status Code**: 401 Unauthorized

---

### TC-010: Login Lagi Setelah Logout
**Tujuan**: Memastikan user bisa login lagi setelah logout

**Request**: Same as TC-002

**Expected**: Login berhasil dengan refresh token baru

**Status Code**: 200 OK

---

## Automated Test

Jalankan automated test dengan:

```bash
bun run test-qa.ts
```

Output akan menampilkan:
- ✅ Test yang passed
- ❌ Test yang failed
- 📊 Summary total test

## Security Checklist

### Cookie Security Flags
- [ ] **HttpOnly**: Cookie tidak bisa diakses via JavaScript (mencegah XSS)
- [ ] **Secure**: Cookie hanya dikirim via HTTPS (di production)
- [ ] **SameSite=Strict**: Mencegah CSRF attacks
- [ ] **Path=/**: Cookie dikirim ke semua endpoint

### Token Security
- [ ] Access token expiry: 15 menit
- [ ] Refresh token expiry: 7 hari
- [ ] Refresh token di-hash sebelum disimpan di database
- [ ] Refresh token di-revoke saat logout
- [ ] JWT signature validation

## Database Verification

Setelah login, verifikasi refresh token tersimpan di database:

```sql
SELECT * FROM refresh_tokens WHERE user_id = '<user_id>';
```

**Verification Points**:
- [ ] Token ter-hash (bukan plain text)
- [ ] expires_at set dengan benar (~7 hari dari now)
- [ ] ip_address dan user_agent tercatat
- [ ] revoked_at NULL (belum di-revoke)

## Troubleshooting

### Server tidak berjalan
```bash
bun run dev
```

### Database belum di-migrate
```bash
bun run db:migrate
```

### Cookie tidak terkirim
- Pastikan `credentials: 'include'` di fetch client
- Pastikan CORS setting mengizinkan credentials

### Token expired
- Gunakan refresh endpoint untuk mendapatkan token baru
- Atau login ulang

## Test Results Template

```
Test Date: _______________
Tester: _______________
Environment: _______________

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-001    | ☐ Pass ☐ Fail | |
| TC-002    | ☐ Pass ☐ Fail | |
| TC-003    | ☐ Pass ☐ Fail | |
| TC-004    | ☐ Pass ☐ Fail | |
| TC-005    | ☐ Pass ☐ Fail | |
| TC-006    | ☐ Pass ☐ Fail | |
| TC-007    | ☐ Pass ☐ Fail | |
| TC-008    | ☐ Pass ☐ Fail | |
| TC-009    | ☐ Pass ☐ Fail | |
| TC-010    | ☐ Pass ☐ Fail | |

Total Passed: __ / 10
Issues Found:
1. 
2. 
3. 
```
