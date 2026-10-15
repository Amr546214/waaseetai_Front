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

	it('429 on a read that succeeded before returns the earlier data (no error, page keeps its data); another account never gets it', () => {
		vi.useFakeTimers();
		const { http, ctl } = setup();
		http.get('/api/client/requests').subscribe(); ctl.expectOne('/api/client/requests').flush({ items: [1, 2] });
		let got: any, err: any;
		http.get('/api/client/requests').subscribe({ next: x => got = x, error: e => err = e });
		ctl.expectOne('/api/client/requests').flush({ message: 'x' }, { status: 429, statusText: 'Too Many' });
		expect(got).toEqual({ items: [1, 2] }); expect(err).toBeUndefined();
		user.set({ id: 'u2', activeRole: 'CLIENT' });
		http.get('/api/client/requests').subscribe({ error: e => err = e });
		ctl.expectOne('/api/client/requests').flush({ message: 'x' }, { status: 429, statusText: 'Too Many' });
		expect(err instanceof HttpErrorResponse && err.status === 429).toBe(true);
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
		expect(warning).toHaveBeenCalledWith('عدد الطلبات كبير، حاول مرة أخرى بعد دقيقتين');
	});
});
