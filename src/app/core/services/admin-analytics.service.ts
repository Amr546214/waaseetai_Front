import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CountByStatus { status: string; count: number; }
export interface AnalyticsReviewItem { id: string; rating: number; comment: string | null; createdAt: string; providerName: string; clientName: string | null; }
export interface AnalyticsProviderRow { providerId: string; name: string; accountType: string | null; averageRating: number; reviewCount: number; completedProjects: number; }

export interface AnalyticsOverview {
	range: { from: string | null; to: string | null };
	users: {
		total: number;
		byAccountType: { accountType: string; count: number; newInRange: number }[];
		newInRange: number;
		newByMonth: { month: string; count: number }[];
	};
	projects: { total: number; byStatus: CountByStatus[] };
	requests: { total: number; byStatus: CountByStatus[] };
	orders: { total: number; byStatus: CountByStatus[] };
	disputes: { total: number; byStatus: CountByStatus[] };
	referrals: { total: number; byStatus: CountByStatus[] };
	reviews: {
		count: number;
		average: number | null;
		negativeCount: number;
		distribution: { stars: number; count: number; percent: number }[];
		byMonth: { month: string; count: number; average: number }[];
		recent: AnalyticsReviewItem[];
		lowRated: AnalyticsReviewItem[];
	};
	providers: { topRated: AnalyticsProviderRow[]; atRisk: AnalyticsProviderRow[]; totalProviderAccounts: number };
	specialties: { specialty: string; projects: number; providers: number }[];
}

export interface AnalyticsRangeParams { from?: string; to?: string; }
/** null result means the request failed (the page shows an honest error, never fallback numbers). */
export type AnalyticsLoad = { data: AnalyticsOverview | null; failed: boolean };

@Injectable({ providedIn: 'root' })
export class AdminAnalyticsService {
	private readonly http = inject(HttpClient);
	private readonly baseUrl = environment.url_api;

	getOverview(range: AnalyticsRangeParams): Observable<AnalyticsLoad> {
		let params = new HttpParams();
		if (range.from) params = params.set('from', range.from);
		if (range.to) params = params.set('to', range.to);
		return this.http.get<{ success: boolean; data: AnalyticsOverview }>(`${this.baseUrl}/admin/analytics/overview`, { params }).pipe(
			map((res): AnalyticsLoad => (res?.success && res.data ? { data: res.data, failed: false } : { data: null, failed: true })),
			catchError(() => of<AnalyticsLoad>({ data: null, failed: true })),
		);
	}
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
	CLIENT_INDIVIDUAL: 'طالب خدمة (فرد)',
	CLIENT_COMPANY: 'طالب خدمة (شركة)',
	PROVIDER_INDIVIDUAL: 'مقدم خدمة (فرد)',
	PROVIDER_COMPANY: 'مقدم خدمة (شركة)',
	MARKETING_BROKER: 'وسيط تسويقي',
	EMPLOYEE: 'موظف',
	ADMIN: 'مشرف',
	SUPER_ADMIN: 'مشرف عام',
};

export const STATUS_LABELS: Record<string, string> = {
	DRAFT: 'مسودة', PENDING_SIGNATURE: 'بانتظار التوقيع', PENDING_REVIEW: 'قيد المراجعة', OPEN: 'مفتوح', IN_PROGRESS: 'قيد التنفيذ',
	AWAITING_DELIVERY: 'بانتظار التسليم', PENDING_APPROVAL: 'بانتظار الاعتماد', COMPLETED: 'مكتمل', DISPUTED: 'متنازع عليه', CANCELLED: 'ملغي',
	PENDING_PAYMENT: 'بانتظار الدفع', PAID: 'مدفوع', PROCESSING: 'قيد المعالجة', UNDER_REVIEW: 'قيد المراجعة', RESOLVED: 'تم الحل', REJECTED: 'مرفوض',
	PENDING: 'معلّق', QUALIFIED: 'مؤهَّل', CONVERTED: 'تحوّل لعميل',
};
