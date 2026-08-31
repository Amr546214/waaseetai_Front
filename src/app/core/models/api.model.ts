/** Shared transport types for HTTP boundaries. */
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface ApiErrorPayload {
  success?: false;
  message?: string;
  error?: string;
}

export interface ClientRequestPayload {
  specialtyId?: string;
  specialty?: string;
  title: string;
  description: string;
  subSpecialties?: string[];
  requiredSkills?: string[];
  // Kept as string for backwards compatibility with existing form controls;
  // backend validation remains the source of truth for the allowed values.
  budgetType?: string;
  minBudget?: number | null;
  maxBudget?: number | null;
  expectedDurationDays?: number | null;
  preferredProviderType?: string;
  requiresNda?: boolean;
  attachments?: string[];
  outputs?: string;
  customConditions?: string;
  ipRights?: string;
  providerPreferences?: {
    level?: string | null;
    minRating?: number | null;
    language?: string;
    location?: string | null;
  };
  allowNegotiation?: boolean;
  splitMilestones?: boolean;
  milestones?: Array<{ name: string; pct: number }>;
}

export interface ClientRequestAiSuggestPayload {
  title?: string;
  description?: string;
  specialtyId?: string;
  specialtyName?: string;
  subSpecialties?: string[];
}
