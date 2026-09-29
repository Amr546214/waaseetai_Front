import { ApiResponse } from './api.model';

/** Mirrors backend Prisma enum `TeamMemberType`. */
export type TeamMemberType = 'PROVIDER' | 'EMPLOYEE';

/** Mirrors backend Prisma enum `TeamMemberStatus`. */
export type TeamMemberStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE';

/**
 * A company team member record as returned by
 * `/api/provider/company/team`. Records are owned by the PROVIDER_COMPANY
 * account; team members have no login of their own.
 */
export interface CompanyTeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  jobTitle: string;
  memberType: TeamMemberType;
  status: TeamMemberStatus;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamMemberPayload {
  name: string;
  email: string;
  phone?: string | null;
  jobTitle: string;
  memberType: TeamMemberType;
  status?: TeamMemberStatus;
  avatarUrl?: string | null;
}

export type UpdateTeamMemberPayload = Partial<CreateTeamMemberPayload>;

export type TeamMemberApiResponse = ApiResponse<CompanyTeamMember>;
export type TeamMemberListApiResponse = ApiResponse<CompanyTeamMember[]>;
export type DeleteTeamMemberApiResponse = ApiResponse<{ id: string; deleted: boolean }>;
