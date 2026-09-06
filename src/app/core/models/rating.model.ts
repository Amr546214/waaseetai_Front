import { ApiResponse } from './api.model';

export type RatingScore = 1 | 2 | 3 | 4 | 5;

export type RatingTarget = 'client' | 'provider';

export interface ClientRateProviderPayload {
	rating: RatingScore;
	comment?: string;
}

export interface ProviderRateClientPayload {
	rating: RatingScore;
	comment?: string;
}

export interface RatingResultData {
	ratingId: string;
	averageRating?: number;
}

export type RatingApiResponse = ApiResponse<RatingResultData>;
