import { ApiResponse } from './api.model';

// Real backend shape only (waseetai-backend GET /client/profile/public/:id).
// Batch 6 — replaces the previous frontend-only buildMockClientProfile()
// (hardcoded aiTrust 94/97/89 + a fabricated "97% payment rate"
// recommendation string). No "aiTrust"/"trustLabel"/"commitmentRate"/
// "aiRecommendation"/project-history/budgetRange/avgSpend field exists here
// on purpose — none of that has a real backend source. providerRatingAverage
// is null (not 0) when the client genuinely has no provider reviews yet.

export interface ClientPublicProfileStats {
  completedProjects: number;
  activeProjects: number;
  totalContracts: number;
  providerReviewsCount: number;
  providerRatingAverage: number | null;
}

export interface ClientPublicProfileReview {
  rating: number;
  comment: string | null;
  createdAt: string;
  providerName: string | null;
}

export interface ClientPublicProfile {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  memberSince: string;
  isVerified: boolean;
  stats: ClientPublicProfileStats;
  reviewsFromProviders: ClientPublicProfileReview[];
}

export type ClientPublicProfileApiResponse = ApiResponse<ClientPublicProfile>;
