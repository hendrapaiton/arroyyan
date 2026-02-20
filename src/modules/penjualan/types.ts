/**
 * Module: Penjualan (Point of Sale)
 * TypeScript types & interfaces
 */

import { sales, saleItems } from "../../db/schema";

// ============================================================================
// DATABASE TYPES
// ============================================================================

/**
 * Sale - Main sale transaction record
 */
export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;

/**
 * Sale Item - Individual item in a sale
 */
export type SaleItem = typeof saleItems.$inferSelect;
export type NewSaleItem = typeof saleItems.$inferInsert;

// ============================================================================
// API REQUEST TYPES
// ============================================================================

/**
 * Input for creating a new sale
 */
export interface CreateSaleRequest {
  saleDate?: string; // ISO date format (YYYY-MM-DD)
  referenceNumber?: string;
  notes?: string;
  paymentMethod: "cash" | "qris";
  paidAmount: number;
  items: SaleItemRequest[];
}

/**
 * Individual item in a sale request
 */
export interface SaleItemRequest {
  productId: string;
  quantity: number;
}

/**
 * Query parameters for listing sales
 */
export interface ListSalesQuery {
  startDate?: string;
  endDate?: string;
  cashierId?: string;
  paymentMethod?: "cash" | "qris";
  page?: number;
  limit?: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Sale with full details (includes items and cashier info)
 */
export interface SaleDetailResponse {
  id: string;
  saleNumber: string;
  saleDate: string;
  referenceNumber: string | null;
  totalAmount: number;
  paymentMethod: "cash" | "qris";
  paidAmount: number;
  changeAmount: number;
  notes: string | null;
  cashierId: string | null;
  cashier?: {
    id: string;
    username: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  items: SaleItemDetail[];
}

/**
 * Individual item with product details
 */
export interface SaleItemDetail {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    sellingPrice: number;
  };
}

/**
 * Paginated list of sales
 */
export interface ListSalesResponse {
  sales: SaleDetailResponse[];
  pagination: PaginationInfo;
}

/**
 * Pagination metadata
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Sales statistics response
 */
export interface SalesStatsResponse {
  totalTransactions: number;
  totalRevenue: number;
  totalItemsSold: number;
  averageTransactionValue: number;
  cashTransactions: number;
  qrisTransactions: number;
  topProducts: TopProduct[];
}

/**
 * Top product information
 */
export interface TopProduct {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: number;
  revenue: number;
}

/**
 * Today's summary response
 */
export interface TodaySummaryResponse {
  date: string;
  totalTransactions: number;
  totalRevenue: number;
  totalItemsSold: number;
  cashRevenue: number;
  qrisRevenue: number;
  openingStock: number;
  closingStock: number;
  stockMoved: number;
}

/**
 * Cashier sales response
 */
export interface CashierSalesResponse {
  cashier: {
    id: string;
    username: string;
    name: string;
  } | null;
  totalTransactions: number;
  totalRevenue: number;
  totalItemsSold: number;
  sales: SaleDetailResponse[];
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error codes for sale operations
 */
export enum SaleErrorCode {
  INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK",
  INVALID_PRODUCT = "INVALID_PRODUCT",
  SALE_NOT_FOUND = "SALE_NOT_FOUND",
  PAYMENT_ERROR = "PAYMENT_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

/**
 * Standard error response
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: SaleErrorCode;
  details?: unknown;
}

// ============================================================================
// SUCCESS RESPONSE TYPES
// ============================================================================

/**
 * Generic success response wrapper
 */
export interface SuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
}

/**
 * Create sale success response
 */
export interface CreateSaleResponse extends SuccessResponse<SaleDetailResponse> {
  message: "Transaksi penjualan berhasil dibuat";
}

/**
 * List sales success response
 */
export interface ListSalesSuccessResponse extends SuccessResponse<ListSalesResponse> {}

/**
 * Get sale detail success response
 */
export interface GetSaleResponse extends SuccessResponse<SaleDetailResponse> {}

/**
 * Get sales stats success response
 */
export interface GetSalesStatsResponse extends SuccessResponse<SalesStatsResponse> {}

/**
 * Get today summary success response
 */
export interface GetTodaySummaryResponse extends SuccessResponse<TodaySummaryResponse> {}

/**
 * Get cashier sales success response
 */
export interface GetCashierSalesResponse extends SuccessResponse<CashierSalesResponse> {}
