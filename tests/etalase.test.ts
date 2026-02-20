import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import { db } from "../src/db/local.ts";
import {
  users,
  sessions,
  products,
  inventory,
  stockTransfers,
  stockTransferItems,
} from "../src/db/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const API_BASE = "http://localhost:3000/api";

// ============================================================================
// TEST UTILITIES
// ============================================================================

async function cleanupDatabase() {
  await db.delete(stockTransferItems).execute();
  await db.delete(stockTransfers).execute();
  await db.delete(inventory).execute();
  await db.delete(products).execute();
  await db.delete(sessions).execute();
  await db.delete(users).execute();
}

async function createTestUser(userData: {
  username: string;
  name: string;
  password: string;
  role?: "admin" | "cashier" | "guest";
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

async function createTestProductWithStock(
  sku: string,
  warehouseStock: number = 100,
  displayStock: number = 0
) {
  const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  await db.insert(products).values({
    id: productId,
    name: `Produk Test ${sku}`,
    sku,
    sellingPrice: 15000,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(inventory).values({
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    productId,
    warehouseStock,
    displayStock,
    lastStockUpdate: now,
    createdAt: now,
    updatedAt: now,
  });

  return productId;
}

// ============================================================================
// CREATE TRANSFER TESTS
// ============================================================================

describe("POST /api/etalase", () => {
  let adminToken: string;
  let cashierToken: string;
  let productWithStock: string;

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

    // Create product with warehouse stock
    productWithStock = await createTestProductWithStock("ETF001", 100, 0);
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil create transfer dengan 1 item (admin)", async () => {
    const response = await fetch(`${API_BASE}/etalase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            productId: productWithStock,
            quantity: 20,
          },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.transferNumber).toBeDefined();
    expect(data.data.items).toHaveLength(1);
    expect(data.data.items[0].quantity).toBe(20);

    // Verify inventory updated
    const inv = await db.query.inventory.findFirst({
      where: eq(inventory.productId, productWithStock),
    });

    expect(inv?.warehouseStock).toBe(80); // 100 - 20
    expect(inv?.displayStock).toBe(20); // 0 + 20
  });

  it("berhasil create transfer dengan multiple items (cashier)", async () => {
    // Create second product
    const product2 = await createTestProductWithStock("ETF002", 50, 5);

    const response = await fetch(`${API_BASE}/etalase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        notes: "Restock etalase pagi",
        items: [
          { productId: productWithStock, quantity: 10 },
          { productId: product2, quantity: 15 },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.items).toHaveLength(2);
    expect(data.data.notes).toBe("Restock etalase pagi");

    // Verify inventory updated for both products
    const inv1 = await db.query.inventory.findFirst({
      where: eq(inventory.productId, productWithStock),
    });
    expect(inv1?.warehouseStock).toBe(70); // 80 - 10
    expect(inv1?.displayStock).toBe(30); // 20 + 10

    const inv2 = await db.query.inventory.findFirst({
      where: eq(inventory.productId, product2),
    });
    expect(inv2?.warehouseStock).toBe(35); // 50 - 15
    expect(inv2?.displayStock).toBe(20); // 5 + 15
  });

  it("berhasil create transfer dengan custom transferDate", async () => {
    const product3 = await createTestProductWithStock("ETF003", 30, 0);

    const response = await fetch(`${API_BASE}/etalase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        transferDate: "2026-02-15",
        items: [{ productId: product3, quantity: 10 }],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.transferDate).toBe("2026-02-15");
  });

  it("gagal create transfer - quantity kurang dari 1", async () => {
    const response = await fetch(`${API_BASE}/etalase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: productWithStock, quantity: 0 }],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create transfer - items kosong", async () => {
    const response = await fetch(`${API_BASE}/etalase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create transfer - stock tidak cukup", async () => {
    const response = await fetch(`${API_BASE}/etalase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: productWithStock, quantity: 1000 }],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Stok gudang tidak cukup");
  });

  it("gagal create transfer - product tidak ditemukan", async () => {
    const response = await fetch(`${API_BASE}/etalase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: "nonexistent", quantity: 10 }],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create transfer - product tidak aktif", async () => {
    // Create inactive product
    const productId = `prod_${Date.now()}_inactive`;
    const now = new Date().toISOString();

    await db.insert(products).values({
      id: productId,
      name: "Produk Inactive",
      sku: `SKU_${Date.now()}`,
      sellingPrice: 10000,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(inventory).values({
      id: `inv_${Date.now()}_inactive`,
      productId,
      warehouseStock: 100,
      displayStock: 0,
      lastStockUpdate: now,
      createdAt: now,
      updatedAt: now,
    });

    const response = await fetch(`${API_BASE}/etalase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [{ productId, quantity: 10 }],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Product tidak aktif");
  });

  it("gagal create transfer - tanpa authentication", async () => {
    const response = await fetch(`${API_BASE}/etalase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productId: productWithStock, quantity: 10 }],
      }),
    });

    expect(response.status).toBe(401);
  });

  it("gagal create transfer - guest tidak punya akses", async () => {
    await createTestUser({
      username: "guest1",
      name: "Guest",
      password: "guest123",
      role: "guest",
    });

    const guestToken = await login("guest1", "guest123");

    const response = await fetch(`${API_BASE}/etalase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${guestToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: productWithStock, quantity: 10 }],
      }),
    });

    expect(response.status).toBe(403);
  });
});

// ============================================================================
// GET TRANSFERS TESTS
// ============================================================================

describe("GET /api/etalase", () => {
  let adminToken: string;
  let product1: string;
  let product2: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    // Create products
    product1 = await createTestProductWithStock("ETL001", 100, 0);
    product2 = await createTestProductWithStock("ETL002", 80, 0);

    // Create multiple transfers
    for (let i = 0; i < 5; i++) {
      const transferId = `trf_${Date.now()}_${i}`;
      const transferNumber = `TRF-20260219_${i}`;

      await db.insert(stockTransfers).values({
        id: transferId,
        transferNumber,
        transferDate: "2026-02-19",
        notes: `Transfer #${i}`,
        createdAt: new Date().toISOString(),
      });

      await db.insert(stockTransferItems).values({
        id: `trfi_${Date.now()}_${i}`,
        transferId,
        productId: i % 2 === 0 ? product1 : product2,
        quantity: 10,
        createdAt: new Date().toISOString(),
      });
    }
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get list semua transfer", async () => {
    const response = await fetch(`${API_BASE}/etalase`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.transfers).toBeDefined();
    expect(data.data.pagination).toBeDefined();
  });

  it("berhasil pagination dengan limit", async () => {
    const response = await fetch(`${API_BASE}/etalase?limit=2&page=1`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.transfers.length).toBeLessThanOrEqual(2);
    expect(data.data.pagination.limit).toBe(2);
    expect(data.data.pagination.hasMore).toBe(true);
  });
});

// ============================================================================
// GET TRANSFER BY ID TESTS
// ============================================================================

describe("GET /api/etalase/:id", () => {
  let adminToken: string;
  let transferId: string;
  let productId: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    // Create product and transfer
    productId = await createTestProductWithStock("ETL003", 50, 0);

    transferId = `trf_${Date.now()}_detail`;
    await db.insert(stockTransfers).values({
      id: transferId,
      transferNumber: `TRF-${Date.now()}`,
      transferDate: "2026-02-19",
      notes: "Transfer detail test",
      createdAt: new Date().toISOString(),
    });

    await db.insert(stockTransferItems).values({
      id: `trfi_${Date.now()}_detail`,
      transferId,
      productId,
      quantity: 20,
      createdAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get detail transfer dengan items", async () => {
    const response = await fetch(`${API_BASE}/etalase/${transferId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(transferId);
    expect(data.data.items).toBeDefined();
    expect(data.data.items.length).toBe(1);
  });

  it("gagal get transfer - ID tidak ditemukan", async () => {
    const response = await fetch(`${API_BASE}/etalase/trf_nonexistent`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });
});

// ============================================================================
// GET TRANSFER ITEMS TESTS
// ============================================================================

describe("GET /api/etalase/:id/items", () => {
  let adminToken: string;
  let transferId: string;
  let productId: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    // Create product and transfer
    productId = await createTestProductWithStock("ETL004", 50, 0);

    transferId = `trf_${Date.now()}_items`;
    await db.insert(stockTransfers).values({
      id: transferId,
      transferNumber: `TRF-${Date.now()}`,
      transferDate: "2026-02-19",
      createdAt: new Date().toISOString(),
    });

    // Add multiple items with unique IDs
    const timestamp = Date.now();
    await db.insert(stockTransferItems).values(
      {
        id: `trfi_${timestamp}_1`,
        transferId,
        productId,
        quantity: 10,
        createdAt: new Date().toISOString(),
      },
      {
        id: `trfi_${timestamp}_2`,
        transferId,
        productId,
        quantity: 15,
        createdAt: new Date().toISOString(),
      }
    );
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get items dari transfer", async () => {
    const response = await fetch(`${API_BASE}/etalase/${transferId}/items`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.transferId).toBe(transferId);
    expect(data.data.items.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// GET STOCK STATS TESTS
// ============================================================================

describe("GET /api/etalase/stats", () => {
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

    // Create products with various stock levels
    await createTestProductWithStock("STAT001", 100, 50); // Normal
    await createTestProductWithStock("STAT002", 50, 0); // Out of display stock
    await createTestProductWithStock("STAT003", 30, 5); // Low display stock
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get stock statistics", async () => {
    const response = await fetch(`${API_BASE}/etalase/stats`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalProducts).toBe(3);
    expect(data.data.totalWarehouseStock).toBe(180); // 100 + 50 + 30
    expect(data.data.totalDisplayStock).toBe(55); // 50 + 0 + 5
    expect(data.data.outOfStockProducts).toBe(1); // STAT002
    expect(data.data.lowStockProducts).toBe(1); // STAT003 (display < 10)
  });
});

// ============================================================================
// GET RESTOCK SUGGESTIONS TESTS
// ============================================================================

describe("GET /api/etalase/restock-suggestions", () => {
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

    // Create products with different stock scenarios
    await createTestProductWithStock("REST001", 50, 5); // Should suggest (low display, high warehouse)
    await createTestProductWithStock("REST002", 5, 3); // Should NOT suggest (low warehouse)
    await createTestProductWithStock("REST003", 100, 30); // Should NOT suggest (display ok)
    await createTestProductWithStock("REST004", 20, 0); // Should suggest (out of display)
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get restock suggestions", async () => {
    const response = await fetch(`${API_BASE}/etalase/restock-suggestions`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.suggestions).toBeDefined();
    expect(data.data.count).toBeGreaterThan(0);
  });

  it("berhasil filter restock suggestions dengan minWarehouseStock", async () => {
    const response = await fetch(`${API_BASE}/etalase/restock-suggestions?minWarehouseStock=30`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    // Products with warehouse < 30 should be excluded
    data.data.suggestions.forEach((s: any) => {
      expect(s.warehouseStock).toBeGreaterThanOrEqual(30);
    });
  });
});
