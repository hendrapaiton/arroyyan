# Modul Dashboard - Dokumentasi

## Overview

Modul Dashboard menyediakan **satu endpoint untuk analytics & reporting** yang menampilkan total penjualan, stok menipis, dan daftar transaksi.

---

## API Endpoint

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| `GET` | `/api/dashboard` | Dashboard data dengan filter period | All authenticated |

---

## GET /api/dashboard

**Query Parameters:**
- `period` (optional) - `daily` | `weekly` | `monthly` (default: `daily`)
  - `daily` = Hari ini (dari tengah malam sampai sekarang)
  - `weekly` = Minggu ini (dari Senin sampai sekarang)
  - `monthly` = Bulan ini (dari tanggal 1 sampai sekarang)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": "daily",
    "startDate": "2026-02-20",
    "endDate": "2026-02-20",
    "totalRevenue": 750000,
    "lowStockCount": 5,
    "transactions": [
      {
        "id": "sale_123",
        "saleNumber": "INV-20260220-123",
        "saleDate": "2026-02-20",
        "totalAmount": 45000,
        "paymentMethod": "cash",
        "cashierName": "Kasir Utama",
        "itemCount": 3,
        "createdAt": "2026-02-20T10:30:00.000Z"
      },
      {
        "id": "sale_124",
        "saleNumber": "INV-20260220-124",
        "saleDate": "2026-02-20",
        "totalAmount": 120000,
        "paymentMethod": "qris",
        "cashierName": "Kasir Utama",
        "itemCount": 5,
        "createdAt": "2026-02-20T11:15:00.000Z"
      }
    ]
  }
}
```

---

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `period` | string | Period yang dipilih (`daily`, `weekly`, `monthly`) |
| `startDate` | string | Tanggal mulai periode (YYYY-MM-DD) |
| `endDate` | string | Tanggal akhir periode (YYYY-MM-DD) |
| `totalRevenue` | number | **Total nominal penjualan** dalam periode |
| `lowStockCount` | number | **Jumlah item produk dengan stok menipis** (< 10) |
| `transactions` | array[] | **Daftar transaksi penjualan** (max 20) |

### Transaction Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | ID transaksi |
| `saleNumber` | string | **Nomor referensi transaksi** (INV-YYYYMMDD-XXX) |
| `saleDate` | string | Tanggal transaksi (YYYY-MM-DD) |
| `totalAmount` | number | Total nominal transaksi |
| `paymentMethod` | string | Metode pembayaran (`cash` atau `qris`) |
| `cashierName` | string | Nama kasir yang melayani |
| `itemCount` | number | Jumlah item dalam transaksi |
| `createdAt` | string | Timestamp pembuatan transaksi |

---

## Period Logic

| Period | Start Date | End Date |
|--------|------------|----------|
| `daily` | Hari ini (00:00) | Sekarang |
| `weekly` | Senin minggu ini (00:00) | Sekarang |
| `monthly` | Tanggal 1 bulan ini (00:00) | Sekarang |

**Contoh:**
- Hari ini = Kamis, 20 Februari 2026
  - `daily`: 2026-02-20 → 2026-02-20
  - `weekly`: 2026-02-16 (Senin) → 2026-02-20
  - `monthly`: 2026-02-01 → 2026-02-20

---

## Data Filtering

| Data | Filtered by Period |
|------|-------------------|
| `totalRevenue` | ✅ Ya - Hanya penjualan dalam periode |
| `transactions` | ✅ Ya - Hanya transaksi dalam periode |
| `lowStockCount` | ❌ Tidak - Selalu menampilkan kondisi stok terkini |

---

## Low Stock Threshold

Produk dianggap **stok menipis** jika:
- `totalStock = warehouseStock + displayStock < 10`
- Hanya produk aktif yang dihitung

---

## Examples

### 1. Dashboard Hari Ini (Default)
```bash
GET /api/dashboard
```

### 2. Dashboard Mingguan
```bash
GET /api/dashboard?period=weekly
```

### 3. Dashboard Bulanan
```bash
GET /api/dashboard?period=monthly
```

---

## Frontend Integration Example

```typescript
// React hook untuk dashboard data
function useDashboard(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(response => {
        setData(response.data);
        setLoading(false);
      });
  }, [period]);

  return { data, loading };
}

// Usage
const { data } = useDashboard('daily');

// Access dashboard metrics
console.log(data.totalRevenue);      // Total penjualan hari ini
console.log(data.lowStockCount);     // Jumlah item stok menipis
console.log(data.transactions);      // Daftar transaksi

// Render transaction list
data.transactions.forEach(tx => {
  console.log(`${tx.saleNumber}: Rp ${tx.totalAmount}`);
});
```

---

## Error Handling

| HTTP Status | Error | Deskripsi |
|-------------|-------|-----------|
| 400 | Invalid query parameters | Period tidak valid |
| 401 | Unauthorized | Token tidak valid atau tidak ada |
| 500 | Server error | Internal server error |

**Example 400 Response:**
```json
{
  "success": false,
  "error": "Invalid query parameters",
  "details": {
    "fieldErrors": {
      "period": ["Invalid enum value. Expected 'daily' | 'weekly' | 'monthly'"]
    }
  }
}
```

---

## Service Functions

### `getDashboardData(period)`
```typescript
import { getDashboardData } from './modules/dashboard/service';

const data = await getDashboardData('daily');
// Returns: { period, startDate, endDate, totalRevenue, lowStockCount, transactions }
```

### `getTotalRevenue(startDate, endDate)`
```typescript
import { getTotalRevenue } from './modules/dashboard/service';

const revenue = await getTotalRevenue("2026-02-01", "2026-02-28");
```

### `getLowStockCount(threshold)`
```typescript
import { getLowStockCount } from './modules/dashboard/service';

const count = await getLowStockCount(10); // threshold = 10
```

### `getTransactions(startDate, endDate, limit)`
```typescript
import { getTransactions } from './modules/dashboard/service';

const transactions = await getTransactions("2026-02-01", "2026-02-28", 20);
```

---

## Performance Notes

- **Caching** - Response bisa di-cache untuk 1-5 menit
- **Pagination** - Transactions limited to 20 items
- **Indexing** - Pastikan index pada `sale_date` untuk query cepat
- **Real-time** - Data real-time dari database

---

## Use Cases

### 1. Main Dashboard Page
Tampilkan:
- **Total Revenue** - Penjualan hari ini/minggu ini/bulan ini
- **Low Stock Alert** - Badge dengan jumlah item stok menipis
- **Transaction List** - Tabel riwayat transaksi dengan nomor referensi

### 2. Period Switching
User bisa toggle antara daily/weekly/monthly untuk melihat performa penjualan di periode berbeda.

### 3. Transaction Lookup
Gunakan `saleNumber` (nomor referensi) untuk mencari transaksi spesifik atau lookup detail.
