import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../store/auth.store';

export type ProviderAccessStateKind = 'SETUP_INCOMPLETE' | 'ASSESSMENT_REQUIRED' | 'SAMPLE_REQUIRED' | 'PENDING_REVIEW' | 'REJECTED' | 'APPROVED' | 'NOT_APPLICABLE';

export interface ProviderAccessSpecialty {
	providerSpecialtyId: string;
	specialtyId: string;
	nameAr: string;
	status: string;
	isPassed: boolean;
	sample: { id: string; status: string; rejectionReason: string | null; submittedAt: string } | null;
}

export interface ProviderAccessState {
	state: ProviderAccessStateKind;
	canAccessDashboard: boolean;
	message: string;
	reason: string | null;
	hasSample: boolean;
	specialties: ProviderAccessSpecialty[];
}

export const PROVIDER_ACCESS_STATUS_URL = '/provider-overview/accreditation-status';
export const PROVIDER_SETUP_URL = '/provider-overview/profile/setup';

/** Where a not-open account goes: the wizard (it resolves the right step; test pending = step 7) while the setup/test is unfinished, else the status page. */
export function accessRedirectUrl(state: ProviderAccessState | null | undefined): string {
	return state && (state.state === 'SETUP_INCOMPLETE' || state.state === 'ASSESSMENT_REQUIRED') ? PROVIDER_SETUP_URL : PROVIDER_ACCESS_STATUS_URL;
}

/**
 * Reads GET /provider/access-state — the backend's single answer to "may this provider open the dashboard?".
 * Nothing is persisted: concurrent reads of one navigation share one request, and every new navigation asks again.
 * `latest` only mirrors the last answer for display (sidebar); it is never used as the source of an access decision.
 */
@Injectable({ providedIn: 'root' })
export class ProviderAccessService {
	private http = inject(HttpClient);
	private authStore = inject(AuthStore);

	private inflight: Observable<ProviderAccessState> | null = null;
	private readonly _latest = signal<ProviderAccessState | null>(null);
	/** The most recent backend answer (display only). Cleared by invalidate() and on logout. */
	readonly latest = this._latest.asReadonly();

	constructor() {
		// logout (or any session end) drops what was read for the previous user
		// a different user / role in the same SPA instance (logout -> login, switch-active-role) must never see the previous answer
		let lastKey: string | null | undefined;
		effect(() => {
			const u: any = this.authStore.currentUser?.();
			const key = u ? `${u.id ?? u.email ?? ''}:${u.activeRole ?? ''}:${u.accountType ?? ''}` : null;
			if (lastKey !== undefined && key !== lastKey) this.invalidate();
			lastKey = key;
		});
	}

	/** Always asks the backend; a call made while another is still in flight shares it. Errors propagate (callers decide: closed). */
	load(): Observable<ProviderAccessState> {
		if (this.inflight) return this.inflight;
		const req = this.http.get<{ success: boolean; data: ProviderAccessState }>(`${environment.url_api}/provider/access-state`).pipe(
			map(res => {
				const d = res?.success ? res.data : null;
				if (!d || typeof d.state !== 'string') throw new Error('invalid access-state response');
				return { ...d, canAccessDashboard: d.canAccessDashboard === true, specialties: Array.isArray(d.specialties) ? d.specialties : [] } as ProviderAccessState;
			}),
			tap(s => this._latest.set(s)),
			finalize(() => { if (this.inflight === shared) this.inflight = null; }),
			shareReplay({ bufferSize: 1, refCount: false })
		);
		const shared = req;
		this.inflight = shared;
		return shared;
	}

	/** After the test finished, a sample upload, or logout: forget the last answer and any request in flight. */
	invalidate(): void {
		this.inflight = null;
		this._latest.set(null);
	}
}
