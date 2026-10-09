import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AiResult, MetricSummaryDetails } from '../models/ai-result.model';

/** Deterministic database aggregates (NOT AI) returned next to the AI summary. */
export interface ForecastMonth { month: string; inflow: number; outflow: number; inflowChangePercent: number | null; }
export interface ForecastSeries {
	/** null when there is no currency at all; never a default. */
	currency: string | null;
	/** More than one currency exists in the data: only `currency` is shown, never summed with another, and no next-month estimate is produced. */
	mixedCurrencies?: boolean;
	currenciesSeen?: string[];
	months: ForecastMonth[];
	monthsWithData: number;
	inflowNextMonthEstimate: number | null;
	inflowTrendBasedOnMonths: number;
}
export interface AnomalyDay { date: string; count: number; zScore: number; }
export interface AnomalyMetric {
	key: string;
	totalEvents: number;
	evaluated: boolean;
	mean: number | null;
	stdDev: number | null;
	anomalyDays: AnomalyDay[];
}
export interface AnomalyStats {
	windowDays: number;
	sigma: number;
	anomalyCount: number;
	metrics: AnomalyMetric[];
	securityEventsByType: { label: string; count: number }[];
}
export interface SentimentBucket { stars: number; count: number; percent: number; }
export interface SentimentStats {
	totalReviews: number;
	averageRating: number | null;
	withCommentCount: number;
	distribution: SentimentBucket[];
	positivePercent: number;
	negativePercent: number;
	commentSnippets: string[];
}

export type ForecastSummary = AiResult<MetricSummaryDetails> & { series: ForecastSeries | null };
export type AnomalySummary = AiResult<MetricSummaryDetails> & { anomalies: AnomalyStats | null };
export type SentimentSummary = AiResult<MetricSummaryDetails> & { stats: SentimentStats | null };

/** What a page receives: either the server result, or a failed request (never a thrown error). */
export interface AdminAiLoad<T> { result: T | null; failed: boolean; }

@Injectable({ providedIn: 'root' })
export class AdminAiService {
	private readonly http = inject(HttpClient);
	private readonly baseUrl = environment.url_api;

	getForecastSummary(): Observable<AdminAiLoad<ForecastSummary>> { return this.get<ForecastSummary>('forecast-summary'); }
	getAnomalySummary(): Observable<AdminAiLoad<AnomalySummary>> { return this.get<AnomalySummary>('anomaly-summary'); }
	getSentimentSummary(): Observable<AdminAiLoad<SentimentSummary>> { return this.get<SentimentSummary>('sentiment-summary'); }

	private get<T>(path: string): Observable<AdminAiLoad<T>> {
		return this.http.get<{ success: boolean; data: T }>(`${this.baseUrl}/admin/ai/${path}`).pipe(
			map((res): AdminAiLoad<T> => (res?.success && res.data ? { result: res.data, failed: false } : { result: null, failed: true })),
			catchError(() => of<AdminAiLoad<T>>({ result: null, failed: true })),
		);
	}
}

/** Tiny signal state for a card: loading / result / failed, load() re-calls the endpoint (used for the first load and for retry). */
export function createAdminAiState<T>(fetch: () => Observable<AdminAiLoad<T>>) {
	const loading = signal(false);
	const result = signal<T | null>(null);
	const failed = signal(false);
	const load = () => {
		loading.set(true);
		failed.set(false);
		fetch().subscribe(r => { result.set(r.result); failed.set(r.failed); loading.set(false); });
	};
	return { loading, result, failed, load };
}
