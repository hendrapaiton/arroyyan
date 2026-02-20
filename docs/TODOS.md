# Todos Module

The todos module provides CRUD operations for user-specific todo items with authentication.

## Database Schema

### Todos Table
| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key (nanoid) |
| userId | text | Reference to user.id (cascade delete) |
| title | text | Todo title |
| description | text | Optional description |
| completed | boolean | Completion status (default: false) |
| createdAt | timestamp | Creation date |
| updatedAt | timestamp | Last update date |

## API Endpoints

All todo endpoints require authentication via Bearer token.

### GET /api/todos

Get all todos for the current user.

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
      "id": "todo_abc123",
      "userId": "user_xyz789",
      "title": "Buy groceries",
      "description": "Milk, eggs, bread",
      "completed": false,
      "createdAt": "2026-02-20T00:00:00.000Z",
      "updatedAt": "2026-02-20T00:00:00.000Z"
    }
  ]
}
```

### GET /api/todos/:id

Get a single todo by ID.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "todo_abc123",
    "userId": "user_xyz789",
    "title": "Buy groceries",
    "description": "Milk, eggs, bread",
    "completed": false,
    "createdAt": "2026-02-20T00:00:00.000Z",
    "updatedAt": "2026-02-20T00:00:00.000Z"
  }
}
```

**Response (404):**
```json
{
  "error": "Todo not found"
}
```

### POST /api/todos

Create a new todo.

**Headers:**
```
Authorization: Bearer <session_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Todo created successfully",
  "data": {
    "id": "todo_abc123",
    "userId": "user_xyz789",
    "title": "Buy groceries",
    "description": "Milk, eggs, bread",
    "completed": false,
    "createdAt": "2026-02-20T00:00:00.000Z",
    "updatedAt": "2026-02-20T00:00:00.000Z"
  }
}
```

### PATCH /api/todos/:id

Update an existing todo.

**Headers:**
```
Authorization: Bearer <session_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Updated title",
  "completed": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Todo updated successfully",
  "data": {
    "id": "todo_abc123",
    "userId": "user_xyz789",
    "title": "Updated title",
    "description": "Milk, eggs, bread",
    "completed": true,
    "updatedAt": "2026-02-20T01:00:00.000Z"
  }
}
```

### DELETE /api/todos/:id

Delete a todo.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Todo deleted successfully"
}
```

## Authentication

All todo endpoints use the `authMiddleware` which:
1. Validates the Authorization header format
2. Extracts the Bearer token
3. Looks up the session in the database
4. Verifies the session is not expired
5. Sets the userId in the context for subsequent handlers

## Usage Example

```typescript
// Create a todo
const response = await fetch('/api/todos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  },
  body: JSON.stringify({
    title: 'My first todo',
    description: 'This is a test'
  })
});

const data = await response.json();
console.log(data);
```

## Testing

```bash
# Run todos tests
bun test tests/todos.test.ts
```
