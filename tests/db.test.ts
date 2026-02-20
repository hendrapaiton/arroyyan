import { expect, test, describe } from "bun:test";
import { db } from "../src/db/local";
import { sql } from "drizzle-orm";

describe("Database Initialization", () => {
  test("should connect to sqlite database and execute a simple query", async () => {
    // Menjalankan query sederhana 'SELECT 1' untuk memastikan koneksi aktif
    const result = await db.run(sql`SELECT 1`);

    expect(result).toBeDefined();
    // Bun:sqlite .run() mengembalikan object dengan info metadata,
    // tapi jika tidak error berarti inisialisasi berhasil.
  });
});
