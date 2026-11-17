import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { getCacheInterceptor, resetGetCache, FRESH_CACHE_TTL_MS } from './get-cache.interceptor';
import { rateLimitInterceptor, resetRateLimitToastClock } from './rate-limit.interceptor';
import { UiNotificationService } from '../services/ui-notification.service';
import { AuthStore } from '../store/auth.store';

describe('getCacheInterceptor + rateLimitInterceptor', () => {
	const user = signal<any>({ id: 'u1', activeRole: 'CLIENT' });
	let warning: any;
	function setup() {
		resetGetCache(); resetRateLimitToastClock(); warning = vi.fn();
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptors([getCacheInterceptor, rateLimitInterceptor])), provideHttpClientTesting(),
				{ provide: UiNotificationService, useValue: { warning } },
				{ provide: AuthStore, useValue: { currentUser: user } },
			],
		});
		return { http: TestBed.inject(HttpClient), ctl: TestBed.inject(HttpTestingController) };
	}
	afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); user.set({ id: 'u1', activeRole: 'CLIENT' }); });

	it('identical GETs in flight share ONE request', () => {
		const { http, ctl } = setup();
		const out: any[] = [];
		for (let i = 0; i < 4; i++) http.get('/api/client/requests?x=1').subscribe(v => out.push(v));
		ctl.expectOne('/api/client/requests?x=1').flush({ n: 1 });
		expect(out).toEqual([{ n: 1 }, { n: 1 }, { n: 1 }, { n: 1 }]);
		http.get('/api/client/requests?x=1').subscribe();
		ctl.expectOne('/api/client/requests?x=1').flush({ n: 2 }); // not cached: a later call goes out again
	});

	it('stable reads (statistics) are served from memory within the TTL and refetched after it; a successful write clears them', () => {
		vi.useFakeTimers();
		const { http, ctl } = setup();
		http.get('/api/provider/statistics').subscribe();
		ctl.expectOne('/api/provider/statistics').flush({ a: 1 });
		let v: any; http.get('/api/provider/statistics').subscribe(x => v = x);
		ctl.expectNone('/api/provider/statistics'); expect(v).toEqual({ a: 1 });
		http.post('/api/provider/anything', {}).subscribe(); ctl.expectOne('/api/provider/anything').flush({});
		http.get('/api/provider/statistics').subscribe(); ctl.expectOne('/api/provider/statistics').flush({ a: 2 });
		vi.advanceTimersByTime(FRESH_CACHE_TTL_MS + 1);
		http.get('/api/provider/statistics').subscribe(); ctl.expectOne('/api/provider/statistics').flush({ a: 3 });
	});

	it('429 on a public catalog can use the earlier data; another account never gets it', () => {
		vi.useFakeTimers();
		const { http, ctl } = setup();
		http.get('/api/specialties/public').subscribe(); ctl.expectOne('/api/specialties/public').flush({ items: [1, 2] });
		let got: any, err: any;
		http.get('/api/specialties/public').subscribe({ next: x => got = x, error: e => err = e });
		ctl.expectOne('/api/specialties/public').flush({ message: 'x' }, { status: 429, statusText: 'Too Many' });
		expect(got).toEqual({ items: [1, 2] }); expect(err).toBeUndefined();
		user.set({ id: 'u2', activeRole: 'CLIENT' });
		http.get('/api/specialties/public').subscribe({ error: e => err = e });
		ctl.expectOne('/api/specialties/public').flush({ message: 'x' }, { status: 429, statusText: 'Too Many' });
		expect(err instanceof HttpErrorResponse && err.status === 429).toBe(true);
	});

	it.each(['/api/provider/finance/wallet', '/api/provider/access-state', '/api/client/requests', '/api/client/company/dashboard'])('does not disguise a failed sensitive refresh as success: %s', url => {
		const { http, ctl } = setup();
		http.get(url).subscribe(); ctl.expectOne(url).flush({ balance: 100 });
		let got: unknown, status: number | undefined;
		http.get(url).subscribe({ next: value => got = value, error: error => status = error.status });
		ctl.expectOne(url).flush({}, { status: 429, statusText: 'Too Many' });
		expect(got).toBeUndefined(); expect(status).toBe(429); ctl.verify();
	});

	it('a successful write invalidates previous fallback data, including reads still in flight', () => {
		const { http, ctl } = setup();
		const url = '/api/specialties/public';
		http.get(url).subscribe(); const oldRead = ctl.expectOne(url);
		http.post('/api/admin/specialties', {}).subscribe(); ctl.expectOne('/api/admin/specialties').flush({});
		http.get(url).subscribe({ error: () => undefined }); const newRead = ctl.expectOne(url);
		oldRead.flush({ items: ['old'] });
		let status: number | undefined;
		http.get(url).subscribe({ error: error => status = error.status });
		ctl.expectNone(url); // still shares the NEW read, not the completed pre-write one
		newRead.flush({}, { status: 429, statusText: 'Too Many' });
		expect(status).toBe(429); ctl.verify();
	});

	it('a successful write clears previously completed fallback data too', () => {
		const { http, ctl } = setup(); const url = '/api/specialties/public';
		http.get(url).subscribe(); ctl.expectOne(url).flush({ items: ['old'] });
		http.post('/api/admin/specialties', {}).subscribe(); ctl.expectOne('/api/admin/specialties').flush({});
		let status: number | undefined;
		http.get(url).subscribe({ error: error => status = error.status });
		ctl.expectOne(url).flush({}, { status: 429, statusText: 'Too Many' });
		expect(status).toBe(429); ctl.verify();
	});

	it('writes (payment / withdrawal / OTP) are never retried, cached or shared: a 429 reaches the caller once with a single request', () => {
		const { http, ctl } = setup();
		const errs: any[] = [];
		for (const url of ['/api/client/finance/paypal/order/capture', '/api/provider/finance/withdrawals', '/api/auth/resend-otp']) {
			http.post(url, {}).subscribe({ error: e => errs.push(e.status) });
			ctl.expectOne(url).flush({ message: 'm' }, { status: 429, statusText: 'x', headers: { 'Retry-After': '1' } });
		}
		expect(errs).toEqual([429, 429, 429]);
		ctl.verify();
	});

	it('the toast carries the real wait from Retry-After', () => {
		const { http, ctl } = setup();
		http.get('/api/client/other').subscribe({ error: () => undefined });
		ctl.expectOne('/api/client/other').flush({ message: 'm' }, { status: 429, statusText: 'x', headers: { 'Retry-After': '120' } });
		expect(warning).toHaveBeenCalledWith('طلبات كثيرة، يمكنك إعادة المحاولة بعد دقيقتين');
	});
});
