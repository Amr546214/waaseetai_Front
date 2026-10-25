import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FeePolicyPayload {
	providerCommissionByLevel: number[]; clientCashbackByLevel: number[]; marketerCommissionByLevel: number[];
	depositFeePercent: Record<string, number>; marketerWithdrawalFeePercent: Record<string, number>;
	minMarketerPayout: number; minProviderPayout: number;
}
export interface FeePolicyVersion { id: string; version: number; effectiveFrom: string; payload: FeePolicyPayload; note: string | null; createdById: string | null; createdAt: string; cancelledAt: string | null; state: 'EFFECTIVE' | 'SCHEDULED' | 'CANCELLED' }
export interface FeePolicyView { active: FeePolicyVersion; upcoming: FeePolicyVersion[]; history: FeePolicyVersion[]; limits: Record<string, unknown> & { minLeadMinutes: number; maxLeadDays: number }; now: string }
interface Envelope<T> { success: boolean; data: T }
const base = () => `${environment.url_api}/admin/fee-policy`;

@Injectable({ providedIn: 'root' })
export class FeePolicyApi {
	private http = inject(HttpClient);
	view(): Observable<Envelope<FeePolicyView>> { return this.http.get<Envelope<FeePolicyView>>(base()); }
	schedule(body: { changes: Partial<FeePolicyPayload>; effectiveFrom: string; note: string; baseVersion: number; confirmSensitive: boolean }): Observable<Envelope<{ version: number; id: string; effectiveFrom: string; diff: Array<{ path: string; from: unknown; to: unknown }> }>> { return this.http.post<Envelope<{ version: number; id: string; effectiveFrom: string; diff: Array<{ path: string; from: unknown; to: unknown }> }>>(base(), body); }
	cancel(id: string): Observable<Envelope<{ version: number; cancelled: boolean }>> { return this.http.post<Envelope<{ version: number; cancelled: boolean }>>(`${base()}/${id}/cancel`, {}); }
}
