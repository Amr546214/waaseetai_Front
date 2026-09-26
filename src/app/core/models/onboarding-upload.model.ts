/**
 * Onboarding Upload Models — Module 5
 *
 * Types for document upload, onboarding setup payloads, and upload progress tracking.
 * These are shared between provider and client onboarding flows.
 */

/** Which onboarding role is uploading documents. */
export type OnboardingUploadTarget = 'provider' | 'client';

/** Document types used across onboarding wizards. */
export type OnboardingDocumentType =
  | 'frontId'
  | 'backId'
  | 'certificates'
  | 'commercialRegistration'
  | 'vatCertificate'
  | 'supportingDocs'
  | 'avatar';

/** Upload status for a single document slot. */
export type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

/** Tracks the state of a single document upload slot in the UI. */
export interface UploadProgressState {
  /** The document slot key (e.g. 'frontId', 'backId'). */
  controlName: string;
  /** Original file name. */
  name: string;
  /** Upload progress percentage 0–100. */
  progress: number;
  /** Current status. */
  status: UploadStatus;
  /** Blob URL for local preview (images/PDF). */
  previewUrl?: string;
  /** MIME type of the file. */
  mimeType?: string;
  /** Backend-returned URL after successful upload. */
  uploadedUrl?: string;
  /** Error message if status === 'error'. */
  error?: string;
}

/** A successfully uploaded document reference. */
export interface UploadedDocument {
  /** Document type slot. */
  type: OnboardingDocumentType;
  /** Backend-returned file URL. */
  url: string;
  /** Backend-returned file name (may differ from original). */
  name: string;
}

/** Response shape from POST /api/provider/profile/documents/upload. */
export interface UploadDocumentResponse {
  success: boolean;
  data: {
    url: string;
    name: string;
  };
  message?: string;
}

/** Document URLs collected during onboarding setup, sent in the final save payload. */
export interface SetupDocumentUrls {
  frontIdUrl?: string;
  backIdUrl?: string;
  certificatesUrl?: string;
  commercialRegistrationUrl?: string;
  vatCertificateUrl?: string;
  supportingDocsUrl?: string;
}

/**
 * NAFATH verification status.
 *
 * BLOCKED: No backend NAFATH endpoints are confirmed.
 * This type is defined for future use but should NOT be
 * wired to any real API call until the backend provides
 * initiate/verify endpoints.
 */
export type NafathStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

/**
 * NAFATH verification request (future use — blocked).
 *
 * TODO/BLOCKER: Backend must provide NAFATH initiate and verify endpoints
 * before this interface is used in any service method.
 */
export interface NafathVerifyRequest {
  idNumber: string;
  /** NAFATH OTP or reference code. */
  code?: string;
}

/**
 * NAFATH verification response (future use — blocked).
 */
export interface NafathVerifyResponse {
  success: boolean;
  data?: {
    status: NafathStatus;
    reference?: string;
  };
  message?: string;
}

/* ---------- Setup payload interfaces ---------- */

/** Provider onboarding setup payload (typed version of what profile-setup.ts sends). */
export interface ProviderSetupPayload {
  /** Existing taxonomy names explicitly accepted in the setup form. */
  skills?: string[];
  details?: {
    occupation?: string;
    country?: string;
    city?: string;
    bio?: string;
    languages?: string[];
    expYears?: number | string;
    [key: string]: unknown;
  };
  specialties?: {
    mainSpec?: string;
    subSpecs?: string[];
    [key: string]: unknown;
  };
  identity?: {
    frontId?: string;
    backId?: string;
    certs?: string[];
    isNafathVerified?: boolean;
    [key: string]: unknown;
  };
  bank?: {
    bankName?: string;
    accountHolder?: string;
    iban?: string;
    [key: string]: unknown;
  };
  docs?: SetupDocumentUrls;
  portfolio?: Record<string, unknown> | unknown[];
  agreements?: {
    accurate?: boolean;
    terms?: boolean;
    privacy?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Client onboarding setup payload (typed version of what client profile-setup.ts sends). */
export interface ClientSetupPayload {
  details?: {
    idNumber?: string;
    dob?: string;
    country?: string;
    city?: string;
    occupation?: string;
    address?: string;
    [key: string]: unknown;
  };
  identity?: {
    frontId?: string;
    backId?: string;
    [key: string]: unknown;
  };
  bank?: {
    paymentType?: 'bank' | 'wallet';
    bankName?: string;
    accountHolder?: string;
    iban?: string;
    [key: string]: unknown;
  };
  documents?: {
    supportingDocs?: string;
    notes?: string;
    [key: string]: unknown;
  };
  agreements?: {
    accurate?: boolean;
    terms?: boolean;
    privacy?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
