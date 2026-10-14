import { ApiResponse } from './api.model';

export type RatingScore = 1 | 2 | 3 | 4 | 5;

export type RatingTarget = 'client' | 'provider';

export interface ClientRateProviderPayload {
	rating: RatingScore;
	comment?: string;
	tags?: string[];
}

export interface ProviderRateClientPayload {
	rating: RatingScore;
	comment?: string;
	tags?: string[];
}

export interface RatingResultData {
	ratingId: string;
	averageRating?: number;
}

export type RatingApiResponse = ApiResponse<RatingResultData>;

/** The review the signed-in user saved for the other side (project level), exactly as stored. */
export interface SavedReview {
	id: string;
	rating: number;
	comment: string | null;
	tags: string[];
	createdAt: string;
}

/** What the admin really executed when a dispute closed the project (USD). */
export interface SettlementDistribution {
	outcome: string;
	refundToClient: number;
	releaseToProvider: number;
	platformCommission: number;
	providerNet: number;
}

/** What the rating page asks the server BEFORE it shows a form: may this user rate, and what did they already rate. */
export interface RatingStatus {
	projectId: string | null;
	requestId: string | null;
	actor: 'client' | 'provider';
	canRate: boolean;
	reason: 'ALREADY_RATED' | 'ADMIN_SETTLED' | 'NOT_COMPLETED' | null;
	message: string;
	adminSettled: { disputeId: string; outcome: string; label: string; distribution: SettlementDistribution | null } | null;
	review: SavedReview | null;
}
