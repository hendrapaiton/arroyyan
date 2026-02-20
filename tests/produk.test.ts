import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import { db } from "../src/db/index.ts";
import { users, sessions, products, inventory, type UserRole } from "../src/db/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API_BASE = "http://localhost:3000/api";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// ============================================================================
// TEST UTILITIES
// ============================================================================

async function cleanupDatabase() {
  await db.delete(sessions).execute();
  await db.delete(inventory).execute();
  await db.delete(products).execute();
  await db.delete(users).execute();
}

async function createTestUser(userData: {
  username: string;
  name: string;
  password: string;
  role?: UserRole;
}) {
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  await db.insert(users).values({
    id: userId,
    username: userData.username,
    name: userData.name,
    password: hashedPassword,
    role: userData.role || "guest",
    createdAt: now,
    updatedAt: now,
  });

  return { userId, username: userData.username, role: userData.role || "guest" };
}

async function login(username: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  return data.data.token;
}

function generateJWT(userId: string, username: string, role: UserRole): string {
  return jwt.sign({ userId, username, role }, JWT_SECRET, { expiresIn: "15m" });
}

// ============================================================================
// CREATE PRODUCT TESTS
// ============================================================================

describe("POST /api/produk", () => {
  let adminToken: string;
  let cashierToken: string;

  beforeAll(async () => {
    await cleanupDatabase();

    // Create admin user
    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    // Create cashier user
    await createTestUser({
      username: "kasir1",
      name: "Kasir Utama",
      password: "kasir123",
      role: "cashier",
    });

    adminToken = await login("admin", "admin123");
    cashierToken = await login("kasir1", "kasir123");
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil create produk baru dengan data valid", async () => {
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Makanan Kucing Premium",
        sku: "MK001",
        sellingPrice: 15000,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.name).toBe("Makanan Kucing Premium");
    expect(data.data.sku).toBe("MK001");
    expect(data.data.sellingPrice).toBe(15000);
    expect(data.data.isActive).toBe(true);
    expect(data.data.inventory).toBeDefined();
    expect(data.data.inventory.warehouseStock).toBe(0);
    expect(data.data.inventory.displayStock).toBe(0);

    // Verify in database
    const productInDb = await db.query.products.findFirst({
      where: eq(products.sku, "MK001"),
      with: { inventory: true },
    });

    expect(productInDb).toBeDefined();
    expect(productInDb?.inventory).toBeDefined();
  });

  it("SKU otomatis diubah ke uppercase", async () => {
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Minuman Kucing",
        sku: "mk002", // lowercase
        sellingPrice: 10000,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.sku).toBe("MK002"); // Should be uppercase
  });

  it("gagal create produk - SKU sudah digunakan", async () => {
    // Use unique SKU for this test
    const uniqueSku = `DUP${Date.now().toString().slice(-4)}`;
    
    // Create first product
    const createResponse = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Produk Test",
        sku: uniqueSku,
        sellingPrice: 5000,
      }),
    });
    
    expect(createResponse.ok).toBe(true);
    const createData = await createResponse.json();
    expect(createData.data.sku).toBe(uniqueSku);

    // Try to create with same SKU
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Produk Duplicate",
        sku: uniqueSku,
        sellingPrice: 6000,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toBe("SKU sudah digunakan");
  });

  it("gagal create produk - SKU lebih dari 7 karakter", async () => {
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Produk Test",
        sku: "SKU12345678", // 11 characters
        sellingPrice: 5000,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create produk - SKU mengandung karakter spesial", async () => {
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Produk Test",
        sku: "SKU@001", // Contains @
        sellingPrice: 5000,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create produk - harga jual kurang dari 1000", async () => {
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Produk Murah",
        sku: "MURAH01",
        sellingPrice: 500,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create produk - nama kurang dari 3 karakter", async () => {
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "AB",
        sku: "NAM001",
        sellingPrice: 5000,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create produk - tanpa authentication", async () => {
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Produk Test",
        sku: "AUTH001",
        sellingPrice: 5000,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("gagal create produk - cashier tidak punya akses", async () => {
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        name: "Produk Cashier",
        sku: "CASH001",
        sellingPrice: 5000,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });
});

// ============================================================================
// GET PRODUCTS TESTS
// ============================================================================

describe("GET /api/produk", () => {
  let adminToken: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    // Create multiple products for testing
    const productsData = [
      { name: "Makanan Kucing A", sku: "MKA001", sellingPrice: 15000, isActive: true },
      { name: "Makanan Anjing B", sku: "MAB002", sellingPrice: 20000, isActive: true },
      { name: "Vitamin Kucing", sku: "VIT003", sellingPrice: 25000, isActive: true },
      { name: "Pasir Kucing", sku: "PAS004", sellingPrice: 30000, isActive: false },
    ];

    for (const prod of productsData) {
      await fetch(`${API_BASE}/produk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(prod),
      });
    }
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get list semua produk", async () => {
    const response = await fetch(`${API_BASE}/produk`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.products).toBeDefined();
    expect(data.data.products.length).toBeGreaterThan(0);
    expect(data.data.pagination).toBeDefined();
  });

  it("berhasil filter produk berdasarkan search", async () => {
    const response = await fetch(`${API_BASE}/produk?search=Kucing`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.products.length).toBeGreaterThan(0);

    // All results should contain "Kucing"
    data.data.products.forEach((p: any) => {
      expect(p.name.toLowerCase()).toContain("kucing");
    });
  });

  it("berhasil filter produk berdasarkan isActive", async () => {
    const response = await fetch(`${API_BASE}/produk?isActive=false`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(200);

    // All results should be inactive
    data.data.products.forEach((p: any) => {
      expect(p.isActive).toBe(false);
    });
  });

  it("berhasil pagination dengan limit", async () => {
    const response = await fetch(`${API_BASE}/produk?limit=2&page=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.products.length).toBeLessThanOrEqual(2);
    expect(data.data.pagination.limit).toBe(2);
    expect(data.data.pagination.hasMore).toBe(true);
  });

  it("gagal get produk - tanpa authentication", async () => {
    const response = await fetch(`${API_BASE}/produk`, {
      method: "GET",
    });

    expect(response.status).toBe(401);
  });
});

// ============================================================================
// GET PRODUCT BY ID TESTS
// ============================================================================

describe("GET /api/produk/:id", () => {
  let adminToken: string;
  let createdProductId: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    // Create a product
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Produk Detail Test",
        sku: "DET001",
        sellingPrice: 10000,
      }),
    });

    const data = await response.json();
    createdProductId = data.data.id;
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get detail produk by ID", async () => {
    const response = await fetch(`${API_BASE}/produk/${createdProductId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(createdProductId);
    expect(data.data.name).toBe("Produk Detail Test");
    expect(data.data.sku).toBe("DET001");
    expect(data.data.inventory).toBeDefined();
  });

  it("gagal get produk - ID tidak ditemukan", async () => {
    const response = await fetch(`${API_BASE}/produk/prod_nonexistent`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Produk tidak ditemukan");
  });
});

// ============================================================================
// GET PRODUCT STOCK TESTS
// ============================================================================

describe("GET /api/produk/:id/stok", () => {
  let adminToken: string;
  let createdProductId: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    // Create a product
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Produk Stock Test",
        sku: "STK001",
        sellingPrice: 10000,
      }),
    });

    const data = await response.json();
    createdProductId = data.data.id;
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get stock info produk", async () => {
    const response = await fetch(`${API_BASE}/produk/${createdProductId}/stok`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.productId).toBe(createdProductId);
    expect(data.data.stock).toBeDefined();
    expect(data.data.stock.warehouse).toBe(0);
    expect(data.data.stock.display).toBe(0);
    expect(data.data.stock.total).toBe(0);
  });
});

// ============================================================================
// UPDATE PRODUCT TESTS
// ============================================================================

describe("PUT /api/produk/:id", () => {
  let adminToken: string;
  let createdProductId: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    // Create a product
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Produk Update Test",
        sku: "UPD001",
        sellingPrice: 10000,
      }),
    });

    const data = await response.json();
    createdProductId = data.data.id;
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil update nama produk", async () => {
    const response = await fetch(`${API_BASE}/produk/${createdProductId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Produk Updated",
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe("Produk Updated");
    expect(data.data.sku).toBe("UPD001"); // SKU unchanged
  });

  it("berhasil update harga produk", async () => {
    const response = await fetch(`${API_BASE}/produk/${createdProductId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        sellingPrice: 15000,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.sellingPrice).toBe(15000);
  });

  it("gagal update - harga kurang dari 1000", async () => {
    const response = await fetch(`${API_BASE}/produk/${createdProductId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        sellingPrice: 500,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal update - produk tidak ditemukan", async () => {
    const response = await fetch(`${API_BASE}/produk/prod_nonexistent`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Update Test",
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Produk tidak ditemukan");
  });

  it("gagal update - cashier tidak punya akses", async () => {
    // Create cashier and login
    await createTestUser({
      username: "kasir2",
      name: "Kasir 2",
      password: "kasir123",
      role: "cashier",
    });

    const cashierToken = await login("kasir2", "kasir123");

    const response = await fetch(`${API_BASE}/produk/${createdProductId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        name: "Unauthorized Update",
      }),
    });

    expect(response.status).toBe(403);
  });
});

// ============================================================================
// DELETE PRODUCT TESTS
// ============================================================================

describe("DELETE /api/produk/:id", () => {
  let adminToken: string;
  let productWithoutStockId: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    // Create product without stock using unique SKU (max 7 chars)
    const sku2 = `N${Date.now().toString().slice(-6)}`;
    const response2 = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Produk Tanpa Stok",
        sku: sku2,
        sellingPrice: 10000,
      }),
    });

    if (!response2.ok) {
      throw new Error(`Failed to create product without stock: ${await response2.text()}`);
    }

    const data2 = await response2.json();
    productWithoutStockId = data2.data.id;
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil delete - produk tanpa stok", async () => {
    const response = await fetch(`${API_BASE}/produk/${productWithoutStockId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify product is soft deleted (isActive = false)
    const productInDb = await db.query.products.findFirst({
      where: eq(products.id, productWithoutStockId),
    });

    expect(productInDb?.isActive).toBe(false);
  });

  it("gagal delete - produk tidak ditemukan", async () => {
    const response = await fetch(`${API_BASE}/produk/prod_nonexistent`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(404);
  });
});

// ============================================================================
// ACTIVATE/DEACTIVATE PRODUCT TESTS
// ============================================================================

describe("PATCH /api/produk/:id/activate", () => {
  let adminToken: string;
  let testProductId: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    // Create a product with unique SKU (max 7 chars)
    const sku = `A${Date.now().toString().slice(-6)}`;
    const response = await fetch(`${API_BASE}/produk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Produk Activate Test",
        sku: sku,
        sellingPrice: 10000,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create product for activate test: ${await response.text()}`);
    }
    
    const data = await response.json();
    testProductId = data.data.id;
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil deactivate produk", async () => {
    const response = await fetch(`${API_BASE}/produk/${testProductId}/activate`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify in database
    const productInDb = await db.query.products.findFirst({
      where: eq(products.id, testProductId),
    });

    expect(productInDb?.isActive).toBe(false);
  });

  it("berhasil activate produk kembali", async () => {
    const response = await fetch(`${API_BASE}/produk/${testProductId}/activate`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: true }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const productInDb = await db.query.products.findFirst({
      where: eq(products.id, testProductId),
    });

    expect(productInDb?.isActive).toBe(true);
  });

  it("gagal activate - isActive bukan boolean", async () => {
    const response = await fetch(`${API_BASE}/produk/${testProductId}/activate`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: "true" }), // string instead of boolean
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });
});
