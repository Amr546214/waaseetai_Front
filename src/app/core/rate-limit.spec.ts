import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RATE_LIMIT_MESSAGE, handleLoadError, isRateLimitError, retryAfterSeconds } from './utils/rate-limit.util';
import { rateLimitInterceptor, resetRateLimitToastClock } from './interceptors/rate-limit.interceptor';
import { UiNotificationService } from './services/ui-notification.service';
import { AuthStore } from './store/auth.store';
import { ProviderAccessService, ProviderAccessState } from './services/provider-access.service';
import { providerProfileCompleteGuard } from './guards/profile-complete.guard';
import { ProviderApiService } from './services/provider-api.service';

const e429 = (extra: any = {}) => new HttpErrorResponse({ status: 429, error: { message: 'طلبات كثيرة من هذا الجهاز، حاول مرة أخرى بعد 5 دقائق' }, ...extra });

describe('rate-limit util', () => {
	it('detects 429 (status or Arabic text) and nothing else', () => {
		expect(isRateLimitError(e429())).toBe(true);
		expect(isRateLimitError({ status: 0, error: { message: 'طلبات كثيرة من هذا الجهاز' } })).toBe(true);
		for (const s of [401, 403, 404, 500]) expect(isRateLimitError(new HttpErrorResponse({ status: s }))).toBe(false);
		expect(isRateLimitError(null)).toBe(false);
	});
	it('retryAfterSeconds: header first, then the minutes in the message', () => {
		expect(retryAfterSeconds(e429({ headers: new HttpHeaders({ 'Retry-After': '2' }) }))).toBe(2);
		expect(retryAfterSeconds(e429())).toBe(300);
		expect(retryAfterSeconds(new HttpErrorResponse({ status: 429, error: { message: 'x' } }))).toBeNull();
	});
	it('handleLoadError: 429 keeps data (no empty), 429 without data -> rate-limit state, other errors unchanged', () => {
		const h = () => ({ hasData: vi.fn(() => true), onKeep: vi.fn(), onRateLimit: vi.fn(), onOtherError: vi.fn() });
		const a = h(); handleLoadError(e429(), a);
		expect(a.onKeep).toHaveBeenCalled(); expect(a.onOtherError).not.toHaveBeenCalled(); expect(a.onRateLimit).not.toHaveBeenCalled();
		const b = h(); b.hasData.mockReturnValue(false); handleLoadError(e429(), b);
		expect(b.onRateLimit).toHaveBeenCalled(); expect(b.onOtherError).not.toHaveBeenCalled();
		const c = h(); handleLoadError(new HttpErrorResponse({ status: 500 }), c);
		expect(c.onOtherError).toHaveBeenCalled();
	});
});

describe('rateLimitInterceptor', () => {
	function setup() {
		resetRateLimitToastClock();
		const warning = vi.fn();
		TestBed.configureTestingModule({
			providers: [provideRouter([]), provideHttpClient(withInterceptors([rateLimitInterceptor])), provideHttpClientTesting(), { provide: UiNotificationService, useValue: { warning } }],
		});
		const router = TestBed.inject(Router);
		return { warning, nav: vi.spyOn(router, 'navigateByUrl'), http: TestBed.inject(HttpClient), ctl: TestBed.inject(HttpTestingController) };
	}
	afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });

	it('20 failing requests give ONE toast; the original 429 reaches the caller; no navigation', () => {
		const { warning, nav, http, ctl } = setup();
		const errs: any[] = [];
		for (let i = 0; i < 20; i++) http.post('/api/x' + i, {}).subscribe({ error: e => errs.push(e) });
		for (let i = 0; i < 20; i++) ctl.expectOne('/api/x' + i).flush({ message: 'm' }, { status: 429, statusText: 'Too Many' });
		expect(warning).toHaveBeenCalledTimes(1);
		expect(warning).toHaveBeenCalledWith(RATE_LIMIT_MESSAGE);
		expect(errs.length).toBe(20);
		expect(errs.every(isRateLimitError)).toBe(true);
		expect(nav).not.toHaveBeenCalled();
	});
	it('GET with a short Retry-After retries ONCE, then fails; POST never retries; a long wait does not retry', () => {
		vi.useFakeTimers();
		const { http, ctl } = setup();
		let err: any; let ok: any;
		http.get('/api/a').subscribe({ next: v => (ok = v), error: e => (err = e) });
		ctl.expectOne('/api/a').flush({}, { status: 429, statusText: 'x', headers: { 'Retry-After': '2' } });
		vi.advanceTimersByTime(2100);
		ctl.expectOne('/api/a').flush({ fine: true });
		expect(ok).toEqual({ fine: true }); expect(err).toBeUndefined();

		http.get('/api/b').subscribe({ error: e => (err = e) });
		ctl.expectOne('/api/b').flush({}, { status: 429, statusText: 'x', headers: { 'Retry-After': '1' } });
		vi.advanceTimersByTime(1100);
		ctl.expectOne('/api/b').flush({}, { status: 429, statusText: 'x', headers: { 'Retry-After': '1' } });
		vi.advanceTimersByTime(5000);
		ctl.expectNone('/api/b');
		expect(err.status).toBe(429);

		http.post('/api/c', {}).subscribe({ error: () => {} });
		ctl.expectOne('/api/c').flush({}, { status: 429, statusText: 'x', headers: { 'Retry-After': '1' } });
		vi.advanceTimersByTime(5000);
		ctl.expectNone('/api/c');

		http.get('/api/d').subscribe({ error: () => {} });
		ctl.expectOne('/api/d').flush({}, { status: 429, statusText: 'x', headers: { 'Retry-After': '300' } });
		vi.advanceTimersByTime(10000);
		ctl.expectNone('/api/d');
	});
	it('auth attempts keep their own messages: no toast, no retry', () => {
		const { warning, http, ctl } = setup();
		http.get('/api/auth/login').subscribe({ error: () => {} });
		ctl.expectOne('/api/auth/login').flush({}, { status: 429, statusText: 'x', headers: { 'Retry-After': '1' } });
		expect(warning).not.toHaveBeenCalled();
	});
	it('non-429 errors pass untouched (no toast)', () => {
		const { warning, http, ctl } = setup();
		let err: any;
		http.post('/api/z', {}).subscribe({ error: e => (err = e) });
		ctl.expectOne('/api/z').flush({}, { status: 403, statusText: 'Forbidden' });
		expect(err.status).toBe(403); expect(warning).not.toHaveBeenCalled();
	});
});

describe('ProviderAccessService on 429', () => {
	const approved = { success: true, data: { state: 'APPROVED', canAccessDashboard: true, message: '', reason: null, hasSample: true, specialties: [] } };
	function setup() {
		TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthStore, useValue: { currentUser: signal<any>({ id: 'u' }) } }] });
		const router = TestBed.inject(Router);
		return { svc: TestBed.inject(ProviderAccessService), http: TestBed.inject(HttpTestingController), nav: vi.spyOn(router, 'navigateByUrl') };
	}
	afterEach(() => TestBed.resetTestingModule());
	const rl = { status: 429, statusText: 'Too Many' };

	it('approved stays approved after a 429 (last good), nothing is redirected, latest is not cleared', async () => {
		const { svc, http, nav } = setup();
		svc.load().subscribe();
		http.expectOne(r => r.url.endsWith('/provider/access-state')).flush(approved);
		const p = firstValueFrom(svc.load());
		http.expectOne(r => r.url.endsWith('/provider/access-state')).flush({ message: 'x' }, rl);
		expect((await p).canAccessDashboard).toBe(true);
		expect(svc.latest()?.state).toBe('APPROVED');
		expect(nav).not.toHaveBeenCalled();
	});
	it('a known NOT approved state stays not approved on a 429', async () => {
		const { svc, http } = setup();
		svc.load().subscribe();
		http.expectOne(r => r.url.endsWith('/provider/access-state')).flush({ success: true, data: { ...approved.data, state: 'PENDING_REVIEW', canAccessDashboard: false } });
		const p = firstValueFrom(svc.load());
		http.expectOne(r => r.url.endsWith('/provider/access-state')).flush({}, rl);
		expect((await p).canAccessDashboard).toBe(false);
	});
	it('invalidate() does not drop the last good state used for a 429', async () => {
		const { svc, http } = setup();
		svc.load().subscribe();
		http.expectOne(r => r.url.endsWith('/provider/access-state')).flush(approved);
		svc.invalidate();
		const p = firstValueFrom(svc.load());
		http.expectOne(r => r.url.endsWith('/provider/access-state')).flush({}, rl);
		expect((await p).state).toBe('APPROVED');
	});
	it('no prior state: the 429 propagates (callers must not read it as "not approved"); 403 and 401 propagate as before', async () => {
		for (const status of [429, 403, 401]) {
			const { svc, http } = setup();
			let err: any;
			svc.load().subscribe({ error: e => (err = e) });
			http.expectOne(r => r.url.endsWith('/provider/access-state')).flush({}, { status, statusText: 'x' });
			expect(err.status).toBe(status);
			TestBed.resetTestingModule();
		}
	});
	it('a real 403 after an approved answer is NOT masked by last good', () => {
		const { svc, http } = setup();
		svc.load().subscribe();
		http.expectOne(r => r.url.endsWith('/provider/access-state')).flush(approved);
		let err: any;
		svc.load().subscribe({ error: e => (err = e) });
		http.expectOne(r => r.url.endsWith('/provider/access-state')).flush({}, { status: 403, statusText: 'x' });
		expect(err.status).toBe(403);
	});
});

describe('providerProfileCompleteGuard on a 429 with no prior state', () => {
	it('goes to the status page (allow-listed, neutral retry state) and never to the wizard', async () => {
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]), { provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: AuthStore, useValue: { isInitialized$: new BehaviorSubject(true), currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
				{ provide: ProviderAccessService, useValue: { load: () => throwError(() => e429()) } },
				{ provide: ProviderApiService, useValue: {} },
			],
		});
		const out = TestBed.runInInjectionContext(() => providerProfileCompleteGuard({ data: {} } as any, { url: '/provider-overview/offers' } as any));
		const r = await firstValueFrom(out as Observable<boolean | UrlTree>);
		expect(r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : r).toBe('/provider-overview/account-actions');
		TestBed.resetTestingModule();
	});
});
