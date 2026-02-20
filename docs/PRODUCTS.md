# Products Module

The products module manages product inventory in the petshop system.

## Database Schema

### Product Table
| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key (nanoid) |
| name | text | Product name |
| description | text | Product description |
| sku | text | Unique SKU code |
| category | text | Category (food, toys, accessories, etc.) |
| price | real | Selling price |
| cost | real | Cost price (for profit calculation) |
| stock | integer | Current stock quantity |
| minStock | integer | Reorder point (low stock threshold) |
| unit | text | Unit of measurement (kg, pcs, pack) |
| photoUrl | text | Product photo URL |
| isActive | boolean | Active status (soft delete) |
| createdAt | timestamp | Creation date |
| updatedAt | timestamp | Last update date |

## API Endpoints

All product endpoints require authentication via Bearer token.

### GET /api/products

Get all products with optional filters.

**Query Parameters:**
- `category` - Filter by category
- `lowStock` - Filter for low stock items (true/false)

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_abc123",
      "name": "Dog Food Premium",
      "description": "High-quality dog food",
      "sku": "DF-001",
      "category": "food",
      "price": 150000,
      "cost": 100000,
      "stock": 50,
      "minStock": 10,
      "unit": "kg",
      "isActive": true,
      "createdAt": "2026-02-20T00:00:00.000Z",
      "updatedAt": "2026-02-20T00:00:00.000Z"
    }
  ]
}
```

### GET /api/products/low-stock

Get products with stock below minimum threshold.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_xyz789",
      "name": "Cat Litter",
      "sku": "CL-001",
      "stock": 3,
      "minStock": 10
    }
  ]
}
```

### GET /api/products/:id

Get a single product by ID.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "prod_abc123",
    "name": "Dog Food Premium",
    "sku": "DF-001",
    "price": 150000,
    "stock": 50
  }
}
```

### POST /api/products

Create a new product.

**Headers:**
```
Authorization: Bearer <session_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Dog Food Premium",
  "description": "High-quality dog food for adult dogs",
  "sku": "DF-001",
  "category": "food",
  "price": 150000,
  "cost": 100000,
  "stock": 50,
  "minStock": 10,
  "unit": "kg"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": "prod_abc123",
    "name": "Dog Food Premium",
    "sku": "DF-001",
    "price": 150000,
    "stock": 50,
    "isActive": true
  }
}
```

### PATCH /api/products/:id

Update an existing product.

**Headers:**
```
Authorization: Bearer <session_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "price": 160000,
  "stock": 45
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "id": "prod_abc123",
    "name": "Dog Food Premium",
    "price": 160000,
    "stock": 45
  }
}
```

### DELETE /api/products/:id

Delete a product (soft delete - sets isActive to false).

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

## Features

### Low Stock Alert

Products with `stock < minStock` are considered low stock. Use the `/api/products/low-stock` endpoint to get these products for reordering.

### Soft Delete

Products are not physically deleted from the database. Instead, `isActive` is set to `false` to maintain historical sales data integrity.

### Profit Calculation

Profit margin can be calculated as: `profit = price - cost`

## Usage Example

```typescript
// Create a product
const response = await fetch('/api/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  },
  body: JSON.stringify({
    name: 'Premium Cat Food',
    sku: 'PCF-001',
    category: 'food',
    price: 75000,
    cost: 50000,
    stock: 100,
    minStock: 20,
    unit: 'kg'
  })
});

// Get low stock products
const lowStock = await fetch('/api/products/low-stock', {
  headers: {
    'Authorization': `Bearer ${sessionToken}`
  }
});
```

## Related Modules

- [Sales](./SALES.md) - Record product sales
- [Customers](./CUSTOMERS.md) - Sell products to customers
