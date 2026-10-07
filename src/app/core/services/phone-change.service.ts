import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PhoneChangeRequested { emailSent: boolean; emailHint: string; expiresInSeconds: number }

/** Phone-number change with an email OTP (backend PR #52): request a code, then confirm it. */
@Injectable({ providedIn: 'root' })
export class PhoneChangeService {
	private readonly http = inject(HttpClient);
	private readonly base = `${environment.url_api}/profiles/phone/change`;

	request(phoneNumber: string): Observable<PhoneChangeRequested> {
		return this.http.post<{ data: PhoneChangeRequested }>(`${this.base}/request`, { phoneNumber }).pipe(map(r => r.data));
	}
	confirm(code: string): Observable<{ phoneNumber: string }> {
		return this.http.post<{ data: { phoneNumber: string } }>(`${this.base}/confirm`, { code }).pipe(map(r => r.data));
	}
}
