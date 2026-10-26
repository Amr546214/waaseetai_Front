import { Injectable, inject } from '@angular/core';
import { AiResult, MetricSummaryDetails } from '../models/ai-result.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import { Withdrawal, WithdrawalListData } from '../models/withdrawal.model';

export interface MarketerSummary {
	/** the level's NAME, level number, commission % and colour pair: all from the backend ladder */
	tier: string;
	level?: number;
	commissionPercent?: number;
	levelColor?: { dark: string; light: string };
	successfulReferrals: number;
	totalCommissions: number;
	overallConversionRate: number;
	totalVisits?: number;
	totalReferrals?: number;
	pendingReferrals?: number;
	qualifiedReferrals?: number;
	approvedCommissions?: number;
	paidCommissions?: number;
	pendingCommissions?: number;
	/** the same figures per currency (the numbers are the USD ones; amounts of different currencies are never added) */
	totalCommissionsBy?: Record<string, number>;
	pendingCommissionsBy?: Record<string, number>;
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

/** GET /marketer-overview/wallet: the marketer's money as the server enforces it (never derived in the browser). */
export interface MarketerWallet {
	currency: string;
	/** Approved commissions in total. */
	approvedEarnings: number;
	/** Commissions not yet approved. */
	pendingEarnings: number;
	/** Withdrawals in the review / payout pipeline (pending, approved, processing). */
	reservedWithdrawals: number;
	/** Withdrawals already paid (or paid then reversed by PayPal). */
	paidWithdrawals: number;
	/** approvedEarnings minus reserved and paid: the amount a new request may ask for. */
	withdrawableBalance: number;
	/** earnings per currency (approved / pending); withdrawableBalance and the figures here are USD (payouts are PayPal/USD) */
	earningsByCurrency?: Record<string, { approved: number; pending: number }>;
	minimumWithdrawal: number;
	paypalEmail: string | null;
	hasPaypal: boolean;
	/** Why a withdrawal cannot be requested right now (null = it can). */
	withdrawBlockedReason: string | null;
}

export interface MarketerAssetFile {
	id: string;
	kind: 'BANNER' | 'TEMPLATE' | 'FILE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LINK' | 'TEXT';
	title: string;
	description: string | null;
	downloadUrl: string | null;
	/** Copy-ready text for TEXT materials. */
	text?: string | null;
}

/** GET/PATCH /marketer-overview/settings. */
export interface MarketerSettings {
	inApp: boolean;
	email: boolean;
	newReferral: boolean;
	newCommission: boolean;
	communicationLanguage: 'ar' | 'en';
	timezone: string | null;
}

export type AiInsights = AiResult<MetricSummaryDetails>;

// Single-tier direct referral status (P-LG-012). A referred user starts
// PENDING, becomes QUALIFIED once their first project stage escrow is
// released, and CONVERTED once they're a recurring/paying client — the
// commission engine (backend, disabled by default) is what actually moves
// a row between these states, this page only displays them.
export enum ReferralStatus {
	PENDING = 'PENDING',
	QUALIFIED = 'QUALIFIED',
	CONVERTED = 'CONVERTED'
}

export interface ReferredUser {
	referralId?: string;
	referredUserDisplayName: string;
	status: ReferralStatus | string;
	joinedAt: string;
	commissionEarned: number | null;
	/** the commission's own currency (a missing one reads as USD, legacy) */
	currency?: string;
}

export interface ReferralListData {
	items: ReferredUser[];
	page: number;
	limit: number;
	total: number;
}

/**
 * What GET /api/marketer-overview/referrals really returns: `data` is the ARRAY of referrals and the paging sits next to it
 * (`pagination`), with `displayName` / `totalCommissionEarned` per row. (The page used to read `data.items` / `data.total`,
 * which never existed, so the list was always empty even when referrals existed.)
 */
export interface ReferralsApiResponse {
	success: boolean;
	data: any;
	pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
}

/** Maps the backend response (and, defensively, the older `{ items, total }` shape) to what the page renders. Every status is kept, PENDING included. */
export function toReferralListData(res: ReferralsApiResponse, page: number, limit: number): ReferralListData {
	const raw: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.items) ? res.data.items : [];
	const paging = res?.pagination ?? res?.data ?? {};
	return {
		items: raw.map((r) => ({
			referralId: r.referralId,
			referredUserDisplayName: r.referredUserDisplayName ?? r.displayName ?? '',
			status: r.status,
			joinedAt: r.joinedAt,
			commissionEarned: r.commissionEarned ?? r.totalCommissionEarned ?? null,
			...(r.currency ? { currency: r.currency } : {}),
		})),
		page: paging.page ?? page,
		limit: paging.limit ?? limit,
		total: paging.total ?? raw.length,
	};
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

	getAiInsights(): Observable<{ success: boolean; data: AiInsights }> {
		return this.http.get<{ success: boolean; data: AiInsights }>(`${this.apiUrl}/ai-insights`);
	}

	// Real referrals of the calling marketer (every status: PENDING, QUALIFIED, CONVERTED), paginated.
	getReferrals(page: number = 1, limit: number = 10): Observable<{ success: boolean; data: ReferralListData }> {
		return this.http.get<ReferralsApiResponse>(`${this.apiUrl}/referrals?page=${page}&limit=${limit}`).pipe(
			map((res) => ({ success: res.success, data: toReferralListData(res, page, limit) }))
		);
	}

	getRefLinks(): Observable<{ success: boolean; data: RefLinksData }> {
		return this.http.get<{ success: boolean; data: RefLinksData }>(`${this.apiUrl}/ref-links`);
	}

	createCustomLink(data: { channelName: string; utmSource: string; customSlug?: string }): Observable<{ success: boolean; data: ReferralCustomLink }> {
		return this.http.post<{ success: boolean; data: ReferralCustomLink }>(`${this.apiUrl}/ref-links/custom`, data);
	}

	deleteCustomLink(id: string): Observable<{ success: boolean; data: { id: string } }> {
		return this.http.delete<{ success: boolean; data: { id: string } }>(`${this.apiUrl}/ref-links/custom/${encodeURIComponent(id)}`);
	}

	updateSettings(data: { notifyOnNewReferral?: boolean; sharePerformanceStats?: boolean }): Observable<{ success: boolean; data: any }> {
		return this.http.patch<{ success: boolean; data: any }>(`${this.apiUrl}/ref-links/settings`, data);
	}

	// Destination (IBAN/bank name) is resolved server-side from the
	// affiliate's own saved profile — only the amount is sent here.
	submitWithdrawal(amount: number): Observable<ApiResponse<Withdrawal>> {
		return this.http.post<ApiResponse<Withdrawal>>(`${this.apiUrl}/withdrawals`, { amount });
	}

	getWallet(): Observable<ApiResponse<MarketerWallet>> {
		return this.http.get<ApiResponse<MarketerWallet>>(`${this.apiUrl}/wallet`);
	}

	getWithdrawal(id: string): Observable<ApiResponse<Withdrawal>> {
		return this.http.get<ApiResponse<Withdrawal>>(`${this.apiUrl}/withdrawals/${encodeURIComponent(id)}`);
	}

	getAssets(): Observable<ApiResponse<{ items: MarketerAssetFile[] }>> {
		return this.http.get<ApiResponse<{ items: MarketerAssetFile[] }>>(`${this.apiUrl}/assets`);
	}

	getSettings(): Observable<ApiResponse<MarketerSettings>> {
		return this.http.get<ApiResponse<MarketerSettings>>(`${this.apiUrl}/settings`);
	}

	updateMarketerSettings(data: Partial<MarketerSettings>): Observable<ApiResponse<MarketerSettings>> {
		return this.http.patch<ApiResponse<MarketerSettings>>(`${this.apiUrl}/settings`, data);
	}

	/** The marketer's own data as a real JSON file. */
	exportData(): Observable<Blob> {
		return this.http.get(`${this.apiUrl}/settings/data-export`, { responseType: 'blob' });
	}

	getWithdrawals(page: number = 1, limit: number = 10): Observable<ApiResponse<WithdrawalListData>> {
		return this.http.get<ApiResponse<WithdrawalListData>>(`${this.apiUrl}/withdrawals?page=${page}&limit=${limit}`);
	}
}
