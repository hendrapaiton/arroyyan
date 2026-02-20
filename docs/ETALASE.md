# Modul Etalase - Dokumentasi

## Overview

Modul Etalase mengelola **transfer stok dari gudang ke etalase**. Barang yang berada di etalase adalah barang yang siap dijual di kasir.

### Fitur Utama
- ✅ Transfer stok gudang → etalase
- ✅ Auto-update inventory (warehouse -, display +)
- ✅ Audit trail (siapa yang melakukan transfer)
- ✅ Stock statistics dashboard
- ✅ Restock suggestions (auto-suggest produk yang perlu diisi ulang)

---

## Database Schema

### Tabel `stock_transfers`

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik transfer |
| `transfer_number` | TEXT | UNIQUE NOT NULL | Nomor referensi (TRF-YYYYMMDD-XXX) |
| `transfer_date` | TEXT | NOT NULL | Tanggal transfer |
| `notes` | TEXT | - | Catatan (max 500 char) |
| `performed_by` | TEXT | FK → users | User yang melakukan transfer |
| `created_at` | TEXT | NOT NULL | Tanggal pembuatan |

### Tabel `stock_transfer_items`

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik item |
| `transfer_id` | TEXT | FK → stock_transfers | Relasi ke transfer |
| `product_id` | TEXT | FK → products | Produk yang ditransfer |
| `quantity` | INTEGER | NOT NULL | Jumlah yang dipindahkan (min 1) |
| `created_at` | TEXT | NOT NULL | Tanggal pembuatan |

---

## Alur Bisnis

```
┌─────────────────────────────────────────────────────────────┐
│  TRANSFER STOK (Gudang → Etalase)                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User membuat transfer baru                              │
│     └─ Input: transfer_date, notes, items[]               │
│         items[] = { product_id, quantity }                 │
│     └─ Auto: generate transfer_number (TRF-YYYYMMDD-XXX)  │
│     └─ Auto: record performed_by (user yang login)        │
│                                                             │
│  2. Validasi                                                │
│     └─ Product harus ada & aktif                           │
│     └─ Quantity > 0                                        │
│     └─ warehouse_stock >= quantity                         │
│     └─ Minimal 1 item, maksimal 50 items                  │
│                                                             │
│  3. Proses Transfer (Transaction)                           │
│     └─ Insert stock_transfers record                       │
│     └─ Insert stock_transfer_items records                 │
│     └─ Update inventory:                                   │
│        - warehouse_stock -= quantity                       │
│        - display_stock += quantity                         │
│        - last_stock_update = now                           │
│                                                             │
│  4. Result                                                  │
│     └─ Return transfer details + items + product info      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture (Best Practices)

```
src/modules/etalase/
├── index.ts          # HTTP routes & handlers (Hono)
├── service.ts        # Business logic (pure functions)
├── schema.ts         # Validation schemas (Zod)
└── types.ts          # TypeScript types & interfaces
```

### Pemisahan Concerns

**`service.ts`** - Business Logic
- Pure functions (tidak depend on HTTP context)
- Reusable (bisa dipakai di CLI, background jobs, etc.)
- Easy to test (no need to mock Hono)
- Transaction handling

**`index.ts`** - HTTP Layer
- Request/Response handling
- Validation parsing
- Error mapping to HTTP status codes
- Authentication/Authorization

**`schema.ts`** - Validation
- Zod schemas for runtime validation
- Type inference untuk TypeScript

**`types.ts`** - Type Definitions
- API request/response types
- Database types
- Error types

---

## API Endpoints

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| `POST` | `/api/etalase` | Create transfer | admin, cashier |
| `GET` | `/api/etalase` | List transfers | admin, cashier |
| `GET` | `/api/etalase/:id` | Detail transfer | admin, cashier |
| `GET` | `/api/etalase/:id/items` | List items | admin, cashier |
| `GET` | `/api/etalase/stats` | Stock statistics | all |
| `GET` | `/api/etalase/restock-suggestions` | Restock suggestions | admin, cashier |

---

## Request/Response Examples

### POST /api/etalase

**Request:**
```json
{
  "transferDate": "2026-02-19",
  "notes": "Restock etalase pagi",
  "items": [
    {
      "productId": "prod_1234567890_abc",
      "quantity": 20
    },
    {
      "productId": "prod_1234567890_def",
      "quantity": 15
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Transfer stok berhasil dibuat",
  "data": {
    "id": "trf_1234567890_abc",
    "transferNumber": "TRF-20260219-123",
    "transferDate": "2026-02-19",
    "notes": "Restock etalase pagi",
    "performedBy": "user_1234567890_xyz",
    "performedByUser": {
      "id": "user_1234567890_xyz",
      "username": "kasir1",
      "name": "Kasir Utama"
    },
    "createdAt": "2026-02-19T10:00:00.000Z",
    "items": [
      {
        "id": "trfi_1234567890_1",
        "productId": "prod_1234567890_abc",
        "quantity": 20,
        "createdAt": "2026-02-19T10:00:00.000Z",
        "product": {
          "id": "prod_1234567890_abc",
          "name": "Makanan Kucing A",
          "sku": "MKA001"
        }
      },
      {
        "id": "trfi_1234567890_2",
        "productId": "prod_1234567890_def",
        "quantity": 15,
        "createdAt": "2026-02-19T10:00:00.000Z",
        "product": {
          "id": "prod_1234567890_def",
          "name": "Makanan Anjing B",
          "sku": "MAB002"
        }
      }
    ]
  }
}
```

---

### GET /api/etalase/stats

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalProducts": 50,
    "totalWarehouseStock": 5000,
    "totalDisplayStock": 800,
    "lowStockProducts": 12,
    "outOfStockProducts": 5
  }
}
```

**Field Descriptions:**
- `totalProducts` - Total produk aktif
- `totalWarehouseStock` - Total stok di gudang
- `totalDisplayStock` - Total stok di etalase
- `lowStockProducts` - Produk dengan display_stock < 10
- `outOfStockProducts` - Produk dengan display_stock = 0

---

### GET /api/etalase/restock-suggestions

**Query Parameters:**
- `minWarehouseStock` (optional, default: 10) - Minimum stok gudang

**Response (200):**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "productId": "prod_1234567890_abc",
        "productName": "Makanan Kucing A",
        "sku": "MKA001",
        "warehouseStock": 100,
        "displayStock": 3,
        "suggestedQuantity": 17
      },
      {
        "productId": "prod_1234567890_def",
        "productName": "Makanan Anjing B",
        "sku": "MAB002",
        "warehouseStock": 50,
        "displayStock": 0,
        "suggestedQuantity": 20
      }
    ],
    "count": 2
  }
}
```

**Logic:**
- Hanya produk dengan `display_stock < 10` dan `warehouse_stock >= minWarehouseStock`
- `suggested_quantity` = min(20 - display_stock, warehouse_stock)
- Target display stock adalah 20 items per produk

---

## Validasi

### Create Transfer
```typescript
{
  transferDate?: string (ISO date, default: today),
  notes?: string (max 500),
  items: [
    {
      productId: string,
      quantity: number (min 1)
    }
  ] (min 1 item, max 50 items)
}
```

### Business Rules
1. **Stock Sufficiency** - warehouse_stock harus >= quantity
2. **Positive Quantity** - quantity minimal 1
3. **Active Products Only** - hanya produk aktif
4. **Audit Trail** - recorded performed_by
5. **Transfer Number Auto** - TRF-YYYYMMDD-XXX

---

## Error Handling

### Error Codes

| HTTP Status | Error Code | Deskripsi |
|-------------|------------|-----------|
| 400 | INSUFFICIENT_STOCK | Stok gudang tidak cukup |
| 400 | INVALID_PRODUCT | Product tidak valid (tidak ada/inactive) |
| 400 | VALIDATION_ERROR | Validasi input gagal |
| 404 | TRANSFER_NOT_FOUND | Transfer tidak ditemukan |
| 401 | - | Token tidak valid/expired |
| 403 | - | User tidak punya akses |
| 500 | - | Internal server error |

### Error Response Format
```json
{
  "success": false,
  "error": "Stok gudang tidak cukup untuk product prod_123. Diminta: 100, Tersedia: 50",
  "code": "INSUFFICIENT_STOCK"
}
```

---

## Testing

```bash
# Run semua test etalase
bun run test:etalase

# Atau run spesifik
bun test tests/etalase.test.ts
```

### Test Coverage
- ✅ Create transfer dengan 1 item (admin)
- ✅ Create transfer dengan multiple items (cashier)
- ✅ Create transfer dengan custom date
- ✅ Validasi quantity (min 1)
- ✅ Validasi items (min 1, max 50)
- ✅ Validasi stock sufficiency
- ✅ Validasi product exists & active
- ✅ Authentication & authorization
- ✅ List transfers dengan pagination
- ✅ Get transfer detail
- ✅ Get transfer items
- ✅ Get stock statistics
- ✅ Get restock suggestions

---

## Service Functions (Reusable)

### `createTransfer(input)`
```typescript
import { createTransfer } from './modules/etalase/service';

const transfer = await createTransfer({
  transferDate: "2026-02-19",
  notes: "Restock pagi",
  items: [
    { productId: "prod_123", quantity: 20 }
  ],
  performedBy: "user_456"
});
```

### `getTransferById(id)`
```typescript
import { getTransferById } from './modules/etalase/service';

const transfer = await getTransferById("trf_123");
```

### `getTransfers(filters)`
```typescript
import { getTransfers } from './modules/etalase/service';

const result = await getTransfers({
  startDate: "2026-02-01",
  endDate: "2026-02-28",
  page: 1,
  limit: 20
});
```

### `getStockStats()`
```typescript
import { getStockStats } from './modules/etalase/service';

const stats = await getStockStats();
// { totalProducts, totalWarehouseStock, totalDisplayStock, ... }
```

### `getRestockSuggestions(minWarehouseStock)`
```typescript
import { getRestockSuggestions } from './modules/etalase/service';

const suggestions = await getRestockSuggestions(20);
```

---

## Future Improvements

1. **Batch Transfer** - Support bulk transfer dari CSV/Excel
2. **Scheduled Transfer** - Auto-transfer terjadwal untuk produk fast-moving
3. **Transfer Approval** - Workflow approval untuk transfer besar
4. **Stock Alert** - Notifikasi otomatis saat display stock rendah
5. **Transfer History Analytics** - Dashboard untuk analisis pola transfer
