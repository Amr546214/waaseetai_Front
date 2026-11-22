import { Injectable, computed, inject, signal } from '@angular/core';
import { SpecialtyService } from './specialty.service';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, catchError, defer, finalize, from, map, of, shareReplay, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import { SKIP_GET_CACHE } from '../interceptors/get-cache.interceptor';
import { SebBrowserProofService } from './seb-browser-proof.service';

export interface ExamEnvironment {
	mode: 'off' | 'required';
	/** required AND configured on the server: only then can a restricted exam start */
	ready: boolean;
	/** Server verified a classic SEB hash or the modern session-bound proof. */
	verified: boolean;
	restricted: boolean;
	jsApiEnabled?: boolean;
	/** the operator declared the integration was tried in a real Safe Exam Browser; keys and settings file being present does NOT mean this */
	testedInRealSeb?: boolean;
	testedNote?: string | null;
	configUrl?: string;
	configDownloadUrl?: string;
	downloadUrl: string;
	supportedSystems: { system: string; supported: boolean; note?: string }[];
	limits: string;
}

/** What the server says about the exam environment. `off` = the normal test (no device restriction); `required` = only a verified Safe Exam Browser may start or continue it. */
@Injectable({ providedIn: 'root' })
export class ExamEnvironmentService {
	private readonly specialty = inject(SpecialtyService);
	private readonly http = inject(HttpClient);
	private readonly proof = inject(SebBrowserProofService);
	private inFlight: Observable<ExamEnvironment | null> | null = null;
	readonly env = signal<ExamEnvironment | null>(null);
	/** restricted mode is on (the page must not start the test unless verified) */
	readonly restricted = computed(() => this.env()?.restricted === true);
	/** the restricted test can run here: required, configured and this browser verified */
	readonly satisfied = computed(() => !this.restricted() || (this.env()?.ready === true && this.env()?.verified === true));
	load(done?: (e: ExamEnvironment | null) => void): void {
		if (!this.inFlight) this.inFlight = defer(() => this.specialty.getExamEnvironment()).pipe(
			switchMap((r: any) => {
				const env = r?.data && typeof r.data.mode === 'string' ? r.data as ExamEnvironment : null;
				this.env.set(env); // keep a required gate closed while the native exchange is pending
				return this.verifyModern(env);
			}),
			catchError(() => of(this.env())),
			finalize(() => { this.inFlight = null; }),
			shareReplay({ bufferSize: 1, refCount: false })
		);
		this.inFlight.subscribe(e => { this.env.set(e); done?.(e); });
	}

	private verifyModern(env: ExamEnvironment | null): Observable<ExamEnvironment | null> {
		if (!env?.restricted || !env.ready || !env.jsApiEnabled) return of(env);
		if (env.verified && !this.proof.needsRenewal()) return of(env);
		this.proof.clear();
		this.env.set({ ...env, verified: false });
		const context = new HttpContext().set(SKIP_LOADING, true).set(SKIP_GET_CACHE, true);
		return from(this.proof.takeInitialChallenge()).pipe(switchMap(initial => {
			if (initial) {
				this.proof.clearChallengeUrl();
				if (!initial.keys) return of({ ...env, verified: false });
				return this.http.post<any>(`${environment.url_api}/exam-environment/js-verify`, { challenge: initial.challenge, ...initial.keys }, { context }).pipe(
					switchMap(r => this.proof.accept(r?.data?.proof, r?.data?.expiresAt) ? this.specialty.getExamEnvironment().pipe(map(r => r?.data ?? { ...env, verified: false })) : of({ ...env, verified: false })),
					catchError(() => of({ ...env, verified: false }))
				);
			}
			const path = this.proof.currentPath();
			if (!path || !this.proof.hasNativeApi()) return of({ ...env, verified: false });
			return this.http.post<any>(`${environment.url_api}/exam-environment/js-challenge`, { path }, { context }).pipe(
				map(r => { if (typeof r?.data?.url === 'string') this.proof.openChallenge(r.data.url); return { ...env, verified: false }; }),
				catchError(() => of({ ...env, verified: false }))
			);
		}));
	}
}
