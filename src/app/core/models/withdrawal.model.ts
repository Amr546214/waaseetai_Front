import { ApiResponse } from './api.model';

/**
 * Withdrawal status values inferred from domain context.
 * Swagger does not define an enum for this; keep flexible with `| string`.
 */
export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'REJECTED' | 'COMPLETED' | 'REVERSED' | string;

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
  /** PayPal destination snapshot of a 'paypal' withdrawal (when the API returns it). */
  paypalEmail?: string;
  adminNote?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  processedAt?: string | null;
  // Admin detail only (GET /api/admin/withdrawals/:id) — real withdrawable
  // balance for this withdrawal's ledger (provider earnings or affiliate
  // commissions), computed server-side. Not present on list responses.
  availableBalance?: number;
  /** Admin detail only: latest PayPal payout attempts (empty while payout automation is off). */
  payoutAttempts?: { id: string; status: string; createdAt: string; updatedAt: string }[];
  /** Admin detail only: whether the server can send a PayPal payout (PAYOUT_AUTOMATION_ENABLED). */
  payoutAutomationEnabled?: boolean;
  /** Admin list/detail: the owner as the API returns it. */
  user?: { id: string; firstName?: string; lastName?: string; email?: string; accountType?: string; affiliateProfile?: { id: string } | null } | null;
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
  /** Admin list: count + total amount per status over the whole table. */
  counts?: Record<string, { count: number; amount: number }>;
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
  /** provider = provider earnings withdrawals, affiliate = marketer commission withdrawals. */
  owner?: 'provider' | 'affiliate';
  page?: number;
  limit?: number;
}

/**
 * Optional payload for POST /api/admin/withdrawals/:id/approve.
 * Swagger example: { "adminNote": "تمت مراجعة الطلب" }
 */
export interface ApproveWithdrawalPayload {
  adminNote?: string;
}

/**
 * Required payload for POST /api/admin/withdrawals/:id/reject.
 * Swagger example: { "rejectionReason": "بيانات الطلب غير مكتملة" }
 */
export interface RejectWithdrawalPayload {
  rejectionReason: string;
}

// ── Provider-side types ───────────────────────────────────────────────

/**
 * Payload for POST /api/provider/finance/withdrawals.
 * PayPal is the only withdrawal method; the destination is the PayPal email saved in the profile.
 */
export interface ProviderWithdrawalPayload {
  amount: number;
  method?: string;
}

/**
 * Wallet summary returned by GET /api/provider/finance/wallet.
 * Mirrors the shape already consumed by the provider Wallet page.
 */
export interface ProviderWalletSummary {
  /** Total released earnings. What a new request may still ask for is `withdrawableBalance`. */
  availableBalance?: number;
  /** In review / payout pipeline (PENDING, APPROVED, PROCESSING). */
  pendingWithdrawals?: number;
  /** Already paid out (COMPLETED) or paid then reversed. */
  paidWithdrawals?: number;
  /** availableBalance minus pending and paid withdrawals: the same figure the server enforces. */
  withdrawableBalance?: number;
  totalEarnings?: number;
  escrowBalance?: number;
  releasedThisMonth?: number;
  releasedTransactionsCount?: number;
  fundedProjectsCount?: number;
  completedProjectsCount?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface ProviderWalletData {
  summary?: ProviderWalletSummary;
  transactions?: unknown[];
  escrows?: unknown[];
  [key: string]: unknown;
}

export type ProviderWalletApiResponse = ApiResponse<ProviderWalletData>;
export type ProviderWithdrawalApiResponse = ApiResponse<Withdrawal>;
export type ProviderWithdrawalListApiResponse = ApiResponse<WithdrawalListData>;

// ── Legacy rows ───────────────────────────────────────────────────────

/** Shown instead of any destination of an old (pre PayPal-only) withdrawal row. */
export const LEGACY_WITHDRAWAL_LABEL = 'طلب قديم — بيانات وسيلة السحب غير معروضة';

/** True for a row whose method is not PayPal or that still carries legacy destination data. */
export function isLegacyWithdrawal(w: Withdrawal): boolean {
  const method = String(w.method ?? '').trim().toLowerCase();
  if (method && method !== 'paypal') return true;
  return ['bankInfo', 'iban', 'accountName', 'accountNumber'].some((k) => w[k] != null && w[k] !== '');
}

// ── API response types ────────────────────────────────────────────────

export type WithdrawalApiResponse = ApiResponse<Withdrawal>;
export type WithdrawalListApiResponse = ApiResponse<WithdrawalListData>;
