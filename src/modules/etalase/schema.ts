import { z } from "zod";

/**
 * Schema untuk item transfer
 */
export const transferItemSchema = z.object({
  productId: z.string().min(1, "Product ID wajib diisi"),
  quantity: z.number().int().min(1, "Quantity minimal 1"),
});

/**
 * Schema untuk create transfer baru
 */
export const createTransferSchema = z.object({
  transferDate: z.string().optional(), // ISO date format, default today
  notes: z.string().max(500, "Catatan maksimal 500 karakter").optional().or(z.literal("")),
  items: z
    .array(transferItemSchema)
    .min(1, "Minimal 1 item transfer")
    .max(50, "Maksimal 50 items per transfer"),
});

/**
 * Schema untuk query parameters (filter & pagination)
 */
export const transferQuerySchema = z.object({
  startDate: z.string().optional(), // ISO date
  endDate: z.string().optional(), // ISO date
  performedBy: z.string().optional(),
  page: z.string().transform((val) => parseInt(val) || 1).default("1"),
  limit: z.string().transform((val) => parseInt(val) || 20).default("20"),
});

/**
 * Schema untuk restock suggestions query
 */
export const restockQuerySchema = z.object({
  minWarehouseStock: z
    .string()
    .transform((val) => parseInt(val) || 10)
    .default("10"),
});

/**
 * Type inference dari schema
 */
export type TransferItemInput = z.infer<typeof transferItemSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type TransferQueryInput = z.infer<typeof transferQuerySchema>;
export type RestockQueryInput = z.infer<typeof restockQuerySchema>;
