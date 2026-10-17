import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, catchError, filter, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { isRateLimitError } from '../utils/rate-limit.util';
import { environment } from '../../../environments/environment';
import { AccountType, UserRole } from '../models/auth.model';
import { AuthStore } from '../store/auth.store';
import { isOnboardingAllowedPath } from '../guards/profile-complete.guard';

export type ProviderAccessStateKind = 'SETUP_INCOMPLETE' | 'ASSESSMENT_REQUIRED' | 'SAMPLE_REQUIRED' | 'PENDING_REVIEW' | 'COMPLETION_REQUIRED' | 'REJECTED' | 'APPROVED' | 'NOT_APPLICABLE';

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
	/** server-derived entry gate: SETUP (only the completion page) | REVIEW (the actions log, completion, help, account) | OPEN (operating dashboard) */
	gate?: 'SETUP' | 'REVIEW' | 'OPEN';
	completionSampleId?: string | null;
	canAccessDashboard: boolean;
	message: string;
	reason: string | null;
	hasSample: boolean;
	specialties: ProviderAccessSpecialty[];
}

/** «إجراءات الحساب»: where an account that is not approved yet waits (replaces the old standalone approval-status page). */
export const PROVIDER_ACCOUNT_ACTIONS_URL = '/provider-overview/account-actions';
/** the retired page; its route redirects to the actions log so old links keep working */
export const PROVIDER_LEGACY_STATUS_URL = '/provider-overview/accreditation-status';
export const PROVIDER_ACCESS_STATUS_URL = PROVIDER_ACCOUNT_ACTIONS_URL;
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
	private router = inject(Router);

	private inflight: Observable<ProviderAccessState> | null = null;
	private readonly _latest = signal<ProviderAccessState | null>(null);
	/** The most recent backend answer (display only). Cleared by invalidate() and on logout. */
	readonly latest = this._latest.asReadonly();
	/**
	 * The last REAL backend answer for the current user/role, kept in memory only. Unlike `latest` it survives invalidate(); it is used solely
	 * when the check itself is rate limited (HTTP 429), so a temporary condition never changes the user's state. Dropped on logout / user or role change.
	 */
	private lastGood: ProviderAccessState | null = null;

	constructor() {
		// the guard may have passed on a stale answer: every route change re-checks against the last known state
		this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.enforce(this._latest()));

		// logout (or any session end) drops what was read for the previous user
		// a different user / role in the same SPA instance (logout -> login, switch-active-role) must never see the previous answer
		let lastKey: string | null | undefined;
		effect(() => {
			const u: any = this.authStore.currentUser?.();
			const key = u ? `${u.id ?? u.email ?? ''}:${u.activeRole ?? ''}:${u.accountType ?? ''}` : null;
			if (lastKey !== undefined && key !== lastKey) { this.invalidate(); this.lastGood = null; }
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
			tap(s => { this.lastGood = s; this._latest.set(s); this.enforce(s); }),
			// 429 = temporary: answer with the last known state (approved stays approved, not-approved stays as it was) and do not touch `latest`/redirects.
			// No prior state -> the error propagates; callers must NOT read it as "not approved" (see isRateLimitError).
			catchError(err => isRateLimitError(err) && this.lastGood ? of(this.lastGood) : throwError(() => err)),
			finalize(() => { if (this.inflight === shared) this.inflight = null; }),
			shareReplay({ bufferSize: 1, refCount: false })
		);
		const shared = req;
		this.inflight = shared;
		return shared;
	}

	/**
	 * State watcher: a fresh answer (or a route change) for a non-company PROVIDER session that says "not open" while the app sits on a non-onboarding
	 * provider page moves it to the wizard / status page. No toast; the target is on the allow-list so it cannot loop. Errors never reach here (do nothing).
	 */
	private enforce(s: ProviderAccessState | null): void {
		if (!s || s.canAccessDashboard === true) return;
		const u: any = this.authStore.currentUser?.();
		if (!u || u.accountType === AccountType.PROVIDER_COMPANY) return;
		if (u.activeRole && u.activeRole !== UserRole.PROVIDER) return;
		const url = this.router.url ?? '';
		if (!/^\/provider-overview(\/|\?|#|$)/.test(url) || isOnboardingAllowedPath(url)) return;
		this.router.navigateByUrl(accessRedirectUrl(s));
	}

	/** After the test finished, a sample upload, or logout: forget the last answer and any request in flight. */
	invalidate(): void {
		this.inflight = null;
		this._latest.set(null);
	}
}
