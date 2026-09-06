import { ApiResponse } from './api.model';

/**
 * Withdrawal status values inferred from domain context.
 * Swagger does not define an enum for this; keep flexible with `| string`.
 */
export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | string;

/**
 * Bank info attached to a withdrawal request.
 * Fields are optional because Swagger does not define this schema.
 */
export interface WithdrawalBankInfo {
  bankName?: string;
  accountHolderName?: string;
  iban?: string;
  swiftCode?: string;
  [key: string]: unknown;
}

/**
 * Single withdrawal record.
 * Swagger references `WithdrawalResponse` but does not define the schema.
 * All fields except `id` are optional to stay safe against unknown backend shape.
 */
export interface Withdrawal {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  amount?: number;
  currency?: string;
  status?: WithdrawalStatus;
  method?: string;
  bankInfo?: WithdrawalBankInfo;
  adminNote?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  processedAt?: string | null;
  [key: string]: unknown;
}

/**
 * Pagination metadata returned by the list endpoint.
 * Field names inferred from the disputes pattern; may differ on backend.
 */
export interface WithdrawalPagination {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  pages?: number;
}

/**
 * Response shape for GET /api/admin/withdrawals.
 * Swagger references `WithdrawalListResponse` but does not define it.
 * The items array and pagination may use different key names on the backend.
 */
export interface WithdrawalListData {
  withdrawals?: Withdrawal[];
  items?: Withdrawal[];
  pagination?: WithdrawalPagination;
  total?: number;
  page?: number;
  limit?: number;
  pages?: number;
  totalPages?: number;
  [key: string]: unknown;
}

/**
 * Query parameters for the admin withdrawals list endpoint.
 */
export interface AdminWithdrawalsQuery {
  status?: string;
  page?: number;
  limit?: number;
}

/**
 * Optional payload for POST /api/admin/withdrawals/:id/approve.
 * Swagger example: { "adminNote": "تمت مراجعة البيانات البنكية" }
 */
export interface ApproveWithdrawalPayload {
  adminNote?: string;
}

/**
 * Required payload for POST /api/admin/withdrawals/:id/reject.
 * Swagger example: { "rejectionReason": "البيانات البنكية غير مكتملة" }
 */
export interface RejectWithdrawalPayload {
  rejectionReason: string;
}

// ── API response types ────────────────────────────────────────────────

export type WithdrawalApiResponse = ApiResponse<Withdrawal>;
export type WithdrawalListApiResponse = ApiResponse<WithdrawalListData>;
