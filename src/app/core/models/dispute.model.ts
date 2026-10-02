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
}

export interface DisputePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DisputeListData {
  items: Dispute[];
  pagination: DisputePagination;
}

export interface ResolveDisputePayload {
  action: DisputeAction;
  resolution: string;
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
