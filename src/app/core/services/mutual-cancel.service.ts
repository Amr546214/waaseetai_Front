import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type CancelSide = 'client' | 'provider';
export type CancelStatus = 'PENDING_OTHER_PARTY' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

/** One «الإلغاء بالتراضي» request as the backend returns it (every value is stored or derived on the server; nothing is computed here). */
export interface CancelRequest {
	id: string; contractId: string; contractRef: string; projectId: string; projectTitle: string | null; contractStatus: string | null;
	clientName: string; providerName: string; requestedByRole: 'CLIENT' | 'PROVIDER'; reason: string; note: string | null;
	status: CancelStatus; statusLabel: string; settlementStatus: 'NOT_APPLICABLE' | 'PENDING_ADMIN_DECISION'; settlementLabel: string | null;
	respondedAt: string | null; responseNote: string | null; withdrawnAt: string | null; createdAt: string; updatedAt: string;
	myRole: 'CLIENT' | 'PROVIDER' | null; mine: boolean | null; canRespond: boolean; canWithdraw: boolean; moneyNote: string; moneyMoved: boolean;
	financial?: CancelFinancial; replayed?: boolean;
}
export interface CancelFinancial { contractPrice: number; escrowStatus: string | null; escrowAmount: number | null; escrowReleased: number | null; escrowHeld: number | null }
export interface CancelList { requests: CancelRequest[]; eligibility: { canRequest: boolean; reason: string | null }; financial: CancelFinancial; moneyNote: string }

/** The one place that knows the URLs of the mutual-cancellation request (client and provider routers; the SIDE is decided by the router, never by the body). */
@Injectable({ providedIn: 'root' })
export class MutualCancelService {
	private http = inject(HttpClient);
	private base = (s: CancelSide) => `${environment.url_api}${s === 'client' ? '/client/projects' : '/provider/projects'}`;
	/** the answer / withdraw routes are keyed by the REQUEST id (client router: under /client/projects, provider router: at its root) */
	private byId = (s: CancelSide) => `${environment.url_api}${s === 'client' ? '/client/projects/cancellation-requests' : '/provider/cancellation-requests'}`;
	list(s: CancelSide, projectKey: string): Observable<{ success: boolean; data: CancelList }> { return this.http.get<any>(`${this.base(s)}/${encodeURIComponent(projectKey)}/cancellation-requests`); }
	create(s: CancelSide, projectKey: string, body: { reason: string; note?: string; requestKey: string }): Observable<{ success: boolean; data: CancelRequest }> { return this.http.post<any>(`${this.base(s)}/${encodeURIComponent(projectKey)}/cancellation-requests`, body); }
	respond(s: CancelSide, id: string, decision: 'accept' | 'reject', responseNote?: string): Observable<{ success: boolean; data: CancelRequest }> { return this.http.post<any>(`${this.byId(s)}/${id}/respond`, { decision, ...(responseNote ? { responseNote } : {}) }); }
	withdraw(s: CancelSide, id: string): Observable<{ success: boolean; data: CancelRequest }> { return this.http.post<any>(`${this.byId(s)}/${id}/withdraw`, {}); }
	/** Administration (read-only). */
	adminList(status?: string, page = 1): Observable<any> { return this.http.get<any>(`${environment.url_api}/admin/cancellation-requests`, { params: { ...(status ? { status } : {}), page } }); }
	adminGet(id: string): Observable<any> { return this.http.get<any>(`${environment.url_api}/admin/cancellation-requests/${id}`); }
}
