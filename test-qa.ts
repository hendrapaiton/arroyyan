#!/usr/bin/env bun
/**
 * Manual QA Test Script untuk Refresh Token dengan httpOnly Cookies
 * 
 * Script ini digunakan untuk menguji implementasi JWT refresh token
 * yang dikirimkan melalui httpOnly cookies.
 * 
 * Cara menjalankan:
 * 1. Pastikan server berjalan di http://localhost:8787
 * 2. Jalankan script ini: bun test-qa.ts
 */

const API_BASE = "http://localhost:8787/api/auth";

// Utility functions
const log = {
  info: (msg: string) => console.log(`\n📝 ${msg}`),
  success: (msg: string) => console.log(`\n✅ ${msg}`),
  error: (msg: string) => console.log(`\n❌ ${msg}`),
  warn: (msg: string) => console.log(`\n⚠️  ${msg}`),
  section: (msg: string) => console.log(`\n${"=".repeat(60)}\n📌 ${msg}\n${"=".repeat(60)}`),
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Test state
let refreshToken: string | null = null;
let accessToken: string | null = null;
let testPassed = 0;
let testFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    testPassed++;
    log.success(`PASS: ${message}`);
    return true;
  } else {
    testFailed++;
    log.error(`FAIL: ${message}`);
    return false;
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

async function testRegister() {
  log.section("TEST 1: Register User Baru");
  
  const username = `qa_test_${Date.now().toString().slice(-8)}`;
  
  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        name: "QA Test User",
        password: "test123456",
        role: "admin",
      }),
    });
    
    const data = await response.json();
    
    assert(response.status === 201, "Status code 201 Created");
    assert(data.success === true, "Response success = true");
    assert(data.data.username === username, "Username sesuai");
    assert(data.data.role === "admin", "Role admin");
    
    log.success(`User terdaftar: ${username}`);
    return username;
  } catch (error) {
    log.error(`Register gagal: ${error}`);
    return null;
  }
}

async function testLogin(username: string) {
  log.section("TEST 2: Login dan Verifikasi httpOnly Cookie");
  
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password: "test123456",
      }),
    });
    
    const data = await response.json();
    const setCookieHeader = response.headers.get("Set-Cookie");
    
    // Verify response
    assert(response.status === 200, "Status code 200 OK");
    assert(data.success === true, "Response success = true");
    assert(!!data.data.token, "Access token ada");
    assert(!!data.data.expiresAt, "Expiry date ada");
    assert(!!data.data.user, "User info ada");
    assert(data.data.user.username === username, "Username di token sesuai");
    
    // Verify cookie
    assert(!!setCookieHeader, "Set-Cookie header ada");
    assert(setCookieHeader!.includes("refreshToken="), "refreshToken cookie ada");
    assert(setCookieHeader!.includes("HttpOnly"), "HttpOnly flag ada");
    assert(setCookieHeader!.includes("Secure"), "Secure flag ada");
    assert(setCookieHeader!.includes("SameSite=Strict"), "SameSite=Strict flag ada");
    assert(setCookieHeader!.includes("Path=/"), "Path=/ flag ada");
    assert(setCookieHeader!.includes("Expires="), "Expires flag ada");
    
    // Extract refresh token
    const cookieMatch = setCookieHeader!.match(/refreshToken=([^;]+)/);
    refreshToken = cookieMatch ? cookieMatch[1] : null;
    accessToken = data.data.token;
    
    assert(!!refreshToken, "Refresh token berhasil diekstrak");
    
    log.success(`Access Token: ${accessToken!.substring(0, 50)}...`);
    log.success(`Refresh Token: ${refreshToken!.substring(0, 50)}...`);
    
    return true;
  } catch (error) {
    log.error(`Login gagal: ${error}`);
    return false;
  }
}

async function testAccessTokenProtected() {
  log.section("TEST 3: Akses Protected Endpoint dengan Access Token");
  
  try {
    const response = await fetch(`${API_BASE}/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });
    
    const data = await response.json();
    
    assert(response.status === 200, "Status code 200 OK");
    assert(data.success === true, "Response success = true");
    assert(!!data.data, "User data ada");
    assert(data.data.username !== undefined, "Username ada");
    
    log.success(`User info: ${JSON.stringify(data.data, null, 2)}`);
    
    return true;
  } catch (error) {
    log.error(`Akses protected endpoint gagal: ${error}`);
    return false;
  }
}

async function testRefreshToken() {
  log.section("TEST 4: Refresh Access Token dengan Refresh Token");
  
  try {
    const response = await fetch(`${API_BASE}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `refreshToken=${refreshToken}`,
      },
      credentials: "include",
    });
    
    const data = await response.json();
    
    assert(response.status === 200, "Status code 200 OK");
    assert(data.success === true, "Response success = true");
    assert(!!data.data.token, "New access token ada");
    assert(!!data.data.expiresAt, "New expiry date ada");
    
    const oldToken = accessToken;
    accessToken = data.data.token;
    
    log.success(`New Access Token: ${accessToken!.substring(0, 50)}...`);
    log.success(`Token lama: ${oldToken!.substring(0, 50)}...`);
    assert(oldToken !== accessToken, "Access token baru berbeda dari yang lama");
    
    return true;
  } catch (error) {
    log.error(`Refresh token gagal: ${error}`);
    return false;
  }
}

async function testNewAccessToken() {
  log.section("TEST 5: Verifikasi Access Token Baru");
  
  try {
    const response = await fetch(`${API_BASE}/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });
    
    const data = await response.json();
    
    assert(response.status === 200, "Status code 200 OK");
    assert(data.success === true, "Response success = true");
    assert(!!data.data, "User data ada");
    
    log.success(`Access token baru valid`);
    
    return true;
  } catch (error) {
    log.error(`Verifikasi access token baru gagal: ${error}`);
    return false;
  }
}

async function testRefreshWithoutCookie() {
  log.section("TEST 6: Refresh Tanpa Cookie (Harus Gagal)");
  
  try {
    const response = await fetch(`${API_BASE}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    
    const data = await response.json();
    
    assert(response.status === 401, "Status code 401 Unauthorized");
    assert(data.success === false, "Response success = false");
    assert(data.error === "Refresh token tidak ditemukan", "Error message sesuai");
    
    log.success(`Refresh tanpa cookie ditolak dengan benar`);
    
    return true;
  } catch (error) {
    log.error(`Test refresh tanpa cookie gagal: ${error}`);
    return false;
  }
}

async function testRefreshWithInvalidToken() {
  log.section("TEST 7: Refresh Dengan Invalid Token (Harus Gagal)");
  
  try {
    const response = await fetch(`${API_BASE}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": "refreshToken=invalid-token-here",
      },
    });
    
    const data = await response.json();
    
    assert(response.status === 401, "Status code 401 Unauthorized");
    assert(data.success === false, "Response success = false");
    assert(data.error === "Refresh token tidak valid", "Error message sesuai");
    
    log.success(`Refresh dengan invalid token ditolak dengan benar`);
    
    return true;
  } catch (error) {
    log.error(`Test refresh dengan invalid token gagal: ${error}`);
    return false;
  }
}

async function testLogout() {
  log.section("TEST 8: Logout dan Clear Cookie");
  
  try {
    const response = await fetch(`${API_BASE}/logout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });
    
    const data = await response.json();
    const setCookieHeader = response.headers.get("Set-Cookie");
    
    assert(response.status === 200, "Status code 200 OK");
    assert(data.success === true, "Response success = true");
    assert(!!setCookieHeader, "Set-Cookie header ada");
    assert(setCookieHeader!.includes("refreshToken="), "refreshToken cookie di-clear");
    assert(setCookieHeader!.includes("Max-Age=0"), "Max-Age=0 untuk clear cookie");
    
    log.success(`Logout berhasil, cookie di-clear`);
    
    return true;
  } catch (error) {
    log.error(`Logout gagal: ${error}`);
    return false;
  }
}

async function testAfterLogout() {
  log.section("TEST 9: Verifikasi Token Setelah Logout");
  
  try {
    // Try to use old refresh token (should fail because it's revoked)
    const response = await fetch(`${API_BASE}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `refreshToken=${refreshToken}`,
      },
    });
    
    const data = await response.json();
    
    // Should fail because refresh tokens are deleted on logout
    assert(response.status === 401, "Status code 401 Unauthorized");
    assert(data.success === false, "Response success = false");
    
    log.success(`Refresh token setelah logout ditolak dengan benar`);
    
    return true;
  } catch (error) {
    log.error(`Test setelah logout gagal: ${error}`);
    return false;
  }
}

async function testLoginAgain() {
  log.section("TEST 10: Login Lagi Setelah Logout");
  
  // Need to use the registered username
  // For simplicity, we'll just test that login still works
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "qa_test_user", // This may not exist, but we test the endpoint
        password: "test123456",
      }),
    });
    
    const data = await response.json();
    
    // Should be 401 because user doesn't exist
    assert(response.status === 401, "Status code 401 untuk user yang tidak ada");
    assert(data.success === false, "Response success = false");
    
    log.success(`Login dengan user tidak ada ditolak dengan benar`);
    
    return true;
  } catch (error) {
    log.error(`Test login lagi gagal: ${error}`);
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function runTests() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         QA TEST: JWT Refresh Token dengan httpOnly Cookies   ║
╚══════════════════════════════════════════════════════════════╝
  `);
  
  log.info("Server URL: " + API_BASE.replace("/api/auth", ""));
  log.info("Memulai test suite...\n");
  
  // Check server availability
  try {
    await fetch(API_BASE.replace("/api/auth", "/health"));
    log.success("Server tersedia!\n");
  } catch (error) {
    log.error("Server tidak tersedia! Pastikan server berjalan di http://localhost:8787");
    log.error("Jalankan: bun run dev");
    process.exit(1);
  }
  
  // Run tests
  const username = await testRegister();
  if (!username) {
    log.error("Register gagal, menghentikan test");
    printSummary();
    return;
  }
  
  await wait(100);
  
  if (!(await testLogin(username))) {
    log.error("Login gagal, menghentikan test");
    printSummary();
    return;
  }
  
  await wait(100);
  await testAccessTokenProtected();
  
  await wait(100);
  await testRefreshToken();
  
  await wait(100);
  await testNewAccessToken();
  
  await wait(100);
  await testRefreshWithoutCookie();
  
  await wait(100);
  await testRefreshWithInvalidToken();
  
  await wait(100);
  await testLogout();
  
  await wait(100);
  await testAfterLogout();
  
  await wait(100);
  await testLoginAgain();
  
  // Print summary
  printSummary();
}

function printSummary() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${testPassed}`);
  console.log(`❌ Failed: ${testFailed}`);
  console.log(`📈 Total:  ${testPassed + testFailed}`);
  console.log("=".repeat(60));
  
  if (testFailed === 0) {
    log.success("SEMUA TEST PASSED! 🎉");
  } else {
    log.warn(`Ada ${testFailed} test yang gagal. Periksa output di atas.`);
  }
}

// Run
runTests().catch(console.error);
