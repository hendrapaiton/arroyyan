# Modul Pasokan - Dokumentasi

## Database Schema

### Tabel `suppliers` (Supplier/Pemasok)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik supplier |
| `name` | TEXT | NOT NULL | Nama supplier (3-100 char) |
| `contact_person` | TEXT | - | Nama kontak person (max 50 char) |
| `phone` | TEXT | - | Nomor telepon (max 20 char) |
| `address` | TEXT | - | Alamat (max 100 char) |
| `is_active` | BOOLEAN | DEFAULT true | Status aktif supplier |
| `created_at` | TEXT | NOT NULL | Tanggal pembuatan |
| `updated_at` | TEXT | NOT NULL | Tanggal update terakhir |

### Tabel `supply_orders` (Pesanan Pasokan)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik pasokan |
| `order_number` | TEXT | UNIQUE NOT NULL | Nomor referensi (SUP-YYYYMMDD-XXX) |
| `supplier_id` | TEXT | FK → suppliers | Supplier yang mengirim |
| `order_date` | TEXT | NOT NULL | tanggal penerimaan |
| `total_amount` | REAL | DEFAULT 0 | Total nilai pembelian |
| `notes` | TEXT | - | Catatan (max 500 char) |
| `created_at` | TEXT | NOT NULL | Tanggal pembuatan |
| `updated_at` | TEXT | NOT NULL | Tanggal update terakhir |

### Tabel `supply_order_items` (Item Pasokan)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|------------|-----------|
| `id` | TEXT | PRIMARY KEY | ID unik item |
| `supply_order_id` | TEXT | FK → supply_orders | Relasi ke supply order |
| `product_id` | TEXT | FK → products | Produk yang diterima |
| `quantity` | INTEGER | NOT NULL | Jumlah barang (min 1) |
| `purchase_price` | REAL | NOT NULL | Harga beli satuan (min 1000) |
| `subtotal` | REAL | NOT NULL | quantity × purchase_price |
| `created_at` | TEXT | NOT NULL | Tanggal pembuatan |

---

## Alur Bisnis

### 1. Create Supplier
```
Input: { name, contactPerson?, phone?, address? }
→ Validasi: name (3-100 char)
→ Insert ke tabel suppliers
→ Auto: is_active = true
```

### 2. Create Pasokan Masuk
```
Input: { supplierId, orderDate?, notes?, items[] }
items[] = [{ productId, quantity, purchasePrice }]

Langkah:
1. Validasi supplier aktif
2. Validasi semua produk aktif
3. Validasi quantity > 0, purchasePrice >= 1000
4. Generate order_number (SUP-YYYYMMDD-XXX)
5. Calculate total_amount = Σ(quantity × purchasePrice)
6. Insert ke supply_orders
7. Insert ke supply_order_items
8. Update inventory.warehouse_stock += quantity
```

---

## API Endpoints

### Suppliers

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| `POST` | `/api/pasokan/suppliers` | Create supplier | admin |
| `GET` | `/api/pasokan/suppliers` | List suppliers | all |
| `GET` | `/api/pasokan/suppliers/:id` | Detail supplier | all |
| `PUT` | `/api/pasokan/suppliers/:id` | Update supplier | admin |
| `DELETE` | `/api/pasokan/suppliers/:id` | Soft delete supplier | admin |

### Supply Orders

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| `POST` | `/api/pasokan/orders` | Create pasokan masuk | admin |
| `GET` | `/api/pasokan/orders` | List pasokan | all |
| `GET` | `/api/pasokan/orders/:id` | Detail pasokan + items | all |
| `GET` | `/api/pasokan/orders/:id/items` | List items pasokan | all |

---

## Request/Response Examples

### POST /api/pasokan/suppliers

**Request:**
```json
{
  "name": "PT Supplier Makmur",
  "contactPerson": "Budi Santoso",
  "phone": "081234567890",
  "address": "Jl. Raya Utama No. 123"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Supplier berhasil dibuat",
  "data": {
    "id": "supp_1234567890_abc",
    "name": "PT Supplier Makmur",
    "contactPerson": "Budi Santoso",
    "phone": "081234567890",
    "address": "Jl. Raya Utama No. 123",
    "isActive": true,
    "createdAt": "2026-02-19T10:00:00.000Z",
    "updatedAt": "2026-02-19T10:00:00.000Z"
  }
}
```

---

### POST /api/pasokan/orders

**Request:**
```json
{
  "supplierId": "supp_1234567890_abc",
  "orderDate": "2026-02-19",
  "notes": "Pengiriman pertama",
  "items": [
    {
      "productId": "prod_1234567890_xyz",
      "quantity": 100,
      "purchasePrice": 10000
    },
    {
      "productId": "prod_1234567890_def",
      "quantity": 50,
      "purchasePrice": 15000
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Pasokan berhasil dibuat",
  "data": {
    "id": "supo_1234567890_abc",
    "orderNumber": "SUP-20260219-123",
    "supplierId": "supp_1234567890_abc",
    "orderDate": "2026-02-19",
    "totalAmount": 1750000,
    "notes": "Pengiriman pertama",
    "createdAt": "2026-02-19T10:00:00.000Z",
    "updatedAt": "2026-02-19T10:00:00.000Z",
    "supplier": {
      "id": "supp_1234567890_abc",
      "name": "PT Supplier Makmur"
    },
    "items": [
      {
        "id": "supi_1234567890_1",
        "productId": "prod_1234567890_xyz",
        "quantity": 100,
        "purchasePrice": 10000,
        "subtotal": 1000000,
        "product": {
          "id": "prod_1234567890_xyz",
          "name": "Makanan Kucing A",
          "sku": "MKA001"
        }
      },
      {
        "id": "supi_1234567890_2",
        "productId": "prod_1234567890_def",
        "quantity": 50,
        "purchasePrice": 15000,
        "subtotal": 750000,
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

## Validasi

### Create Supplier
```typescript
{
  name: string (min 3, max 100),
  contactPerson?: string (max 50),
  phone?: string (max 20),
  address?: string (max 100)
}
```

### Create Supply Order
```typescript
{
  supplierId: string,
  orderDate?: string (ISO date, default: today),
  notes?: string (max 500),
  items: [
    {
      productId: string,
      quantity: number (min 1),
      purchasePrice: number (min 1000)
    }
  ] (min 1 item)
}
```

---

## Business Rules

1. **Supplier Aktif** - Hanya supplier aktif yang bisa menerima pasokan
2. **Produk Aktif** - Hanya produk aktif yang bisa diterima
3. **Harga Minimum** - purchasePrice minimal Rp 1.000
4. **Quantity Positif** - quantity minimal 1
5. **Auto Update Stok** - warehouse_stock otomatis bertambah saat pasokan dibuat
6. **Order Number Auto** - Format: SUP-YYYYMMDD-XXX (auto-generated)
7. **Total Amount Auto** - Dihitung dari Σ(quantity × purchasePrice)
8. **Supplier Delete Protection** - Tidak bisa delete supplier yang masih punya riwayat pasokan

---

## Testing

```bash
# Run semua test pasokan
bun run test:pasokan

# Atau run spesifik
bun test tests/pasokan.test.ts
```

Test coverage:
- ✅ Create supplier dengan data valid
- ✅ Create supplier dengan data minimal
- ✅ Validasi input supplier
- ✅ List suppliers dengan filter
- ✅ Detail supplier
- ✅ Update supplier
- ✅ Create pasokan dengan 1 item
- ✅ Create pasokan dengan multiple items
- ✅ Auto update warehouse_stock
- ✅ Validasi supplier aktif
- ✅ Validasi produk aktif
- ✅ Validasi purchasePrice min 1000
- ✅ Validasi quantity min 1
- ✅ List pasokan dengan filter
- ✅ Detail pasokan + items
