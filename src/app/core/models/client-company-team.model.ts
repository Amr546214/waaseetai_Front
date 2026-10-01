import { ApiResponse } from './api.model';

/** Mirrors backend Prisma enum `TeamMemberStatus`. */
export type ClientTeamMemberStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE';

/**
 * A Client Company's own employee roster record, as returned by
 * `/api/client/company/team`. Batch 6 — reuses the exact same
 * CompanyTeamMember backend table the PROVIDER_COMPANY roster uses
 * (src/core/models/company-team.model.ts); memberType is always 'EMPLOYEE'
 * server-side for this endpoint, so it is intentionally not exposed here.
 * Employees have no login of their own.
 */
export interface ClientCompanyTeamMember {
	id: string;
	name: string;
	email: string;
	phone: string | null;
	jobTitle: string;
	status: ClientTeamMemberStatus;
	avatarUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateClientTeamMemberPayload {
	name: string;
	email: string;
	phone?: string | null;
	jobTitle: string;
	status?: ClientTeamMemberStatus;
	avatarUrl?: string | null;
}

export type UpdateClientTeamMemberPayload = Partial<CreateClientTeamMemberPayload>;

export type ClientTeamMemberApiResponse = ApiResponse<ClientCompanyTeamMember>;
export type ClientTeamMemberListApiResponse = ApiResponse<ClientCompanyTeamMember[]>;
export type DeleteClientTeamMemberApiResponse = ApiResponse<{ id: string; deleted: boolean }>;
