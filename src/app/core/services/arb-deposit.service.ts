import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// Bank card deposit through the bank's hosted payment page (ARB / Neoleap). The browser sends ONLY the net USD amount; the charged amount, currency
// and fee are derived by the server. A page that comes back from the bank proves nothing: the server verifies with the bank and this service only
// reads the verified state.
export type ArbState = 'WAITING_PAGE' | 'VERIFYING' | 'PAID' | 'DECLINED' | 'CANCELLED' | 'EXPIRED' | 'FAILED' | 'REVIEW' | 'UNSETTLED';

export interface ArbView {
	reference: string;
	state: ArbState;
	message: string;
	nextStep: string;
	redirectUrl: string | null;
	creditedUsd: number | null;
	chargedSar: number | null;
	/** the bank itself gave a final answer */
	bankFinal: boolean;
	/** an earlier attempt may still be collected by the bank: a new one needs the user's explicit acknowledgement */
	requiresAcknowledgement: boolean;
	previousReference: string | null;
}

export interface ArbQuote { netUsd: number; feePercent: number; feeUsd: number; grossUsd: number; chargedSar: number; currency: 'SAR'; sarPerUsd: number }

@Injectable({ providedIn: 'root' })
export class ArbDepositService {
	private http = inject(HttpClient);
	private base = `${environment.url_api}/client/finance/arb`;

	availability(): Observable<{ success: boolean; data: { available: boolean } }> { return this.http.get<{ success: boolean; data: { available: boolean } }>(`${this.base}/config`); }
	quote(netUsd: number): Observable<{ success: boolean; data: ArbQuote }> { return this.http.get<{ success: boolean; data: ArbQuote }>(`${this.base}/quote`, { params: { netUsd } }); }
	initiate(netUsd: number, acknowledgePreviousRisk = false): Observable<{ success: boolean; data: ArbView }> { return this.http.post<{ success: boolean; data: ArbView }>(`${this.base}/initiate`, acknowledgePreviousRisk ? { netUsd, acknowledgePreviousRisk: true } : { netUsd }); }
	status(reference: string): Observable<{ success: boolean; data: ArbView }> { return this.http.get<{ success: boolean; data: ArbView }>(`${this.base}/${encodeURIComponent(reference)}/status`); }
	abandon(reference: string): Observable<{ success: boolean; data: ArbView }> { return this.http.post<{ success: boolean; data: ArbView }>(`${this.base}/${encodeURIComponent(reference)}/abandon`, {}); }
	open(): Observable<{ success: boolean; data: ArbView | null }> { return this.http.get<{ success: boolean; data: ArbView | null }>(`${this.base}/open`); }
}
