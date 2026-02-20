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

async function createTestSale(
  productId: string,
  saleDate: string,
  totalAmount: number,
  paymentMethod: "cash" | "qris" = "cash"
) {
  const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const saleNumber = `INV-${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const quantity = totalAmount / 15000; // Assuming unit price is 15000

  await db.insert(sales).values({
    id: saleId,
    saleNumber,
    saleDate,
    totalAmount,
    paymentMethod,
    paidAmount: totalAmount,
    changeAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await db.insert(saleItems).values({
    id: `salei_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    saleId,
    productId,
    quantity,
    unitPrice: 15000,
    subtotal: totalAmount,
    createdAt: new Date().toISOString(),
  });

  return saleId;
}

// ============================================================================
// DASHBOARD TESTS
// ============================================================================

describe("GET /api/dashboard", () => {
  let adminToken: string;
  let cashierToken: string;
  let guestToken: string;
  let productId: string;
  let today: string;

  beforeAll(async () => {
    await cleanupDatabase();

    // Create users with different roles
    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    await createTestUser({
      username: "kasir1",
      name: "Kasir Utama",
      password: "kasir123",
      role: "cashier",
    });

    await createTestUser({
      username: "guest1",
      name: "Guest User",
      password: "guest123",
      role: "guest",
    });

    adminToken = await login("admin", "admin123");
    cashierToken = await login("kasir1", "kasir123");
    guestToken = await login("guest1", "guest123");

    // Create products with various stock levels
    productId = await createTestProductWithStock("DASH001", 100, 50);
    await createTestProductWithStock("DASH002", 20, 5); // Low display stock
    await createTestProductWithStock("DASH003", 10, 0); // Out of display stock

    // Get today's date
    today = new Date().toISOString().split("T")[0];

    // Create sales for today
    await createTestSale(productId, today, 30000, "cash");
    await createTestSale(productId, today, 45000, "qris");
    await createTestSale(productId, today, 15000, "cash");
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get dashboard data dengan period daily (default)", async () => {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.period).toBe("daily");
    expect(data.data.startDate).toBe(today);
    expect(data.data.endDate).toBe(today);
    expect(data.data.totalRevenue).toBe(90000); // 30000 + 45000 + 15000
    expect(data.data.transactions).toBeDefined();
    expect(Array.isArray(data.data.transactions)).toBe(true);
  });

  it("berhasil get dashboard data dengan period weekly", async () => {
    const response = await fetch(`${API_BASE}/dashboard?period=weekly`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.period).toBe("weekly");
    expect(data.data.startDate).toBeDefined();
    expect(data.data.endDate).toBe(today);
  });

  it("berhasil get dashboard data dengan period monthly", async () => {
    const response = await fetch(`${API_BASE}/dashboard?period=monthly`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.period).toBe("monthly");
    expect(data.data.startDate).toBeDefined();
    expect(data.data.endDate).toBe(today);
  });

  it("dashboard mencakup low stock count", async () => {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.lowStockCount).toBeDefined();
    // Low stock count might be 0 if all products have sufficient stock
    expect(typeof data.data.lowStockCount).toBe("number");
  });

  it("dashboard transactions limited to max 20", async () => {
    // Create many sales to test the limit
    for (let i = 0; i < 25; i++) {
      await createTestSale(productId, today, 10000, "cash");
    }

    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.transactions.length).toBeLessThanOrEqual(20);
  });

  it("cashier dapat akses dashboard", async () => {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("guest dapat akses dashboard", async () => {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${guestToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("gagal akses dashboard - tanpa authentication", async () => {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
    });

    // Without auth middleware, the endpoint might return 500 or 401
    // depending on error handling
    expect(response.status).toBeGreaterThanOrEqual(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it("gagal akses dashboard - invalid period", async () => {
    const response = await fetch(`${API_BASE}/dashboard?period=invalid`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });
});

// ============================================================================
// DASHBOARD WITH HISTORICAL DATA TESTS
// ============================================================================

describe("GET /api/dashboard - Historical Data", () => {
  let adminToken: string;
  let productId: string;
  let today: string;
  let yesterday: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin2",
      name: "Administrator 2",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin2", "admin123");

    productId = await createTestProductWithStock("HIST001", 200, 100);

    today = new Date().toISOString().split("T")[0];
    
    // Calculate yesterday
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    yesterday = yesterdayDate.toISOString().split("T")[0];

    // Create sales for today
    await createTestSale(productId, today, 50000, "cash");
    await createTestSale(productId, today, 30000, "qris");

    // Create sales for yesterday
    await createTestSale(productId, yesterday, 40000, "cash");
    await createTestSale(productId, yesterday, 20000, "cash");
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("daily period hanya menghitung penjualan hari ini", async () => {
    const response = await fetch(`${API_BASE}/dashboard?period=daily`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.totalRevenue).toBe(80000); // Only today's sales: 50000 + 30000
  });

  it("weekly period menghitung penjualan minggu ini", async () => {
    const response = await fetch(`${API_BASE}/dashboard?period=weekly`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    // Weekly should include both today and yesterday (same week)
    expect(data.data.totalRevenue).toBeGreaterThanOrEqual(80000);
  });

  it("monthly period menghitung penjualan bulan ini", async () => {
    const response = await fetch(`${API_BASE}/dashboard?period=monthly`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    // Monthly should include all sales in current month
    expect(data.data.totalRevenue).toBeGreaterThanOrEqual(140000); // Today + Yesterday
  });
});

// ============================================================================
// DASHBOARD EDGE CASES
// ============================================================================

describe("GET /api/dashboard - Edge Cases", () => {
  let adminToken: string;
  let productId: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin3",
      name: "Administrator 3",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin3", "admin123");

    productId = await createTestProductWithStock("EDGE001", 50, 25);

    // No sales created - test empty dashboard
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("dashboard dengan tidak ada penjualan menampilkan revenue 0", async () => {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalRevenue).toBe(0);
    expect(data.data.transactions).toEqual([]);
  });

  it("dashboard dengan tidak ada penjualan tetap menampilkan low stock count", async () => {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.lowStockCount).toBeDefined();
    expect(typeof data.data.lowStockCount).toBe("number");
  });
});

// ============================================================================
// DASHBOARD WITH MULTIPLE PRODUCTS
// ============================================================================

describe("GET /api/dashboard - Multiple Products Scenario", () => {
  let adminToken: string;
  let today: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin4",
      name: "Administrator 4",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin4", "admin123");

    // Create products with different stock scenarios
    const prod1 = await createTestProductWithStock("MULT001", 100, 50); // Normal stock
    const prod2 = await createTestProductWithStock("MULT002", 30, 8); // Low display stock
    const prod3 = await createTestProductWithStock("MULT003", 5, 0); // Out of display stock
    const prod4 = await createTestProductWithStock("MULT004", 2, 1); // Very low stock

    today = new Date().toISOString().split("T")[0];

    // Create sales for multiple products
    await createTestSale(prod1, today, 60000, "cash");
    await createTestSale(prod2, today, 45000, "qris");
    await createTestSale(prod3, today, 15000, "cash");
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("dashboard menghitung total revenue dari semua produk", async () => {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.totalRevenue).toBe(120000); // 60000 + 45000 + 15000
  });

  it("dashboard low stock count akurat dengan multiple products", async () => {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    // Should count products with low display stock (MULT002, MULT003, MULT004)
    expect(data.data.lowStockCount).toBeGreaterThanOrEqual(2);
  });

  it("dashboard transactions menampilkan transaksi dari semua produk", async () => {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.transactions.length).toBe(3); // 3 sales created
  });
});

// ============================================================================
// DASHBOARD PAYMENT METHOD BREAKDOWN
// ============================================================================

describe("GET /api/dashboard - Payment Method Analysis", () => {
  let adminToken: string;
  let productId: string;
  let today: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin5",
      name: "Administrator 5",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin5", "admin123");

    productId = await createTestProductWithStock("PAY001", 200, 100);

    today = new Date().toISOString().split("T")[0];

    // Create sales with different payment methods
    await createTestSale(productId, today, 30000, "cash");
    await createTestSale(productId, today, 30000, "cash");
    await createTestSale(productId, today, 40000, "qris");
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("dashboard transactions menampilkan payment method yang benar", async () => {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    
    const cashTransactions = data.data.transactions.filter(
      (t: any) => t.paymentMethod === "cash"
    );
    const qrisTransactions = data.data.transactions.filter(
      (t: any) => t.paymentMethod === "qris"
    );

    expect(cashTransactions.length).toBe(2);
    expect(qrisTransactions.length).toBe(1);
  });
});
