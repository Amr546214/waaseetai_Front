import { ApiResponse } from './api.model';

// ── Client Onboarding ────────────────────────────────────────────────

export type OnboardingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | string;

export interface OnboardingRequest {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  documentType?: string;
  documentName?: string;
  documentUrl?: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  selfieUrl?: string;
  status?: OnboardingStatus;
  rejectionReason?: string | null;
  adminNote?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface OnboardingListResponse {
  onboardingRequests?: OnboardingRequest[];
  items?: OnboardingRequest[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  pages?: number;
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    pages?: number;
  };
}

export interface OnboardingQuery {
  page?: number;
  limit?: number;
  status?: string;
}

// ── Provider KYC ─────────────────────────────────────────────────────

export type KycStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | string;

export interface KycProvider {
  userId: string;
  id?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  accountType?: string;
  kycStatus?: KycStatus;
  isVerified?: boolean;
  isProfileSetupComplete?: boolean;
  frontIdUrl?: string | null;
  backIdUrl?: string | null;
  selfieUrl?: string | null;
  certUrls?: string[] | null;
  supportingDocsUrl?: string | null;
  bankName?: string | null;
  iban?: string | null;
  accountNumber?: string | null;
  accountHolderName?: string | null;
  notes?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface KycProviderListResponse {
  providers?: KycProvider[];
  items?: KycProvider[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  pages?: number;
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    pages?: number;
  };
}

export interface KycProviderQuery {
  page?: number;
  limit?: number;
  status?: string;
}

// ── Action payloads ──────────────────────────────────────────────────

export interface RejectPayload {
  rejectionReason: string;
}

export interface ApprovePayload {
  adminNote?: string;
}

// ── API response wrappers ────────────────────────────────────────────

export type OnboardingListApiResponse = ApiResponse<OnboardingListResponse>;
export type OnboardingApiResponse = ApiResponse<OnboardingRequest>;
export type KycProviderListApiResponse = ApiResponse<KycProviderListResponse>;
export type KycProviderApiResponse = ApiResponse<KycProvider>;
export type ActionApiResponse = ApiResponse<OnboardingRequest | KycProvider>;
