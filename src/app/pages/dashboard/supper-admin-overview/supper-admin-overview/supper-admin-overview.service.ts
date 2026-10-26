import { Injectable, inject } from '@angular/core';
import { providerTimeZone } from '../../../../core/services/provider-prefs.store';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface DashboardQueue { key: string; label: string; count: number; link: string }
export interface DashboardAlert { key: string; severity: 'high' | 'warn' | 'info'; text: string; count: number; link: string }
export interface DashboardSummary {
	generatedAt: string;
	currency: string;
	kpis: {
		users: { total: number; active: number; suspended: number; newThisMonth: number; newPreviousMonth: number; growthPercent: number | null };
		projects: { active: number; completed: number; openRequests: number };
		revenue: { platformCommissionTotal: number; platformCommissionThisMonth: number; escrowHeld: number; platformCommissionTotalBy?: Record<string, number>; platformCommissionThisMonthBy?: Record<string, number>; escrowHeldBy?: Record<string, number> };
		disputes: { open: number; openOver7Days: number };
		tickets: { open: number };
		withdrawals: { pending: number; pendingAmount: number; pendingAmountBy?: Record<string, number> };
	};
	queues: DashboardQueue[];
	alerts: DashboardAlert[];
}
export interface DashboardCharts {
	days: number;
	currency: string;
	registrations: { date: string; count: number }[];
	registrationsTotal: number;
	commission: { month: string; amount: number }[];
	commissionTotal: number;
	projectsByStatus: { status: string; count: number }[];
}
export interface DashboardActivityItem { id: string; kind: string; title: string; actor: string; actorType: string | null; at: string; status: string | null; link: string }

@Injectable({ providedIn: 'root' })
export class SaDashboardService {
	private http = inject(HttpClient);
	private base = `${environment.url_api}/admin/dashboard`;

	getSummary(): Observable<{ success: boolean; data: DashboardSummary }> { return this.http.get<{ success: boolean; data: DashboardSummary }>(`${this.base}/summary`); }
	getCharts(days = 7): Observable<{ success: boolean; data: DashboardCharts }> { return this.http.get<{ success: boolean; data: DashboardCharts }>(`${this.base}/charts?days=${days}`); }
	getActivity(limit = 12): Observable<{ success: boolean; data: { items: DashboardActivityItem[] } }> { return this.http.get<{ success: boolean; data: { items: DashboardActivityItem[] } }>(`${this.base}/activity?limit=${limit}`); }
}

/** Arabic label + badge class for a raw status coming from the activity feed. */
export const ACTIVITY_STATUS: Record<string, { label: string; cls: string }> = {
	ACTIVE: { label: 'نشط', cls: 'badge-green' }, PENDING_VERIFICATION: { label: 'بانتظار التفعيل', cls: 'badge-amber' }, SUSPENDED: { label: 'موقوف', cls: 'badge-coral' }, SUSPENDED_REVIEW: { label: 'معلق مراجعة', cls: 'badge-amber' },
	OPEN: { label: 'مفتوح', cls: 'badge-coral' }, UNDER_REVIEW: { label: 'قيد المراجعة', cls: 'badge-amber' }, RESOLVED: { label: 'محسوم', cls: 'badge-green' }, REJECTED: { label: 'مرفوض', cls: 'badge-coral' },
	PENDING: { label: 'معلق', cls: 'badge-amber' }, APPROVED: { label: 'معتمد', cls: 'badge-green' }, PROCESSING: { label: 'قيد التحويل', cls: 'badge-amber' }, COMPLETED: { label: 'مكتمل', cls: 'badge-green' }, REVERSED: { label: 'مرتجع', cls: 'badge-coral' },
	IN_PROGRESS: { label: 'قيد المعالجة', cls: 'badge-amber' }, AWAITING_CUSTOMER: { label: 'بانتظار العميل', cls: 'badge-amber' }, CLOSED: { label: 'مغلق', cls: 'badge-green' },
	MANUAL_REVIEW: { label: 'مراجعة يدوية', cls: 'badge-amber' }, PENDING_AI_AUDIT: { label: 'بانتظار التدقيق', cls: 'badge-amber' }, AI_VERIFIED: { label: 'تقييم مخزّن', cls: 'badge-green' }
};

export function relativeTimeAr(iso: string, now = Date.now()): string {
	const diff = Math.max(0, now - new Date(iso).getTime());
	const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
	if (m < 1) return 'الآن';
	if (m < 60) return `قبل ${m} دقيقة`;
	if (h < 24) return `قبل ${h} ${h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : 'ساعات'}`;
	if (d === 1) return 'أمس';
	if (d < 30) return `قبل ${d} أيام`;
	return new Date(iso).toLocaleDateString('ar-SA', { timeZone: providerTimeZone() });
}
