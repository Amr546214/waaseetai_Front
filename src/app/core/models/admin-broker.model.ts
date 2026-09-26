import { ApiResponse } from './api.model';

// Real backend shape only (waseetai-backend GET /admin/brokers). No
// aiFlag/aiNotes/aiScore/netLevel (fictional 15-level MLM structure) field
// exists here on purpose — none of that has a real backend source.

export type BrokerUserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'SUSPENDED_REVIEW';

export interface AdminBrokerListItem {
  id: string;
  name: string | null;
  email: string;
  referralSlug: string | null;
  level: string;
  status: BrokerUserStatus;
  joinedAt: string;
  totalReferrals: number;
  convertedReferrals: number;
  conversionRate: number;
  paidCommission: number;
  pendingCommission: number;
  channelCount: number;
}

export interface AdminBrokerChannel {
  platform: string;
  handle: string;
  url: string | null;
}

export interface AdminBrokerChannelMetric {
  channel: string;
  visitors: number;
  clients: number;
  conversionPercentage: number;
}

export interface AdminBrokerCustomLink {
  channelName: string;
  utmSource: string;
  customSlug: string | null;
  createdAt: string;
}

export interface AdminBrokerRecentCommission {
  type: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  referredUserName: string | null;
}

export interface AdminBrokerDetail extends AdminBrokerListItem {
  channels: AdminBrokerChannel[];
  channelMetrics: AdminBrokerChannelMetric[];
  customLinks: AdminBrokerCustomLink[];
  recentCommissions: AdminBrokerRecentCommission[];
}

export interface AdminBrokerPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminBrokerListData {
  items: AdminBrokerListItem[];
  pagination: AdminBrokerPagination;
}

export interface AdminBrokersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: BrokerUserStatus;
}

export type AdminBrokerListApiResponse = ApiResponse<AdminBrokerListData>;
export type AdminBrokerDetailApiResponse = ApiResponse<AdminBrokerDetail>;
