import { z } from "zod";

/**
 * Schema untuk create supplier baru
 */
export const createSupplierSchema = z.object({
  name: z.string().min(3, "Nama supplier minimal 3 karakter").max(100, "Nama supplier maksimal 100 karakter"),
  contactPerson: z.string().max(50, "Nama kontak person maksimal 50 karakter").optional().or(z.literal("")),
  phone: z.string().max(20, "Nomor telepon maksimal 20 karakter").optional().or(z.literal("")),
  address: z.string().max(100, "Alamat maksimal 100 karakter").optional().or(z.literal("")),
});

/**
 * Schema untuk update supplier
 * Semua field optional karena partial update
 */
export const updateSupplierSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  contactPerson: z.string().max(50).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  address: z.string().max(100).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

/**
 * Schema untuk item pasokan
 */
export const supplyOrderItemSchema = z.object({
  productId: z.string().min(1, "Product ID wajib diisi"),
  quantity: z.number().int().min(1, "Quantity minimal 1"),
  purchasePrice: z.number().min(1000, "Harga beli minimal Rp 1.000"),
});

/**
 * Schema untuk create pasokan baru
 */
export const createSupplyOrderSchema = z.object({
  supplierId: z.string().min(1, "Supplier ID wajib diisi"),
  orderDate: z.string().optional(), // ISO date format, default today
  notes: z.string().max(500, "Catatan maksimal 500 karakter").optional().or(z.literal("")),
  items: z.array(supplyOrderItemSchema).min(1, "Minimal 1 item pasokan"),
});

/**
 * Schema untuk query parameters (filter & search)
 */
export const supplierQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined))
    .optional(),
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("20"),
});

/**
 * Schema untuk filter supply orders
 */
export const supplyOrderQuerySchema = z.object({
  supplierId: z.string().optional(),
  startDate: z.string().optional(), // ISO date
  endDate: z.string().optional(), // ISO date
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("20"),
});

/**
 * Type inference dari schema
 */
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierQueryInput = z.infer<typeof supplierQuerySchema>;
export type SupplyOrderItemInput = z.infer<typeof supplyOrderItemSchema>;
export type CreateSupplyOrderInput = z.infer<typeof createSupplyOrderSchema>;
export type SupplyOrderQueryInput = z.infer<typeof supplyOrderQuerySchema>;
