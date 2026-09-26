import { ApiResponse } from './api.model';

export type AccreditationStatus = 'PENDING_AI_AUDIT' | 'AI_VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';

export interface AccreditationProviderUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  accountType?: string | null;
  status?: string | null;
}

export interface AccreditationProviderProfile {
  id: string;
  userId: string;
  user?: AccreditationProviderUser;
}

export interface AccreditationSpecialtyRef {
  id: string;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  icon?: string | null;
}

export interface AccreditationProviderSpecialty {
  id: string;
  status?: string | null;
  isPassed?: boolean | null;
  // Only present on the single-sample detail response, not the list response.
  aiScore?: number | null;
  ownershipCredibility?: number | null;
  badgeGrantedAt?: string | null;
  specialty?: AccreditationSpecialtyRef;
}

export interface AccreditationSample {
  id: string;
  providerProfileId: string;
  providerSpecialtyId: string;
  title: string;
  description: string;
  projectUrl?: string | null;
  githubUrl?: string | null;
  technologiesUsed: string[];
  attachments: string[];
  status: AccreditationStatus;
  // Real AI fields returned by the backend (accreditation-ai.service.ts).
  // Do not add overallAiScore/aiDecisionSummary/aiAuthenticityScore/
  // aiDetectedQualityScore/aiTechnicalAnalysis — those belong to an unused,
  // dead Prisma model (AccreditationSubmission) never populated by any code
  // path; the live model is AccreditationSample with the fields below.
  aiScore?: number | null;
  aiQualityRating?: string | null;
  aiFeedbackAr?: string | null;
  aiStrengths?: string[];
  aiRecommendations?: string[];
  aiAuditedAt?: string | null;
  viewsCount?: number;
  rating?: number | null;
  reviewsCount?: number;
  offersGenerated?: number;
  offersAccepted?: number;
  createdAt: string;
  updatedAt?: string;
  providerProfile?: AccreditationProviderProfile;
  providerSpecialty?: AccreditationProviderSpecialty;
}

export interface AccreditationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AccreditationListData {
  items: AccreditationSample[];
  pagination: AccreditationPagination;
}

export interface AdminAccreditationsQuery {
  status?: AccreditationStatus;
  page?: number;
  limit?: number;
}

export interface RejectAccreditationPayload {
  rejectionReason: string;
}

export type AccreditationListApiResponse = ApiResponse<AccreditationListData>;
export type AccreditationDetailApiResponse = ApiResponse<AccreditationSample>;
export type AccreditationActionApiResponse = ApiResponse<AccreditationSample>;
