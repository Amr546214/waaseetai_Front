import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
	ClientRateProviderPayload,
	ProviderRateClientPayload,
	RatingApiResponse,
} from '../models/rating.model';

@Injectable({
	providedIn: 'root',
})
export class RatingApiService {
	private http = inject(HttpClient);
	private readonly baseUrl = environment.url_api;

	/**
	 * Client rates a provider after project completion.
	 * POST /api/client/requests/:id/rate
	 */
	rateProvider(requestId: string, payload: ClientRateProviderPayload): Observable<RatingApiResponse> {
		return this.http.post<RatingApiResponse>(
			`${this.baseUrl}/client/requests/${requestId}/rate`,
			payload,
		);
	}

	/**
	 * Provider rates a client after project completion.
	 * POST /api/provider/requests/:id/rate
	 */
	rateClient(requestId: string, payload: ProviderRateClientPayload): Observable<RatingApiResponse> {
		return this.http.post<RatingApiResponse>(
			`${this.baseUrl}/provider/requests/${requestId}/rate`,
			payload,
		);
	}

	/**
	 * Client rates a specific stage/delivery after approving it.
	 * POST /api/client/my-requests/:id/stages/:stageId/rating
	 * Different from rateProvider (which rates the whole project/provider).
	 */
	rateStage(projectId: string, stageId: string, payload: { rating: number; comment?: string }): Observable<RatingApiResponse> {
		return this.http.post<RatingApiResponse>(
			`${this.baseUrl}/client/my-requests/${projectId}/stages/${stageId}/rating`,
			payload,
		);
	}

	/**
	 * Checks whether the current client has already rated the provider for a given project.
	 * Uses the existing GET /api/client/my-requests/completed-projects endpoint which
	 * returns `hasRated`, `canRate`, and `rating` per project (derived from the Review table server-side).
	 * Searches by contractId or projectId across paginated results.
	 * Returns the full review status object so the UI can display the actual rating value.
	 */
	getClientRatingStatus(projectId: string): Observable<{ hasRated: boolean; rating: number | null; comment: string | null; ratedAt: string | null }> {
		return this.http.get<any>(
			`${this.baseUrl}/client/my-requests/completed-projects?page=1&limit=100`,
		).pipe(
			map(response => {
				const items: any[] = response?.data?.items || response?.items || [];
				const match = items.find(item =>
					item.id === projectId ||
					item.projectId === projectId
				);
				if (!match) return { hasRated: false, rating: null, comment: null, ratedAt: null };
				return {
					hasRated: Boolean(match.hasRated),
					rating: match.rating != null ? Number(match.rating) : null,
					comment: match.ratingComment || match.comment || null,
					ratedAt: match.ratedAt || null,
				};
			}),
		);
	}

	/**
	 * Backward-compatible boolean wrapper around getClientRatingStatus.
	 */
	hasClientRated(projectId: string): Observable<boolean> {
		return this.getClientRatingStatus(projectId).pipe(
			map(status => status.hasRated),
		);
	}
}
