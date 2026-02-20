# Customers Module

The customers module manages customer/pet owner information in the petshop system.

## Database Schema

### Customer Table
| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key (nanoid) |
| userId | text | Reference to user.id (cascade delete) |
| name | text | Customer name |
| email | text | Unique email address |
| phone | text | Phone number |
| address | text | Optional address |
| notes | text | Additional notes |
| createdAt | timestamp | Creation date |
| updatedAt | timestamp | Last update date |

## API Endpoints

All customer endpoints require authentication via Bearer token.

### GET /api/customers

Get all customers for the current user.

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
      "id": "cust_abc123",
      "userId": "user_xyz789",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "08123456789",
      "address": "Jl. Example No. 123",
      "notes": null,
      "createdAt": "2026-02-20T00:00:00.000Z",
      "updatedAt": "2026-02-20T00:00:00.000Z"
    }
  ]
}
```

### GET /api/customers/:id

Get a single customer by ID with their pets.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "cust_abc123",
    "userId": "user_xyz789",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "08123456789",
    "address": "Jl. Example No. 123",
    "pets": [
      {
        "id": "pet_001",
        "name": "Buddy",
        "species": "dog",
        "breed": "Golden Retriever"
      }
    ]
  }
}
```

### POST /api/customers

Create a new customer.

**Headers:**
```
Authorization: Bearer <session_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "08123456789",
  "address": "Jl. Example No. 123",
  "notes": "VIP customer"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "id": "cust_abc123",
    "userId": "user_xyz789",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "08123456789",
    "address": "Jl. Example No. 123",
    "notes": "VIP customer",
    "createdAt": "2026-02-20T00:00:00.000Z",
    "updatedAt": "2026-02-20T00:00:00.000Z"
  }
}
```

### PATCH /api/customers/:id

Update an existing customer.

**Headers:**
```
Authorization: Bearer <session_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe Jr.",
  "phone": "08198765432"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Customer updated successfully",
  "data": {
    "id": "cust_abc123",
    "name": "John Doe Jr.",
    "email": "john@example.com",
    "phone": "08198765432",
    "updatedAt": "2026-02-20T01:00:00.000Z"
  }
}
```

### DELETE /api/customers/:id

Delete a customer.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Customer deleted successfully"
}
```

## Usage Example

```typescript
// Create a customer
const response = await fetch('/api/customers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  },
  body: JSON.stringify({
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '08123456789'
  })
});

const data = await response.json();
console.log(data);
```

## Related Modules

- [Pets](./PETS.md) - Manage customer's pets
- [Appointments](./APPOINTMENTS.md) - Book services for pets
- [Sales](./SALES.md) - Record product sales to customers
