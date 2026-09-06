import { ApiResponse } from './api.model';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export type DisputeAction = 'resolve' | 'reject';

export interface CreateDisputePayload {
  reason: string;
  description: string;
  evidence?: string[];
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
