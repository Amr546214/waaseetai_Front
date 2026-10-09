import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AiResult, MetricSummaryDetails } from '../models/ai-result.model';
import { environment } from '../../../environments/environment';

export type ClientReportDateRange = 'month' | '3m' | '6m' | 'year' | 'all';

export interface ClientReportOrderItem {
	id: string;
	title: string;
	specialty: string;
	budget: number;
	proposalsCount: number;
	status: string;
	bucket: 'مكتمل' | 'ملغي' | 'نشط' | 'منشور';
	createdAt: string;
}

export interface ClientReportDisputeItem {
	id: string;
	status: string;
	reason: string;
	createdAt: string;
	resolvedAt: string | null;
}

export interface ClientReportTransaction {
	id: string;
	type: string;
	amount: number;
	/** The row's own stored currency (USD). */
	currency?: string;
	status: string;
	description: string | null;
	createdAt: string;
}

export interface ClientReportsData {
	kpis: {
		totalRequests: number;
		requestsDeltaThisMonth: number;
		completedProjectsCount: number;
		completedDeltaThisMonth: number;
		totalSpent: number;
		avgRating: number;
		ratingDelta: number;
	};
	orders: {
		items: ClientReportOrderItem[];
		statusDistribution: Record<string, number>;
		acceptanceBySpecialty: { specialty: string; rate: number; total: number }[];
		counts: { all: number; active: number; completed: number; published: number; cancelled: number };
	};
	projects: {
		activeCount: number;
		completedCount: number;
		completedOnTime: number;
		completedTotal: number;
		avgDurationDays: number;
		avgRating: number;
	};
	finance: {
		totalSpent: number;
		escrowHeld: number;
		transactions: ClientReportTransaction[];
	};
	disputes: {
		items: ClientReportDisputeItem[];
		counts: { all: number; open: number; resolved: number; rejected: number };
	};
}

@Injectable({
	providedIn: 'root'
})
export class ClientReportsService {
	private http = inject(HttpClient);
	private baseUrl = `${environment.url_api}/client/reports`;

	getReports(range: ClientReportDateRange = 'month'): Observable<{ success: boolean; data: ClientReportsData }> {
		return this.http.get<{ success: boolean; data: ClientReportsData }>(this.baseUrl, { params: { range } });
	}

	/** Real AI summary for the same period. A model problem is HTTP 200 + status FAILED / NOT_ENOUGH_DATA, never an HTTP error. */
	getAiSummary(range: ClientReportDateRange = 'month'): Observable<{ success: boolean; data: AiResult<MetricSummaryDetails> }> {
		return this.http.get<{ success: boolean; data: AiResult<MetricSummaryDetails> }>(`${this.baseUrl}/ai-summary`, { params: { range } });
	}
}
