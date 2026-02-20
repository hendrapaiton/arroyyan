import { z } from "zod";

/**
 * Schema untuk item penjualan
 */
export const saleItemSchema = z.object({
  productId: z.string().min(1, "Product ID wajib diisi"),
  quantity: z.number().int().min(1, "Quantity minimal 1"),
});

/**
 * Schema untuk create penjualan baru
 */
export const createSaleSchema = z.object({
  saleDate: z.string().optional(), // ISO date format, default today
  referenceNumber: z.string().max(50, "Nomor referensi maksimal 50 karakter").optional().or(z.literal("")),
  notes: z.string().max(500, "Catatan maksimal 500 karakter").optional().or(z.literal("")),
  paymentMethod: z.enum(["cash", "qris"], {
    errorMap: () => ({ message: "Payment method harus 'cash' atau 'qris'" }),
  }),
  paidAmount: z.number().min(0, "Jumlah pembayaran tidak boleh negatif"),
  items: z
    .array(saleItemSchema)
    .min(1, "Minimal 1 item")
    .max(100, "Maksimal 100 items per transaksi"),
});

/**
 * Schema untuk query parameters (filter & pagination)
 */
export const salesQuerySchema = z.object({
  startDate: z.string().optional(), // ISO date
  endDate: z.string().optional(), // ISO date
  cashierId: z.string().optional(),
  paymentMethod: z.enum(["cash", "qris"]).optional(),
  page: z.string().transform((val) => parseInt(val) || 1).default("1"),
  limit: z.string().transform((val) => parseInt(val) || 20).default("20"),
});

/**
 * Schema for cashier stats query
 */
export const cashierQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * Type inference dari schema
 */
export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SalesQueryInput = z.infer<typeof salesQuerySchema>;
export type CashierQueryInput = z.infer<typeof cashierQuerySchema>;
