import { ApiResponse } from './api.model';

// Real backend shape only (waseetai-backend GET /marketer/profile/public/:id).
// No followers/engagementRate/monthlyReach/campaigns/audience field exists
// here on purpose — none of that has a real backend source (confirmed via
// the Prisma schema trace). channelMetrics is null (not []) when the
// marketer has not opted in via AffiliateProfile.sharePerformanceStats.

export interface MarketerPublicChannel {
  platform: string;
  handle: string;
  url: string | null;
}

export interface MarketerPublicChannelMetric {
  channel: string;
  visitors: number;
  clients: number;
  conversionPercentage: number;
}

export interface MarketerPublicProfile {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  level: string;
  identityVerified: boolean;
  channels: MarketerPublicChannel[];
  channelMetrics: MarketerPublicChannelMetric[] | null;
}

export type MarketerPublicProfileApiResponse = ApiResponse<MarketerPublicProfile>;
