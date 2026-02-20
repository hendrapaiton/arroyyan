import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import { db } from "../src/db/local.ts";
import {
  users,
  sessions,
  products,
  inventory,
  sales,
  saleItems,
} from "../src/db/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const API_BASE = "http://localhost:3000/api";

// ============================================================================
// TEST UTILITIES
// ============================================================================

async function cleanupDatabase() {
  await db.delete(saleItems).execute();
  await db.delete(sales).execute();
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
  displayStock: number = 50
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
// CREATE SALE TESTS
// ============================================================================

describe("POST /api/penjualan", () => {
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

    // Create product with display stock
    productWithStock = await createTestProductWithStock("PNJ001", 100, 50);
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil create penjualan dengan payment cash (admin)", async () => {
    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "cash",
        paidAmount: 30000,
        items: [
          {
            productId: productWithStock,
            quantity: 2,
          },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.saleNumber).toBeDefined();
    expect(data.data.items).toHaveLength(1);
    expect(data.data.items[0].quantity).toBe(2);
    expect(data.data.totalAmount).toBe(30000); // 2 × 15000
    expect(data.data.changeAmount).toBe(0); // 30000 - 30000

    // Verify inventory updated
    const inv = await db.query.inventory.findFirst({
      where: eq(inventory.productId, productWithStock),
    });

    expect(inv?.displayStock).toBe(48); // 50 - 2
  });

  it("berhasil create penjualan dengan kembalian (cashier)", async () => {
    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        notes: "Pembelian customer 1",
        paymentMethod: "cash",
        paidAmount: 50000,
        items: [
          {
            productId: productWithStock,
            quantity: 2,
          },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.totalAmount).toBe(30000);
    expect(data.data.paidAmount).toBe(50000);
    expect(data.data.changeAmount).toBe(20000); // 50000 - 30000
    expect(data.data.notes).toBe("Pembelian customer 1");
  });

  it("berhasil create penjualan dengan payment qris", async () => {
    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "qris",
        paidAmount: 45000, // Exact amount
        items: [
          {
            productId: productWithStock,
            quantity: 3,
          },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.paymentMethod).toBe("qris");
    expect(data.data.totalAmount).toBe(45000); // 3 × 15000
    expect(data.data.changeAmount).toBe(0);
  });

  it("berhasil create penjualan dengan multiple items", async () => {
    // Create second product
    const product2 = await createTestProductWithStock("PNJ002", 80, 40);

    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "cash",
        paidAmount: 75000,
        items: [
          { productId: productWithStock, quantity: 2 },
          { productId: product2, quantity: 3 },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.items).toHaveLength(2);
    expect(data.data.totalAmount).toBe(75000); // (2×15000) + (3×15000)
  });

  it("gagal create penjualan - display stock tidak cukup", async () => {
    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "cash",
        paidAmount: 100000,
        items: [
          {
            productId: productWithStock,
            quantity: 100, // More than available
          },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Stok etalase tidak cukup");
  });

  it("gagal create penjualan - quantity kurang dari 1", async () => {
    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "cash",
        paidAmount: 15000,
        items: [
          {
            productId: productWithStock,
            quantity: 0,
          },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create penjualan - items kosong", async () => {
    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "cash",
        paidAmount: 0,
        items: [],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create penjualan - pembayaran kurang", async () => {
    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "cash",
        paidAmount: 10000, // Less than total (15000)
        items: [
          {
            productId: productWithStock,
            quantity: 1,
          },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Uang pembayaran");
  });

  it("gagal create penjualan - payment method invalid", async () => {
    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "transfer", // Invalid
        paidAmount: 15000,
        items: [
          {
            productId: productWithStock,
            quantity: 1,
          },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create penjualan - product tidak ditemukan", async () => {
    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "cash",
        paidAmount: 15000,
        items: [
          {
            productId: "nonexistent",
            quantity: 1,
          },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create penjualan - product tidak aktif", async () => {
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
      displayStock: 50,
      lastStockUpdate: now,
      createdAt: now,
      updatedAt: now,
    });

    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "cash",
        paidAmount: 10000,
        items: [{ productId, quantity: 1 }],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Product tidak aktif");
  });

  it("gagal create penjualan - tanpa authentication", async () => {
    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod: "cash",
        paidAmount: 15000,
        items: [{ productId: productWithStock, quantity: 1 }],
      }),
    });

    expect(response.status).toBe(401);
  });

  it("gagal create penjualan - guest tidak punya akses", async () => {
    await createTestUser({
      username: "guest1",
      name: "Guest",
      password: "guest123",
      role: "guest",
    });

    const guestToken = await login("guest1", "guest123");

    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${guestToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "cash",
        paidAmount: 15000,
        items: [{ productId: productWithStock, quantity: 1 }],
      }),
    });

    expect(response.status).toBe(403);
  });
});

// ============================================================================
// GET SALES TESTS
// ============================================================================

describe("GET /api/penjualan", () => {
  let adminToken: string;
  let product1: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    product1 = await createTestProductWithStock("PNJ003", 200, 100);

    // Create multiple sales
    for (let i = 0; i < 5; i++) {
      const saleId = `sale_${Date.now()}_${i}`;
      const saleNumber = `INV-20260219_${i}`;

      await db.insert(sales).values({
        id: saleId,
        saleNumber,
        saleDate: "2026-02-19",
        totalAmount: 30000,
        paymentMethod: i % 2 === 0 ? "cash" : "qris",
        paidAmount: 30000,
        changeAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await db.insert(saleItems).values({
        id: `salei_${Date.now()}_${i}`,
        saleId,
        productId: product1,
        quantity: 2,
        unitPrice: 15000,
        subtotal: 30000,
        createdAt: new Date().toISOString(),
      });
    }
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get list semua penjualan", async () => {
    const response = await fetch(`${API_BASE}/penjualan`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.sales).toBeDefined();
    expect(data.data.pagination).toBeDefined();
  });

  it("berhasil filter penjualan berdasarkan paymentMethod", async () => {
    const response = await fetch(`${API_BASE}/penjualan?paymentMethod=cash`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);

    data.data.sales.forEach((s: any) => {
      expect(s.paymentMethod).toBe("cash");
    });
  });

  it("berhasil pagination dengan limit", async () => {
    const response = await fetch(`${API_BASE}/penjualan?limit=2&page=1`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.sales.length).toBeLessThanOrEqual(2);
    expect(data.data.pagination.limit).toBe(2);
    expect(data.data.pagination.hasMore).toBe(true);
  });
});

// ============================================================================
// GET SALE BY ID TESTS
// ============================================================================

describe("GET /api/penjualan/:id", () => {
  let adminToken: string;
  let saleId: string;
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

    productId = await createTestProductWithStock("PNJ004", 100, 50);

    saleId = `sale_${Date.now()}_detail`;
    await db.insert(sales).values({
      id: saleId,
      saleNumber: `INV-${Date.now()}`,
      saleDate: "2026-02-19",
      totalAmount: 45000,
      paymentMethod: "cash",
      paidAmount: 50000,
      changeAmount: 5000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(saleItems).values({
      id: `salei_${Date.now()}_detail`,
      saleId,
      productId,
      quantity: 3,
      unitPrice: 15000,
      subtotal: 45000,
      createdAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get detail penjualan dengan items", async () => {
    const response = await fetch(`${API_BASE}/penjualan/${saleId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(saleId);
    expect(data.data.items).toBeDefined();
    expect(data.data.items.length).toBe(1);
    expect(data.data.totalAmount).toBe(45000);
    expect(data.data.changeAmount).toBe(5000);
  });

  it("gagal get penjualan - ID tidak ditemukan", async () => {
    const response = await fetch(`${API_BASE}/penjualan/sale_nonexistent`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });
});

// ============================================================================
// GET TODAY SUMMARY TESTS
// ============================================================================

describe("GET /api/penjualan/today", () => {
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

    // Create product and sale for today
    const productId = await createTestProductWithStock("PNJ005", 100, 50);

    const saleId = `sale_${Date.now()}_today`;
    await db.insert(sales).values({
      id: saleId,
      saleNumber: `INV-${Date.now()}`,
      saleDate: new Date().toISOString().split("T")[0], // Today
      totalAmount: 30000,
      paymentMethod: "cash",
      paidAmount: 30000,
      changeAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(saleItems).values({
      id: `salei_${Date.now()}_today`,
      saleId,
      productId,
      quantity: 2,
      unitPrice: 15000,
      subtotal: 30000,
      createdAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get today summary", async () => {
    const response = await fetch(`${API_BASE}/penjualan/today`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.date).toBe(new Date().toISOString().split("T")[0]);
    expect(data.data.totalTransactions).toBeGreaterThan(0);
    expect(data.data.totalRevenue).toBeGreaterThan(0);
  });
});

// ============================================================================
// GET SALES STATS TESTS
// ============================================================================

describe("GET /api/penjualan/stats", () => {
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

    // Create product and sales
    const productId = await createTestProductWithStock("PNJ006", 200, 100);

    for (let i = 0; i < 3; i++) {
      const saleId = `sale_${Date.now()}_stats_${i}`;
      await db.insert(sales).values({
        id: saleId,
        saleNumber: `INV-20260219_${i}`,
        saleDate: "2026-02-19",
        totalAmount: 30000 * (i + 1),
        paymentMethod: i % 2 === 0 ? "cash" : "qris",
        paidAmount: 30000 * (i + 1),
        changeAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await db.insert(saleItems).values({
        id: `salei_${Date.now()}_stats_${i}`,
        saleId,
        productId,
        quantity: 2 * (i + 1),
        unitPrice: 15000,
        subtotal: 30000 * (i + 1),
        createdAt: new Date().toISOString(),
      });
    }
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get sales statistics", async () => {
    const response = await fetch(`${API_BASE}/penjualan/stats`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalTransactions).toBe(3);
    expect(data.data.totalRevenue).toBe(30000 + 60000 + 90000); // 180000
    expect(data.data.topProducts).toBeDefined();
  });

  it("gagal get stats - guest tidak punya akses", async () => {
    await createTestUser({
      username: "guest2",
      name: "Guest",
      password: "guest123",
      role: "guest",
    });

    const guestToken = await login("guest2", "guest123");

    const response = await fetch(`${API_BASE}/penjualan/stats`, {
      method: "GET",
      headers: { Authorization: `Bearer ${guestToken}` },
    });

    expect(response.status).toBe(403);
  });
});
