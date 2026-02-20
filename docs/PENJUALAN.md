# Modul Penjualan (Point of Sale) - Dokumentasi

## Overview

Modul Penjualan mengelola **transaksi kasir** untuk menjual barang dari etalase ke customer. Setiap transaksi akan mengurangi stok etalase secara otomatis.

### Fitur Utama
- ✅ Create transaksi penjualan (cash/QRIS)
- ✅ Auto-calculate total & change amount
- ✅ Auto-update display_stock (etalase)
- ✅ Audit trail (cashier yang transaksi)
- ✅ Sales statistics & analytics
- ✅ Today's summary dashboard
- ✅ Top products tracking

---

## Database Schema

### Tabel `sales` (Transaksi Penjualan)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik transaksi |
| `sale_number` | TEXT | UNIQUE NOT NULL | Nomor invoice (INV-YYYYMMDD-XXX) |
| `sale_date` | TEXT | NOT NULL | Tanggal transaksi |
| `reference_number` | TEXT | - | Nomor referensi eksternal |
| `total_amount` | REAL | DEFAULT 0 | Total penjualan |
| `payment_method` | TEXT | NOT NULL | `cash` atau `qris` |
| `paid_amount` | REAL | NOT NULL | Jumlah yang dibayar |
| `change_amount` | REAL | DEFAULT 0 | Kembalian |
| `notes` | TEXT | - | Catatan transaksi |
| `cashier_id` | TEXT | FK → users | Kasir yang transaksi |
| `created_at` | TEXT | NOT NULL | Tanggal pembuatan |
| `updated_at` | TEXT | NOT NULL | Tanggal update terakhir |

### Tabel `sale_items` (Item Penjualan)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik item |
| `sale_id` | TEXT | FK → sales | Relasi ke transaksi |
| `product_id` | TEXT | FK → products | Produk yang dijual |
| `quantity` | INTEGER | NOT NULL | Jumlah yang dijual |
| `unit_price` | REAL | NOT NULL | Harga jual satuan (saat transaksi) |
| `subtotal` | REAL | NOT NULL | quantity × unit_price |
| `created_at` | TEXT | NOT NULL | Tanggal pembuatan |

---

## Alur Bisnis

```
┌─────────────────────────────────────────────────────────────┐
│  PENJUALAN (Point of Sale)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Customer memilih barang dari etalase                    │
│                                                             │
│  2. Kasir create transaksi baru                             │
│     └─ Input: items[], payment_method, paid_amount        │
│         items[] = { product_id, quantity }                 │
│     └─ Auto: generate sale_number (INV-YYYYMMDD-XXX)      │
│     └─ Auto: calculate total_amount (from product prices) │
│     └─ Auto: calculate change_amount                      │
│     └─ Auto: record cashier_id (user yang login)          │
│                                                             │
│  3. Validasi                                                │
│     └─ Product harus ada & aktif                           │
│     └─ Quantity > 0                                        │
│     └─ display_stock >= quantity                           │
│     └─ payment_method valid (cash/qris)                    │
│     └─ paid_amount >= total_amount                         │
│                                                             │
│  4. Proses Transaksi (Transaction)                          │
│     └─ Insert sales record                                 │
│     └─ Insert sale_items records                           │
│     └─ Update inventory:                                   │
│        - display_stock -= quantity                         │
│        - last_stock_update = now                           │
│                                                             │
│  5. Result                                                  │
│     └─ Return sale details + items + product info          │
│     └─ Print receipt (client-side)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
src/modules/penjualan/
├── index.ts          # HTTP routes & handlers (Hono)
├── service.ts        # Business logic (pure functions)
├── schema.ts         # Validation schemas (Zod)
└── types.ts          # TypeScript types & interfaces
```

### Separation of Concerns

**`service.ts`** - Business Logic
- Pure functions (no HTTP dependency)
- Transaction handling
- Reusable (CLI, background jobs)
- Easy to test

**`index.ts`** - HTTP Layer
- Request/Response handling
- Validation parsing
- Error mapping
- Authentication

---

## API Endpoints

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| `POST` | `/api/penjualan` | Create transaksi | admin, cashier |
| `GET` | `/api/penjualan` | List penjualan | admin, cashier |
| `GET` | `/api/penjualan/:id` | Detail transaksi | admin, cashier |
| `GET` | `/api/penjualan/:id/items` | List items | admin, cashier |
| `GET` | `/api/penjualan/stats` | Statistik penjualan | admin |
| `GET` | `/api/penjualan/today` | Summary hari ini | admin, cashier |
| `GET` | `/api/penjualan/cashier/:id` | Sales by cashier | admin |

---

## Request/Response Examples

### POST /api/penjualan

**Request:**
```json
{
  "saleDate": "2026-02-19",
  "referenceNumber": "CUST-001",
  "notes": "Customer regular",
  "paymentMethod": "cash",
  "paidAmount": 100000,
  "items": [
    {
      "productId": "prod_1234567890_abc",
      "quantity": 2
    },
    {
      "productId": "prod_1234567890_def",
      "quantity": 1
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Transaksi penjualan berhasil dibuat",
  "data": {
    "id": "sale_1234567890_abc",
    "saleNumber": "INV-20260219-123",
    "saleDate": "2026-02-19",
    "referenceNumber": "CUST-001",
    "totalAmount": 45000,
    "paymentMethod": "cash",
    "paidAmount": 100000,
    "changeAmount": 55000,
    "notes": "Customer regular",
    "cashierId": "user_1234567890_xyz",
    "cashier": {
      "id": "user_1234567890_xyz",
      "username": "kasir1",
      "name": "Kasir Utama"
    },
    "createdAt": "2026-02-19T10:00:00.000Z",
    "updatedAt": "2026-02-19T10:00:00.000Z",
    "items": [
      {
        "id": "salei_1234567890_1",
        "productId": "prod_1234567890_abc",
        "quantity": 2,
        "unitPrice": 15000,
        "subtotal": 30000,
        "product": {
          "id": "prod_1234567890_abc",
          "name": "Makanan Kucing A",
          "sku": "MKA001",
          "sellingPrice": 15000
        }
      },
      {
        "id": "salei_1234567890_2",
        "productId": "prod_1234567890_def",
        "quantity": 1,
        "unitPrice": 15000,
        "subtotal": 15000,
        "product": {
          "id": "prod_1234567890_def",
          "name": "Makanan Anjing B",
          "sku": "MAB002",
          "sellingPrice": 15000
        }
      }
    ]
  }
}
```

**Auto-calculated Fields:**
- `totalAmount` = Σ(quantity × product.sellingPrice)
- `changeAmount` = paidAmount - totalAmount
- `saleNumber` = Auto-generated (INV-YYYYMMDD-XXX)

---

### GET /api/penjualan/stats

**Query Parameters:**
- `startDate` (optional) - Filter start date
- `endDate` (optional) - Filter end date

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalTransactions": 50,
    "totalRevenue": 2500000,
    "totalItemsSold": 180,
    "averageTransactionValue": 50000,
    "cashTransactions": 30,
    "qrisTransactions": 20,
    "topProducts": [
      {
        "productId": "prod_123",
        "productName": "Makanan Kucing A",
        "sku": "MKA001",
        "quantitySold": 50,
        "revenue": 750000
      },
      {
        "productId": "prod_456",
        "productName": "Makanan Anjing B",
        "sku": "MAB002",
        "quantitySold": 30,
        "revenue": 450000
      }
    ]
  }
}
```

---

### GET /api/penjualan/today

**Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2026-02-19",
    "totalTransactions": 15,
    "totalRevenue": 750000,
    "totalItemsSold": 50,
    "cashRevenue": 450000,
    "qrisRevenue": 300000,
    "openingStock": 500,
    "closingStock": 450,
    "stockMoved": 50
  }
}
```

**Field Descriptions:**
- `openingStock` - Total display stock di awal hari
- `closingStock` - Total display stock saat ini
- `stockMoved` - Total items terjual hari ini

---

## Validasi

### Create Sale
```typescript
{
  saleDate?: string (ISO date, default: today),
  referenceNumber?: string (max 50),
  notes?: string (max 500),
  paymentMethod: 'cash' | 'qris',
  paidAmount: number (min total_amount),
  items: [
    {
      productId: string,
      quantity: number (min 1)
    }
  ] (min 1 item, max 100 items)
}
```

### Business Rules
1. **Stock Sufficiency** - display_stock harus >= quantity
2. **Positive Quantity** - quantity minimal 1
3. **Active Products Only** - hanya produk aktif
4. **Payment Validation** - paidAmount >= totalAmount
5. **Auto Calculate** - totalAmount, changeAmount
6. **Audit Trail** - recorded cashier_id
7. **Sale Number Auto** - INV-YYYYMMDD-XXX
8. **Price Snapshot** - unitPrice disimpan (tidak berubah walau harga produk berubah)

---

## Error Handling

### Error Codes

| HTTP Status | Error Code | Deskripsi |
|-------------|------------|-----------|
| 400 | INSUFFICIENT_STOCK | Stok etalase tidak cukup |
| 400 | INVALID_PRODUCT | Product tidak valid |
| 400 | PAYMENT_ERROR | Pembayaran kurang/tidak valid |
| 400 | VALIDATION_ERROR | Validasi input gagal |
| 404 | SALE_NOT_FOUND | Transaksi tidak ditemukan |
| 401 | - | Token tidak valid/expired |
| 403 | - | User tidak punya akses |
| 500 | - | Internal server error |

### Error Response Format
```json
{
  "success": false,
  "error": "Stok etalase tidak cukup untuk product prod_123. Diminta: 10, Tersedia: 5",
  "code": "INSUFFICIENT_STOCK"
}
```

---

## Service Functions (Reusable)

### `createSale(input)`
```typescript
import { createSale } from './modules/penjualan/service';

const sale = await createSale({
  paymentMethod: "cash",
  paidAmount: 100000,
  items: [
    { productId: "prod_123", quantity: 2 }
  ],
  cashierId: "user_456"
});
```

### `getSaleById(id)`
```typescript
import { getSaleById } from './modules/penjualan/service';

const sale = await getSaleById("sale_123");
```

### `getSales(filters)`
```typescript
import { getSales } from './modules/penjualan/service';

const result = await getSales({
  startDate: "2026-02-01",
  endDate: "2026-02-28",
  paymentMethod: "cash",
  page: 1,
  limit: 20
});
```

### `getSalesStats(startDate, endDate)`
```typescript
import { getSalesStats } from './modules/penjualan/service';

const stats = await getSalesStats("2026-02-01", "2026-02-28");
```

### `getTodaySummary()`
```typescript
import { getTodaySummary } from './modules/penjualan/service';

const summary = await getTodaySummary();
```

### `getSalesByCashier(cashierId, startDate, endDate)`
```typescript
import { getSalesByCashier } from './modules/penjualan/service';

const result = await getSalesByCashier(
  "user_456",
  "2026-02-01",
  "2026-02-28"
);
```

---

## Testing

```bash
# Run semua test penjualan
bun run test:penjualan

# Atau run spesifik
bun test tests/penjualan.test.ts
```

### Test Coverage
- ✅ Create sale dengan payment cash (admin)
- ✅ Create sale dengan kembalian (cashier)
- ✅ Create sale dengan payment QRIS
- ✅ Create sale dengan multiple items
- ✅ Validasi display_stock sufficiency
- ✅ Validasi quantity (min 1)
- ✅ Validasi items (min 1, max 100)
- ✅ Validasi payment amount
- ✅ Validasi payment method
- ✅ Authentication & authorization
- ✅ List sales dengan pagination
- ✅ Filter by payment method
- ✅ Get sale detail
- ✅ Get today summary
- ✅ Get sales statistics
- ✅ Top products tracking

---

## Integration Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Produk    │────▶│   Pasokan   │────▶│   Etalase   │
│  (Master)   │     │  (Gudang+)  │     │ (Transfer)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Penjualan  │
                                        │   (POS)     │
                                        └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Display -  │
                                        │   Revenue + │
                                        └─────────────┘
```

**Complete Business Flow:**
1. **Produk** - Create master product dengan harga jual
2. **Pasokan** - Terima barang dari supplier → warehouse_stock +
3. **Etalase** - Transfer gudang → etalase → display_stock +
4. **Penjualan** - Jual barang → display_stock -, revenue +

---

## Future Improvements

1. **Receipt Printing** - Generate PDF receipt untuk customer
2. **Customer Management** - Track customer purchases & loyalty
3. **Returns/Refunds** - Handle product returns
4. **Discount System** - Support promo codes & discounts
5. **Multi-payment** - Split payment (partial cash, partial QRIS)
6. **Hold Transaction** - Parkir transaksi sementara
7. **Offline Mode** - Queue transactions when offline
8. **Sales Analytics** - Advanced dashboard & reporting
