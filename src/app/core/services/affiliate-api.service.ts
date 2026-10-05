import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// These two endpoints are public/unauthenticated (used from the registration
// page before a session exists) and deliberately return ONLY these three
// fields (P-LG-012) — never email/phone/bank/etc.
export interface AffiliateSummary {
	id: string;
	referralSlug: string;
	displayName: string;
}

@Injectable({
	providedIn: 'root'
})
export class AffiliateApiService {
	private http = inject(HttpClient);
	private readonly baseUrl = `${environment.url_api}/affiliates`;

	/**
	 * Resolve a manually-typed affiliate code/slug/id to its display name, for
	 * a confirmation UI. The backend returns a clean 404 when not found —
	 * callers should treat that as "no match" rather than an error banner,
	 * since an unresolved code is still allowed to flow through to
	 * registration unvalidated (the backend never blocks signup over it).
	 */
	public resolve(code: string): Observable<{ success: boolean; data: AffiliateSummary }> {
		return this.http.get<{ success: boolean; data: AffiliateSummary }>(`${this.baseUrl}/resolve?code=${encodeURIComponent(code)}`);
	}

	/**
	 * Case-insensitive partial name search backing the registration page's
	 * affiliate autocomplete. Empty/short queries return an empty list.
	 */
	public search(query: string): Observable<{ success: boolean; data: AffiliateSummary[] }> {
		return this.http.get<{ success: boolean; data: AffiliateSummary[] }>(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`);
	}

	/**
	 * Reads the (httpOnly, frontend-unreadable) `waseet_ref_code` referral
	 * cookie server-side and reports whether it resolves to a real affiliate
	 * (P-LG-012 locked-attribution UI). Always 200 — `active: false` (no
	 * referralSlug/displayName) means no cookie or an unresolvable one, never
	 * an error status. Callers must treat a failed/errored call the same as
	 * `active: false` (fail open to the normal optional picker).
	 */
	public getReferralStatus(): Observable<{ success: boolean; data: { active: boolean; referralSlug?: string; displayName?: string } }> {
		return this.http.get<{ success: boolean; data: { active: boolean; referralSlug?: string; displayName?: string } }>(`${this.baseUrl}/referral-status`);
	}

	/**
	 * Current-visit attribution: the registration page opened WITHOUT the `?ref=1` marker (i.e. not through a real
	 * referral link) removes any older `waseet_ref_code` cookie (HttpOnly, so only the backend can), so neither the page
	 * nor the signup reuses a referrer from an earlier visit. Idempotent; callers ignore failures.
	 */
	public clearReferralCookie(): Observable<{ success: boolean; data?: { cleared: boolean } }> {
		return this.http.post<{ success: boolean; data?: { cleared: boolean } }>(`${this.baseUrl}/referral-cookie/clear`, {});
	}
}
