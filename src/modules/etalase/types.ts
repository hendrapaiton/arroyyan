/**
 * Module: Etalase (Stock Transfer)
 * TypeScript types & interfaces
 */

import {
  stockTransfers,
  stockTransferItems,
  inventory,
  products,
  users,
} from "../../db/schema";

// ============================================================================
// DATABASE TYPES
// ============================================================================

/**
 * Stock Transfer - Main transfer record
 */
export type StockTransfer = typeof stockTransfers.$inferSelect;
export type NewStockTransfer = typeof stockTransfers.$inferInsert;

/**
 * Stock Transfer Item - Individual item in a transfer
 */
export type StockTransferItem = typeof stockTransferItems.$inferSelect;
export type NewStockTransferItem = typeof stockTransferItems.$inferInsert;

// ============================================================================
// API REQUEST TYPES
// ============================================================================

/**
 * Input for creating a new transfer
 */
export interface CreateTransferRequest {
  transferDate?: string; // ISO date format (YYYY-MM-DD)
  notes?: string;
  items: TransferItemRequest[];
}

/**
 * Individual item in a transfer request
 */
export interface TransferItemRequest {
  productId: string;
  quantity: number;
}

/**
 * Query parameters for listing transfers
 */
export interface ListTransfersQuery {
  startDate?: string;
  endDate?: string;
  performedBy?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Transfer with full details (includes items and user info)
 */
export interface TransferDetailResponse {
  id: string;
  transferNumber: string;
  transferDate: string;
  notes: string | null;
  performedBy: string | null;
  performedByUser?: {
    id: string;
    username: string;
    name: string;
  } | null;
  createdAt: string;
  items: TransferItemDetail[];
}

/**
 * Individual item with product details
 */
export interface TransferItemDetail {
  id: string;
  productId: string;
  quantity: number;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
}

/**
 * Paginated list of transfers
 */
export interface ListTransfersResponse {
  transfers: TransferDetailResponse[];
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
 * Stock statistics response
 */
export interface StockStatsResponse {
  totalProducts: number;
  totalWarehouseStock: number;
  totalDisplayStock: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

/**
 * Restock suggestion item
 */
export interface RestockSuggestion {
  productId: string;
  productName: string;
  sku: string;
  warehouseStock: number;
  displayStock: number;
  suggestedQuantity: number;
}

/**
 * Restock suggestions response
 */
export interface RestockSuggestionsResponse {
  suggestions: RestockSuggestion[];
  count: number;
}

// ============================================================================
// INVENTORY TYPES
// ============================================================================

/**
 * Inventory with product info
 */
export interface InventoryWithProduct {
  id: string;
  productId: string;
  warehouseStock: number;
  displayStock: number;
  lastStockUpdate: string;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    isActive: boolean;
  };
}

/**
 * Stock summary for a single product
 */
export interface ProductStock {
  productId: string;
  productName: string;
  sku: string;
  warehouseStock: number;
  displayStock: number;
  totalStock: number;
  lastStockUpdate: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error codes for transfer operations
 */
export enum TransferErrorCode {
  INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK",
  INVALID_PRODUCT = "INVALID_PRODUCT",
  TRANSFER_NOT_FOUND = "TRANSFER_NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

/**
 * Standard error response
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: TransferErrorCode;
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
 * Create transfer success response
 */
export interface CreateTransferResponse extends SuccessResponse<TransferDetailResponse> {
  message: "Transfer stok berhasil dibuat";
}

/**
 * List transfers success response
 */
export interface ListTransfersSuccessResponse
  extends SuccessResponse<ListTransfersResponse> {}

/**
 * Get transfer detail success response
 */
export interface GetTransferResponse extends SuccessResponse<TransferDetailResponse> {}

/**
 * Get stock stats success response
 */
export interface GetStockStatsResponse extends SuccessResponse<StockStatsResponse> {}

/**
 * Get restock suggestions success response
 */
export interface GetRestockSuggestionsResponse
  extends SuccessResponse<RestockSuggestionsResponse> {}
