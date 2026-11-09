import { ApiResponse } from './api.model';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export type DisputeAction = 'resolve' | 'reject';

export interface CreateDisputePayload {
  reason: string;
  description: string;
  evidence?: string[];
  /** The stage the dispute is about (required by the server whenever the project has a disputable stage). */
  stageId?: string;
  /** What the opener asks for (a request only: the admin decides). */
  requestedResolution?: RequestedResolutionCode;
  /** Supporting files (JPG/PNG/PDF, up to 5, 10 MB each), sent in the same request so the dispute and its evidence are saved together. */
  files?: File[];
  /** One UUID per submit: a repeated submit with it returns the dispute it already created instead of a second one. */
  submissionKey?: string;
  _count?: { attachments: number };
}

export type RequestedResolutionCode = 'REDELIVER_WITH_FIXES' | 'PARTIAL_REFUND' | 'FULL_REFUND' | 'ACCEPT_DELIVERY' | 'EXTEND_DEADLINE' | 'CLARIFY_SCOPE' | 'OTHER';

/** The codes are the server's; the wording is shown to the opener. These are requests, never settlements. */
export const REQUESTED_RESOLUTIONS: Record<'client' | 'provider', { code: RequestedResolutionCode; label: string }[]> = {
  client: [
    { code: 'REDELIVER_WITH_FIXES', label: 'أطلب إعادة التسليم بالتعديلات المطلوبة' },
    { code: 'PARTIAL_REFUND', label: 'أطلب استردادًا جزئيًا' },
    { code: 'FULL_REFUND', label: 'أطلب استردادًا كاملًا للمرحلة' },
    { code: 'OTHER', label: 'أطلب حلًّا آخر تقرره الإدارة' },
  ],
  provider: [
    { code: 'ACCEPT_DELIVERY', label: 'أطلب اعتماد التسليم' },
    { code: 'EXTEND_DEADLINE', label: 'أطلب تمديد مدة المرحلة' },
    { code: 'CLARIFY_SCOPE', label: 'أطلب توضيح نطاق العمل المتفق عليه' },
    { code: 'OTHER', label: 'أطلب حلًّا آخر تقرره الإدارة' },
  ],
};

/** A stage offered by the dispute dialog: `canDispute` / `blockedReason` come from the server's own stage rule. */
export interface DisputeStageOption {
  id: string;
  label: string;
  canDispute: boolean;
  blockedReason?: string | null;
}

/** Field problems the server reports (`errors: [{ field, message }]`), shown under the matching field. */
export interface DisputeFieldError { field: string; message: string }

/** Smallest description the server accepts for a dispute about a stage (the dialog shows the same counter). */
export const STAGE_DISPUTE_MIN_DESCRIPTION = 100;

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
  _count?: { attachments: number };
  /** The stage the dispute is about (null for a project-level dispute). */
  stage?: { id: string; stepOrder: number; title: string; status: string; amount: number } | null;
  stageId?: string | null;
  requestedResolution?: RequestedResolutionCode | null;
  /** Detail endpoints: Arabic wording of `requestedResolution`. */
  requestedResolutionLabel?: string | null;
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
  assignedTo?: { id: string; name: string; escalationReason?: string } | null;
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
  followUpCount?: number;
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
  followUp?: boolean;
  status?: DisputeStatus;
  /** Admin queue search: dispute number (full or the short `#3f6fa186` prefix) or a request / project reference. */
  q?: string;
  /** `me`, `unassigned` or a staff user id. */
  assignee?: string;
  /** Creation period, `YYYY-MM-DD` (UTC, inclusive). */
  createdFrom?: string;
  createdTo?: string;
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
