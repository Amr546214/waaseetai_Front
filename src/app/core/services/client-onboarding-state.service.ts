import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import { SKIP_GET_CACHE } from '../interceptors/get-cache.interceptor';
import { AccountType, UserRole } from '../models/auth.model';
import { AuthStore } from '../store/auth.store';
import { ClientSetupData, resolveClientSetup } from '../../pages/dashboard/clients-overview/profile/profile-setup/profile-setup-state';

/** One reading of the individual client's onboarding, taken from the SERVER (never from this browser). */
export interface ClientOnboardingSnapshot {
	setup: ClientSetupData | null;
	/** the identity gate: canAdvance = the data matched automatically OR the administration approved it */
	canAdvance: boolean | null;
	/** the administration's decision on the identity (UNVERIFIED / PENDING / VERIFIED / REJECTED) */
	kycStatus: string | null;
}

export type ClientIdentityBadge = 'PENDING_ADMIN' | 'APPROVED' | null;

const CACHE_MS = 15_000;
/** the individual accounts that can act as a client (their own role, or one added later) */
const INDIVIDUAL_ACCOUNT_TYPES: readonly AccountType[] = [AccountType.CLIENT_INDIVIDUAL, AccountType.PROVIDER_INDIVIDUAL, AccountType.MARKETING_BROKER];

/**
 * Is the individual client allowed into the dashboard yet? Yes once the registration path («استكمال البيانات») is finished AND the identity passed the automatic
 * match (or was approved). After that the administration still approves the identity: until then the menu says «بانتظار اعتماد الإدارة», afterwards «الهوية معتمدة».
 * Unknown (a failed read) never locks anyone out. Companies and other roles are never touched.
 */
@Injectable({ providedIn: 'root' })
export class ClientOnboardingStateService {
	private readonly http = inject(HttpClient);
	private readonly auth = inject(AuthStore);
	private at = 0;
	private uid = '';

	readonly snapshot = signal<ClientOnboardingSnapshot | null>(null);

	/** the gate belongs to the CLIENT ROLE of an individual account: a provider or marketer who added a client account is held by it exactly like a new client (companies are not touched) */
	readonly applies = computed(() => {
		const u = this.auth.currentUser();
		return !!u && INDIVIDUAL_ACCOUNT_TYPES.includes(u.accountType as AccountType) && (u.activeRole ?? UserRole.CLIENT) === UserRole.CLIENT;
	});
	/** the wizard has nothing left to collect (every step saved and agreed) */
	readonly wizardDone = computed(() => {
		const s = this.snapshot(); if (!s) return null;
		// the documents were SENT for the administration's review (kycStatus PENDING) = the person finished their part, even when the saved flags alone would still point at a step
		return resolveClientSetup(s.setup).kind === 'redirect' || s.kycStatus === 'PENDING';
	});
	/** true = open, false = closed, null = not known yet (treated as open) */
	readonly open = computed<boolean | null>(() => {
		if (!this.applies()) return true;
		const s = this.snapshot();
		if (!s || s.canAdvance === null) return null;
		// an administrator-approved identity opens the dashboard even when the rest of «استكمال البيانات» is still to do (it is finished from inside)
		if (s.kycStatus === 'VERIFIED') return true;
		// otherwise open = finished, the identity matched, and no administration review is still pending (PENDING = documents sent, not decided)
		return this.wizardDone() === true && s.canAdvance === true && s.kycStatus !== 'PENDING';
	});
	readonly closed = computed(() => this.open() === false);
	/** the path is finished but the identity has not passed yet: the dashboard is replaced by ONE «قيد المراجعة» page (+ the support contact page) */
	readonly reviewing = computed(() => { const s = this.snapshot(); return this.applies() && !!s && this.wizardDone() === true && (s.canAdvance === false || s.kycStatus === 'PENDING'); });
	/** what the menu shows in the place of «استكمال البيانات» once the registration path is finished */
	readonly badge = computed<ClientIdentityBadge>(() => {
		const s = this.snapshot();
		if (!s || this.wizardDone() !== true) return null;
		return s.kycStatus === 'VERIFIED' ? 'APPROVED' : s.kycStatus === 'PENDING' ? 'PENDING_ADMIN' : null;
	});

	/** reads the state again unless it was read a moment ago (force = after a save) */
	load(force = false): Observable<ClientOnboardingSnapshot | null> {
		const uid = String(this.auth.currentUser()?.id ?? '');
		if (!force && this.snapshot() && uid === this.uid && Date.now() - this.at < CACHE_MS) return of(this.snapshot());
		const ctx = new HttpContext().set(SKIP_LOADING, true).set(SKIP_GET_CACHE, true);
		return forkJoin({
			setup: this.http.get<{ data?: ClientSetupData }>(`${environment.url_api}/client/profile/setup`, { context: ctx }),
			gate: this.http.get<{ data?: { canAdvance?: boolean } }>(`${environment.url_api}/client/profile/setup/identity`, { context: ctx }),
		}).pipe(
			map(({ setup, gate }): ClientOnboardingSnapshot => ({ setup: setup?.data ?? null, canAdvance: typeof gate?.data?.canAdvance === 'boolean' ? gate.data.canAdvance : null, kycStatus: setup?.data?.kycStatus ?? null })),
			tap(s => { this.snapshot.set(s); this.at = Date.now(); this.uid = uid; }),
			catchError(() => of(this.snapshot()))
		);
	}

	/** after a wizard save / a decision: the next navigation reads the real state */
	reset(): void { this.at = 0; }
}
