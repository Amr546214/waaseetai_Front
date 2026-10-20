import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AmendmentPaymentOtpInit { otpSentTo: string; expiresAt: string; amount: number; /** false = the mail server did not take the code (additive field of the backend answer) */ emailSent?: boolean }
export interface AmendmentInsufficientBalance { required: number; available: number; shortfall: number }

/** The calls of the effective-amendment flow that are shared by the client and provider screens. */
@Injectable({ providedIn: 'root' })
export class AmendmentActionsService {
	private http = inject(HttpClient);
	private base = () => environment.url_api;

	/** Client: send the payment-authorization code (e-mail, 2 minutes, bound to this amendment and amount). */
	initPaymentOtp(amendmentId: string): Observable<{ success: boolean; data: AmendmentPaymentOtpInit }> {
		return this.http.post<{ success: boolean; data: AmendmentPaymentOtpInit }>(`${this.base()}/client/projects/amendments/${amendmentId}/payment-otp`, {});
	}
	/** Client answering a PROVIDER request. `otpCode` is only sent when approving a budget increase. */
	clientRespond(amendmentId: string, decision: 'approve' | 'reject', otpCode?: string): Observable<any> {
		const body: { decision: string; otpCode?: string } = { decision };
		if (otpCode) body.otpCode = otpCode;
		return this.http.post<any>(`${this.base()}/client/projects/amendments/${amendmentId}/respond`, body);
	}
	/** Client who RAISED a budget increase authorizes the payment (nothing is charged until the provider approves). */
	authorizeFunding(amendmentId: string, otpCode: string): Observable<any> {
		return this.http.post<any>(`${this.base()}/client/projects/amendments/${amendmentId}/authorize-funding`, { otpCode });
	}
	cancel(side: 'client' | 'provider', amendmentId: string): Observable<any> {
		const prefix = side === 'client' ? '/client/projects' : '/provider';
		return this.http.post<any>(`${this.base()}${prefix}/amendments/${amendmentId}/cancel`, {});
	}
}

/** The structured "wallet is short" detail the backend puts in `errors[0]` of a 409, or null. */
export function insufficientBalanceOf(err: any): AmendmentInsufficientBalance | null {
	const d = err?.error?.errors?.[0];
	return d && typeof d.shortfall === 'number' && typeof d.required === 'number' ? { required: d.required, available: Number(d.available) || 0, shortfall: d.shortfall } : null;
}
