import { Injectable } from '@angular/core';
import { OtpNotice } from '../forms/otp-delivery';

/**
 * One-shot, in-memory hand-off from the page that triggered an activation email (unverified login) to the
 * verification page, so the latter shows what really happened and starts its resend countdown only if a code was sent.
 * Deliberately not persisted: a reload falls back to a neutral state (no claim, no countdown).
 */
@Injectable({ providedIn: 'root' })
export class OtpHandoffService {
	private notice: OtpNotice | null = null;

	set(notice: OtpNotice) { this.notice = notice; }

	consume(): OtpNotice | null {
		const n = this.notice;
		this.notice = null;
		return n;
	}
}
