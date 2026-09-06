import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
}
