# Modul Produk - Dokumentasi

## Database Schema

### Tabel `products` (tabel utama)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik produk |
| `name` | TEXT | NOT NULL | Nama produk |
| `sku` | TEXT | UNIQUE NOT NULL | Kode unik produk, max 7 char alphanumeric |
| `selling_price` | REAL | NOT NULL | Harga jual, min. 1000 |
| `is_active` | BOOLEAN | DEFAULT true | Status produk (aktif/non-aktif) |
| `created_at` | TEXT | NOT NULL | Tanggal pembuatan |
| `updated_at` | TEXT | NOT NULL | Tanggal update terakhir |

### Tabel `inventory` (tracking stok)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik inventory |
| `product_id` | TEXT | FK → products | Relasi ke produk (1:1) |
| `warehouse_stock` | INTEGER | DEFAULT 0 | Stok di gudang |
| `display_stock` | INTEGER | DEFAULT 0 | Stok di etalase |
| `last_stock_update` | TEXT | NOT NULL | Tanggal update stok terakhir |
| `created_at` | TEXT | NOT NULL | Tanggal pembuatan |
| `updated_at` | TEXT | NOT NULL | Tanggal update terakhir |

---

## Alur Bisnis

```
┌─────────────────────────────────────────────────────────────┐
│  PRODUK (Master Data)                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CREATE produk baru                                      │
│     └─ Input: nama, sku, harga_jual                        │
│     └─ Auto: is_active=true, created_at, updated_at        │
│     └─ Trigger: Buat record inventory (warehouse=0, display=0)
│                                                             │
│  2. READ daftar produk                                      │
│     └─ List semua produk + stok (gudang & etalase)         │
│     └─ Filter: active/inactive, search by nama/sku         │
│                                                             │
│  3. UPDATE produk                                           │
│     └─ Update: nama, harga_jual                            │
│     └─ Tidak bisa update stok langsung (harus via pasokan/etalase)
│                                                             │
│  4. DELETE (soft) produk                                    │
│     └─ Set is_active=false                                 │
│     └─ Tidak bisa delete kalau masih ada stok              │
│                                                             │
│  5. VALIDASI                                                │
│     └─ SKU harus unik, max 7 karakter alphanumeric         │
│     └─ Harga jual >= 1000                                  │
│     └─ Stok etalase = 0 sebelum non-aktifkan produk        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/produk` | Buat produk baru |
| `GET` | `/api/produk` | List semua produk |
| `GET` | `/api/produk/:id` | Detail produk |
| `PUT` | `/api/produk/:id` | Update produk |
| `DELETE` | `/api/produk/:id` | Soft delete produk |
| `GET` | `/api/produk/:id/stok` | Cek stok produk |

---

## Validasi (Zod Schema)

### Create Product

```typescript
{
  name: string (min 3, max 100),
  sku: string (uppercase alphanumeric, max 7 char),
  sellingPrice: number (min 1000)
}
```

### Update Product

```typescript
{
  name?: string,
  sellingPrice?: number (min 1000)
}
```

**Catatan:** SKU tidak bisa diubah setelah produk dibuat.

---

## Business Rules

1. **SKU Unik** - Setiap produk harus memiliki SKU yang unik (case-insensitive)
2. **Harga Minimum** - Harga jual minimal Rp 1.000
3. **Stok Awal** - Produk baru otomatis memiliki record inventory dengan stok 0
4. **Soft Delete** - Produk tidak dihapus permanen, hanya di-set `is_active = false`
5. **Stok Harus Kosong** - Tidak bisa non-aktifkan produk jika masih ada stok di etalase
6. **Stok Read-Only** - Stok tidak bisa diubah langsung via modul produk, harus melalui:
   - Modul Pasokan (tambah stok gudang)
   - Modul Etalase (pindah gudang → etalase)
   - Modul Penjualan (kurangi stok etalase)
