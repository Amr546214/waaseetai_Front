import { ApiResponse } from './api.model';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export type DisputeAction = 'resolve' | 'reject';

export interface CreateDisputePayload {
  reason: string;
  description: string;
  evidence?: string[];
}

export interface DisputePartyRef {
  id: string;
  firstName?: string;
  lastName?: string;
}

export interface Dispute {
  id: string;
  requestId?: string | null;
  projectId?: string | null;
  status: DisputeStatus;
  reason: string;
  description: string;
  evidence?: string[];
  resolution?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  // Included by GET /client/disputes, /provider/disputes, and their :id
  // detail routes (own-disputes endpoints) — not present on every response.
  openedById?: string;
  openedBy?: DisputePartyRef;
  againstUserId?: string | null;
  againstUser?: DisputePartyRef | null;
  request?: { id: string; title?: string } | null;
  /** Set for disputes on contract-backed (marketplace) projects, which have no ClientRequest. */
  project?: { id: string; title?: string } | null;
  /** Escrow still held for the dispute's project (own-disputes endpoints only; null = none/unknown, absent on an older backend). */
  heldEscrowAmount?: number | null;
  /** Admin endpoints only: current assignee (from the admin audit store). */
  assignedTo?: { id: string; name: string } | null;
  /** Admin detail only: escrow of the dispute's project, straight from the database. */
  escrow?: { status: 'HELD' | 'RELEASED' | 'REFUNDED'; amount: number; releasedAmount: number; fundedAt: string | null } | null;
  contractStatus?: string | null;
  /** Arabic text of `resolution` (codes translated, admin free text verbatim). Prefer it over the raw `resolution`. */
  resolutionLabel?: string;
  /** Set only when a financial decision was really executed (amounts in USD). */
  financialOutcome?: FinancialOutcome | null;
  /** The dispute's project freeze state (approvals/releases frozen while any dispute of it is open). */
  projectFreeze?: ProjectFreeze | null;
  /** Admin detail only: internal notes (never returned to the parties). */
  notes?: { id: string; body: string; createdAt: string; admin: { id: string; name: string } | null }[];
  /** Admin detail only: audit-log timeline of everything an admin did on this dispute. */
  timeline?: { id: string; eventType: string; title: string; summary: string | null; occurredAt: string; admin: { id: string; name: string } | null }[];
}

export interface FinancialOutcome {
  /** the currency of every amount below (the escrow's own) */
  currency?: string;
  outcome: FinancialOutcomeCode;
  refundToClient: number;
  releaseToProvider: number;
  platformCommission: number;
  providerNet: number;
}

export type FinancialOutcomeCode = 'REFUND_CLIENT' | 'RELEASE_PROVIDER' | 'SPLIT';

/** Same shape the progress/workspace endpoints return as `disputeFreeze`. */
export interface ProjectFreeze {
  frozen: boolean;
  activeDisputeCount: number;
  disputeId: string | null;
  disputeStatus?: DisputeStatus | null;
  reason: string | null;
}

export interface DisputePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DisputeListData {
  items: Dispute[];
  /** Admin list only: number of disputes per status over the whole table. */
  counts?: Partial<Record<DisputeStatus, number>>;
  pagination: DisputePagination;
}

export interface ResolveDisputePayload {
  action: DisputeAction;
  resolution: string;
  resolutionNote?: string;
}

/** POST /api/admin/disputes/:id/resolve-financial - the only call that moves money for a dispute. */
export interface ResolveFinancialPayload {
  outcome: FinancialOutcomeCode;
  refundToClient: number;
  releaseToProvider: number;
  expectedHeldAmount: number;
  confirm: true;
  resolutionNote?: string;
}

export interface AdminDisputesQuery {
  status?: DisputeStatus;
  page?: number;
  limit?: number;
}

export type DisputeApiResponse = ApiResponse<Dispute>;
export type DisputeListApiResponse = ApiResponse<DisputeListData>;
export type CreateDisputeApiResponse = ApiResponse<{ id: string }>;
export type ResolveDisputeApiResponse = ApiResponse<Dispute>;
export type ResolveFinancialApiResponse = ApiResponse<Dispute & { financialOutcome: FinancialOutcome }>;

// Advisory-only AI summary (Implementation Batch 2, Part B). Never a
// verdict/fault/money field — the human admin resolve/reject flow above is
// completely separate and is never pre-filled from this.
// Served by WaseetAI. The upstream `recommendation` is intentionally absent:
// the backend drops it and the UI never shows or acts on it.
export interface DisputeAiSummary {
  summary: string;
  clientPerspective: string;
  providerPerspective: string;
}

export type DisputeAiSummaryApiResponse = ApiResponse<DisputeAiSummary>;
