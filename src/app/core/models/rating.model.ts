import { ApiResponse } from './api.model';

/** Explains the publish choice BEFORE submit (binding wording). */
export const PUBLISH_EXPLAIN_AR = {
	published: 'منشور: يظهر تقييمك ونصه ووسومه واسمك في الملف العام لمقدّم الخدمة',
	unpublished: 'غير منشور: يبقى لك وللطرف الآخر وللإدارة فقط',
} as const;
/** Visibility state shown on the saved-review card. */
export const VISIBILITY_LABEL_AR = {
	published: 'منشور للعامة',
	unpublished: 'غير منشور: مرئي لك وللطرف الآخر وللإدارة فقط',
} as const;

export type RatingScore = 1 | 2 | 3 | 4 | 5;

export type RatingTarget = 'client' | 'provider';

export interface ClientRateProviderPayload {
	rating: RatingScore;
	comment?: string;
	tags?: string[];
	/** true = public (default for old clients), false = visible only to both parties and the admin. */
	publish?: boolean;
}

export interface ProviderRateClientPayload {
	rating: RatingScore;
	comment?: string;
	tags?: string[];
	publish?: boolean;
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
	/** The reviewer's publish choice (absent on an older server: no label is drawn). */
	isPublic?: boolean;
	createdAt: string;
	/** Present on the counterpart / per-stage reads. */
	reviewerRole?: 'CLIENT' | 'PROVIDER';
	stageId?: string | null;
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
	/** 'PROJECT' (default) or 'STAGE' for the stage status endpoint. */
	scope?: 'PROJECT' | 'STAGE';
	stageId?: string | null;
	projectId: string | null;
	requestId: string | null;
	actor: 'client' | 'provider';
	canRate: boolean;
	reason: 'ALREADY_RATED' | 'ADMIN_SETTLED' | 'NOT_COMPLETED' | 'STAGE_NOT_APPROVED' | 'NOT_RATER' | null;
	message: string;
	adminSettled: { disputeId: string; outcome: string; label: string; distribution: SettlementDistribution | null } | null;
	review: SavedReview | null;
	/** What the OTHER party saved about this same target (read-only; shown to both parties even when unpublished). Absent on an older server. */
	counterpart?: SavedReview | null;
	/** Project scope only: the client's stage reviews (never mixed into review / counterpart). */
	stageReviews?: SavedReview[];
}
