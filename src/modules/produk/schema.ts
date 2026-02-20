import { z } from "zod";

/**
 * Schema untuk create produk baru
 */
export const createProductSchema = z.object({
  name: z.string().min(3).max(100, "Nama produk maksimal 100 karakter"),
  sku: z
    .string()
    .min(1, "SKU wajib diisi")
    .max(7, "SKU maksimal 7 karakter")
    .toUpperCase()
    .regex(/^[A-Z0-9]+$/, "SKU harus alphanumeric (huruf besar dan angka)"),
  sellingPrice: z.number().min(1000, "Harga jual minimal Rp 1.000"),
});

/**
 * Schema untuk update produk
 * Semua field optional karena partial update
 * SKU tidak bisa diubah
 */
export const updateProductSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  sellingPrice: z.number().min(1000).optional(),
});

/**
 * Schema untuk query parameters (filter & search)
 */
export const productQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined))
    .optional(),
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("20"),
});

/**
 * Type inference dari schema
 */
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
