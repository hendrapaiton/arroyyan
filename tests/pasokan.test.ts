import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import { db } from "../src/db/local.ts";
import { users, sessions, suppliers, supplyOrders, supplyOrderItems, products, inventory } from "../src/db/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const API_BASE = "http://localhost:3000/api";

// ============================================================================
// TEST UTILITIES
// ============================================================================

async function cleanupDatabase() {
  await db.delete(supplyOrderItems).execute();
  await db.delete(supplyOrders).execute();
  await db.delete(inventory).execute();
  await db.delete(products).execute();
  await db.delete(suppliers).execute();
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

async function createTestProduct() {
  const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  await db.insert(products).values({
    id: productId,
    name: "Produk Test",
    sku: `SKU${Date.now()}`,
    sellingPrice: 15000,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(inventory).values({
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    productId,
    warehouseStock: 0,
    displayStock: 0,
    lastStockUpdate: now,
    createdAt: now,
    updatedAt: now,
  });

  return productId;
}

// ============================================================================
// SUPPLIERS TESTS
// ============================================================================

describe("POST /api/pasokan/suppliers", () => {
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
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil create supplier baru dengan data valid", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "PT Supplier Makmur",
        contactPerson: "Budi Santoso",
        phone: "081234567890",
        address: "Jl. Raya Utama No. 123",
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.name).toBe("PT Supplier Makmur");
    expect(data.data.contactPerson).toBe("Budi Santoso");
    expect(data.data.phone).toBe("081234567890");
    expect(data.data.isActive).toBe(true);

    // Verify in database
    const supplierInDb = await db.query.suppliers.findFirst({
      where: eq(suppliers.name, "PT Supplier Makmur"),
    });

    expect(supplierInDb).toBeDefined();
  });

  it("berhasil create supplier dengan data minimal (nama saja)", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Supplier Sederhana",
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.name).toBe("Supplier Sederhana");
    expect(data.data.contactPerson).toBeNull();
  });

  it("gagal create supplier - nama kurang dari 3 karakter", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "AB",
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create supplier - nama lebih dari 100 karakter", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "A".repeat(101),
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create supplier - address lebih dari 100 karakter", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Supplier Test",
        address: "A".repeat(101),
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create supplier - tanpa authentication", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Supplier Test" }),
    });

    expect(response.status).toBe(401);
  });

  it("gagal create supplier - cashier tidak punya akses", async () => {
    await createTestUser({
      username: "kasir1",
      name: "Kasir",
      password: "kasir123",
      role: "cashier",
    });

    const cashierToken = await login("kasir1", "kasir123");

    const response = await fetch(`${API_BASE}/pasokan/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({ name: "Supplier Test" }),
    });

    expect(response.status).toBe(403);
  });
});

describe("GET /api/pasokan/suppliers", () => {
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

    // Create multiple suppliers
    const suppliersData = [
      { name: "PT Supplier A", contactPerson: "Andi", phone: "08111111111", isActive: true },
      { name: "CV Supplier B", contactPerson: "Budi", phone: "08222222222", isActive: true },
      { name: "PT Supplier C", contactPerson: "Andi", phone: "08333333333", isActive: false },
    ];

    for (const supp of suppliersData) {
      await db.insert(suppliers).values({
        id: `supp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        ...supp,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get list semua supplier", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.suppliers).toBeDefined();
    expect(data.data.pagination).toBeDefined();
  });

  it("berhasil filter supplier berdasarkan search", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers?search=Andi`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.suppliers.length).toBeGreaterThan(0);

    // All results should contain "Andi" in name or contactPerson
    data.data.suppliers.forEach((s: any) => {
      expect(s.contactPerson).toBe("Andi");
    });
  });

  it("berhasil filter supplier berdasarkan isActive", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers?isActive=false`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);

    data.data.suppliers.forEach((s: any) => {
      expect(s.isActive).toBe(false);
    });
  });
});

describe("GET /api/pasokan/suppliers/:id", () => {
  let adminToken: string;
  let supplierId: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    const id = `supp_${Date.now()}_test`;
    await db.insert(suppliers).values({
      id,
      name: "Supplier Detail Test",
      contactPerson: "Test Person",
      phone: "081234567890",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    supplierId = id;
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get detail supplier by ID", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers/${supplierId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe("Supplier Detail Test");
  });

  it("gagal get supplier - ID tidak ditemukan", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers/supp_nonexistent`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Supplier tidak ditemukan");
  });
});

describe("PUT /api/pasokan/suppliers/:id", () => {
  let adminToken: string;
  let supplierId: string;

  beforeAll(async () => {
    await cleanupDatabase();

    await createTestUser({
      username: "admin",
      name: "Administrator",
      password: "admin123",
      role: "admin",
    });

    adminToken = await login("admin", "admin123");

    const id = `supp_${Date.now()}_update`;
    await db.insert(suppliers).values({
      id,
      name: "Supplier Original",
      contactPerson: "Original Person",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    supplierId = id;
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil update supplier", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers/${supplierId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Supplier Updated",
        contactPerson: "Updated Person",
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe("Supplier Updated");
  });

  it("berhasil deactivate supplier", async () => {
    const response = await fetch(`${API_BASE}/pasokan/suppliers/${supplierId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.isActive).toBe(false);
  });
});

// ============================================================================
// SUPPLY ORDERS TESTS
// ============================================================================

describe("POST /api/pasokan/orders", () => {
  let adminToken: string;
  let supplierId: string;
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

    // Create supplier
    const suppId = `supp_${Date.now()}_test`;
    await db.insert(suppliers).values({
      id: suppId,
      name: "Supplier Test",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    supplierId = suppId;

    // Create product
    productId = await createTestProduct();
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil create pasokan dengan 1 item", async () => {
    const response = await fetch(`${API_BASE}/pasokan/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        supplierId,
        items: [
          {
            productId,
            quantity: 100,
            purchasePrice: 10000,
          },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.orderNumber).toBeDefined();
    expect(data.data.totalAmount).toBe(1000000); // 100 * 10000
    expect(data.data.items).toBeDefined();
    expect(data.data.items.length).toBe(1);

    // Verify inventory increased
    const inv = await db.query.inventory.findFirst({
      where: eq(inventory.productId, productId),
    });

    expect(inv?.warehouseStock).toBe(100);
  });

  it("berhasil create pasokan dengan multiple items", async () => {
    // Create second product
    const productId2 = await createTestProduct();

    const response = await fetch(`${API_BASE}/pasokan/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        supplierId,
        items: [
          { productId, quantity: 50, purchasePrice: 10000 },
          { productId: productId2, quantity: 30, purchasePrice: 15000 },
        ],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.totalAmount).toBe(50 * 10000 + 30 * 15000); // 950000
  });

  it("gagal create pasokan - supplier tidak ditemukan", async () => {
    const response = await fetch(`${API_BASE}/pasokan/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        supplierId: "nonexistent",
        items: [{ productId, quantity: 10, purchasePrice: 10000 }],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Supplier tidak ditemukan");
  });

  it("gagal create pasokan - supplier tidak aktif", async () => {
    // Create inactive supplier
    const suppId = `supp_${Date.now()}_inactive`;
    await db.insert(suppliers).values({
      id: suppId,
      name: "Supplier Inactive",
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await fetch(`${API_BASE}/pasokan/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        supplierId: suppId,
        items: [{ productId, quantity: 10, purchasePrice: 10000 }],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Supplier tidak aktif");
  });

  it("gagal create pasokan - product tidak ditemukan", async () => {
    const response = await fetch(`${API_BASE}/pasokan/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        supplierId,
        items: [{ productId: "nonexistent", quantity: 10, purchasePrice: 10000 }],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
  });

  it("gagal create pasokan - purchase price kurang dari 1000", async () => {
    const response = await fetch(`${API_BASE}/pasokan/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        supplierId,
        items: [{ productId, quantity: 10, purchasePrice: 500 }],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create pasokan - quantity kurang dari 1", async () => {
    const response = await fetch(`${API_BASE}/pasokan/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        supplierId,
        items: [{ productId, quantity: 0, purchasePrice: 10000 }],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("gagal create pasokan - items kosong", async () => {
    const response = await fetch(`${API_BASE}/pasokan/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        supplierId,
        items: [],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });
});

describe("GET /api/pasokan/orders", () => {
  let adminToken: string;
  let supplierId: string;
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

    // Create supplier
    const suppId = `supp_${Date.now()}_test`;
    await db.insert(suppliers).values({
      id: suppId,
      name: "Supplier Test",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    supplierId = suppId;

    // Create product
    productId = await createTestProduct();

    // Create multiple orders
    for (let i = 0; i < 3; i++) {
      const orderId = `supo_${Date.now()}_${i}`;
      const orderNumber = `SUP-20260219_${i}`;
      await db.insert(supplyOrders).values({
        id: orderId,
        orderNumber,
        supplierId,
        orderDate: new Date().toISOString().split("T")[0],
        totalAmount: 100000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await db.insert(supplyOrderItems).values({
        id: `supi_${Date.now()}_${i}`,
        supplyOrderId: orderId,
        productId,
        quantity: 10,
        purchasePrice: 10000,
        subtotal: 100000,
        createdAt: new Date().toISOString(),
      });
    }
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get list semua supply orders", async () => {
    const response = await fetch(`${API_BASE}/pasokan/orders`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.orders).toBeDefined();
    expect(data.data.orders.length).toBeGreaterThan(0);
    expect(data.data.pagination).toBeDefined();
  });

  it("berhasil filter supply orders berdasarkan supplierId", async () => {
    const response = await fetch(`${API_BASE}/pasokan/orders?supplierId=${supplierId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);

    data.data.orders.forEach((o: any) => {
      expect(o.supplierId).toBe(supplierId);
    });
  });
});

describe("GET /api/pasokan/orders/:id", () => {
  let adminToken: string;
  let orderId: string;
  let supplierId: string;
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

    // Create supplier
    const suppId = `supp_${Date.now()}_test`;
    await db.insert(suppliers).values({
      id: suppId,
      name: "Supplier Test",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    supplierId = suppId;

    // Create product
    productId = await createTestProduct();

    // Create order
    const oid = `supo_${Date.now()}_test`;
    await db.insert(supplyOrders).values({
      id: oid,
      orderNumber: "SUP-20260219_TEST",
      supplierId,
      orderDate: new Date().toISOString().split("T")[0],
      totalAmount: 100000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    orderId = oid;

    await db.insert(supplyOrderItems).values({
      id: `supi_${Date.now()}_test`,
      supplyOrderId: oid,
      productId,
      quantity: 10,
      purchasePrice: 10000,
      subtotal: 100000,
      createdAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get detail supply order dengan items", async () => {
    const response = await fetch(`${API_BASE}/pasokan/orders/${orderId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.orderNumber).toBe("SUP-20260219_TEST");
    expect(data.data.items).toBeDefined();
    expect(data.data.items.length).toBe(1);
  });

  it("gagal get order - ID tidak ditemukan", async () => {
    const response = await fetch(`${API_BASE}/pasokan/orders/supo_nonexistent`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Pasokan tidak ditemukan");
  });
});

describe("GET /api/pasokan/orders/:id/items", () => {
  let adminToken: string;
  let orderId: string;
  let supplierId: string;
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

    // Create supplier
    const suppId = `supp_${Date.now()}_test`;
    await db.insert(suppliers).values({
      id: suppId,
      name: "Supplier Test",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    supplierId = suppId;

    // Create product
    productId = await createTestProduct();

    // Create order
    const oid = `supo_${Date.now()}_items`;
    await db.insert(supplyOrders).values({
      id: oid,
      orderNumber: "SUP-20260219_ITEMS",
      supplierId,
      orderDate: new Date().toISOString().split("T")[0],
      totalAmount: 200000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    orderId = oid;

    await db.insert(supplyOrderItems).values({
      id: `supi_${Date.now()}_1`,
      supplyOrderId: oid,
      productId,
      quantity: 10,
      purchasePrice: 10000,
      subtotal: 100000,
      createdAt: new Date().toISOString(),
    });

    await db.insert(supplyOrderItems).values({
      id: `supi_${Date.now()}_2`,
      supplyOrderId: oid,
      productId,
      quantity: 10,
      purchasePrice: 10000,
      subtotal: 100000,
      createdAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("berhasil get items dari supply order", async () => {
    const response = await fetch(`${API_BASE}/pasokan/orders/${orderId}/items`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.orderId).toBe(orderId);
    expect(data.data.items.length).toBe(2);
  });
});
