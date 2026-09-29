import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import { Withdrawal, WithdrawalListData } from '../models/withdrawal.model';

export interface MarketerSummary {
	tier: string;
	successfulReferrals: number;
	totalCommissions: number;
	overallConversionRate: number;
	nextTierThreshold: number;
	progressPercentage: number;
}

export interface ChannelPerformance {
	channel: string;
	visitors: number;
	clients: number;
	conversionPercentage: number;
}

export interface CommissionLog {
	id: string;
	source: string;
	type: string;
	time: string;
	amount: number;
	currency: string;
	status: string;
}

export interface AiInsight {
	text: string;
}

export interface ReferralCustomLink {
	id: string;
	channelName: string;
	utmSource: string;
	customSlug?: string;
	createdAt: string;
}

export interface RefLinksData {
	primarySlug: string;
	primaryLink: string;
	customLinks: ReferralCustomLink[];
	settings: {
		notifyOnNewReferral: boolean;
		sharePerformanceStats: boolean;
	};
}

@Injectable({
	providedIn: 'root'
})
export class MarketerOverviewService {
	private http = inject(HttpClient);
	private apiUrl = `${environment.url_api}/marketer-overview`;

	getSummary(): Observable<{ success: boolean; data: MarketerSummary }> {
		return this.http.get<{ success: boolean; data: MarketerSummary }>(`${this.apiUrl}/summary`);
	}

	getChannelPerformance(): Observable<{ success: boolean; data: ChannelPerformance[] }> {
		return this.http.get<{ success: boolean; data: ChannelPerformance[] }>(`${this.apiUrl}/channel-performance`);
	}

	getRecentCommissions(limit: number = 5): Observable<{ success: boolean; data: CommissionLog[] }> {
		return this.http.get<{ success: boolean; data: CommissionLog[] }>(`${this.apiUrl}/commissions?limit=${limit}`);
	}

	getAiInsights(): Observable<{ success: boolean; data: AiInsight[] }> {
		return this.http.get<{ success: boolean; data: AiInsight[] }>(`${this.apiUrl}/ai-insights`);
	}

	getRefLinks(): Observable<{ success: boolean; data: RefLinksData }> {
		return this.http.get<{ success: boolean; data: RefLinksData }>(`${this.apiUrl}/ref-links`);
	}

	createCustomLink(data: { channelName: string; utmSource: string; customSlug?: string }): Observable<{ success: boolean; data: ReferralCustomLink }> {
		return this.http.post<{ success: boolean; data: ReferralCustomLink }>(`${this.apiUrl}/ref-links/custom`, data);
	}

	updateSettings(data: { notifyOnNewReferral?: boolean; sharePerformanceStats?: boolean }): Observable<{ success: boolean; data: any }> {
		return this.http.patch<{ success: boolean; data: any }>(`${this.apiUrl}/ref-links/settings`, data);
	}

	// Destination (IBAN/bank name) is resolved server-side from the
	// affiliate's own saved profile — only the amount is sent here.
	submitWithdrawal(amount: number): Observable<ApiResponse<Withdrawal>> {
		return this.http.post<ApiResponse<Withdrawal>>(`${this.apiUrl}/withdrawals`, { amount });
	}

	getWithdrawals(page: number = 1, limit: number = 10): Observable<ApiResponse<WithdrawalListData>> {
		return this.http.get<ApiResponse<WithdrawalListData>>(`${this.apiUrl}/withdrawals?page=${page}&limit=${limit}`);
	}
}
