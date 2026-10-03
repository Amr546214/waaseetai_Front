export enum ExperienceLevel {
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  EXPERT = 'EXPERT'
}

export interface ClientProfileInput {
  companyName?: string;
  companySize?: string;
  industry?: string;
  website?: string;
  bio?: string;
}

export interface ProviderProfileInput {
  companyName?: string;
  bio?: string;
  skills?: string[];
  hourlyRate?: number;
  experienceLevel?: ExperienceLevel;
  portfolioLinks?: string[];
  /** The provider's PayPal payout destination (PUT /profiles/update, provider role only). */
  paypalPayoutEmail?: string;
}

export interface ProfileResponse {
  success: boolean;
  message?: string;
  data: ProfileData;
}

export interface ProfileData {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  bio?: string;
  avatarUrl?: string | null;
  city?: string;
  country?: string;
  skills?: string[];
  hourlyRate?: number | null;
  profileCompletionPercent?: number;
  status?: string;
  currentProfileData?: ProfileData;
  latestHistory?: unknown[];
}
