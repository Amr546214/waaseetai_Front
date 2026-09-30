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
}
