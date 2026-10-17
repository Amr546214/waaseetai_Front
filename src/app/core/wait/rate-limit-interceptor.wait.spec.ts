import { installMemoryStorage } from './memory-storage.testkit';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { rateLimitInterceptor, resetRateLimitToastClock } from '../interceptors/rate-limit.interceptor';
import { UiNotificationService } from '../services/ui-notification.service';
import { rateLimitEndsAt, rateLimitToastMessage, RATE_LIMIT_MESSAGE } from '../utils/rate-limit.util';
import { LAST_RATE_LIMIT_SCOPE, WaitTimerService, httpWaitScope } from './wait-timer.service';

// Central: every 429 leaves its END timestamp (never a decrementing number) under the endpoint's scope; the toast names the real wait; no wait stated = no invented one.
let restoreStorage: () => void = () => undefined;
beforeEach(() => { restoreStorage = installMemoryStorage(); });
afterEach(() => restoreStorage());

describe('rateLimitInterceptor + WaitTimerService', () => {
	beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z')); localStorage.clear(); resetRateLimitToastClock(); });
	afterEach(() => { vi.useRealTimers(); localStorage.clear(); TestBed.resetTestingModule(); });
	function setup() {
		const warning = vi.fn();
		TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(withInterceptors([rateLimitInterceptor])), provideHttpClientTesting(), { provide: UiNotificationService, useValue: { warning } }] });
		return { warning, http: TestBed.inject(HttpClient), ctl: TestBed.inject(HttpTestingController), waits: TestBed.inject(WaitTimerService) };
	}

	it('a POST 429 with Retry-After seconds stores the end under METHOD + path and is never retried', () => {
		const { http, ctl, waits } = setup();
		http.post('/api/auth/resend-otp?x=1', {}).subscribe({ error: () => undefined });
		ctl.expectOne('/api/auth/resend-otp?x=1').flush({ message: 'm' }, { status: 429, statusText: 'x', headers: { 'Retry-After': '45' } });
		expect(waits.remainingMsOf(httpWaitScope('POST', '/api/auth/resend-otp'))).toBe(45_000);
		vi.advanceTimersByTime(60_000);
		ctl.expectNone('/api/auth/resend-otp?x=1');
	});

	it('Retry-After as an HTTP-date and the body fields (retryAt / retryAfterSeconds) are read', () => {
		const { http, ctl, waits } = setup();
		http.post('/api/a', {}).subscribe({ error: () => undefined });
		ctl.expectOne('/api/a').flush({ message: 'm' }, { status: 429, statusText: 'x', headers: { 'Retry-After': new Date(Date.now() + 90_000).toUTCString() } });
		expect(waits.remainingMsOf(httpWaitScope('POST', '/api/a'))).toBe(90_000);
		http.post('/api/b', {}).subscribe({ error: () => undefined });
		ctl.expectOne('/api/b').flush({ message: 'm', retryAt: new Date(Date.now() + 30_000).toISOString() }, { status: 429, statusText: 'x' });
		expect(waits.remainingMsOf(httpWaitScope('POST', '/api/b'))).toBe(30_000);
		http.post('/api/c', {}).subscribe({ error: () => undefined });
		ctl.expectOne('/api/c').flush({ message: 'm', retryAfterSeconds: 12 }, { status: 429, statusText: 'x' });
		expect(waits.remainingMsOf(httpWaitScope('POST', '/api/c'))).toBe(12_000);
	});

	it('the server replaces an earlier end: a second 429 with a different time wins', () => {
		const { http, ctl, waits } = setup();
		for (const s of ['120', '20']) {
			http.post('/api/a', {}).subscribe({ error: () => undefined });
			ctl.expectOne('/api/a').flush({ message: 'm' }, { status: 429, statusText: 'x', headers: { 'Retry-After': s } });
		}
		expect(waits.remainingMsOf(httpWaitScope('POST', '/api/a'))).toBe(20_000);
	});

	it('a 429 without any stated time stores nothing and the toast names no number', () => {
		const { http, ctl, waits, warning } = setup();
		http.get('/api/x').subscribe({ error: () => undefined });
		ctl.expectOne('/api/x').flush({ message: 'm' }, { status: 429, statusText: 'x', headers: { 'Retry-After': 'tomorrow' } });
		expect(waits.remainingMsOf(httpWaitScope('GET', '/api/x'))).toBe(0);
		expect(warning).toHaveBeenCalledWith(RATE_LIMIT_MESSAGE);
		expect(RATE_LIMIT_MESSAGE).not.toMatch(/\d/);
	});

	it('a rate-limited GET also marks the latest-429 scope used by retry buttons; a POST does not', () => {
		const { http, ctl, waits } = setup();
		http.post('/api/p', {}).subscribe({ error: () => undefined });
		ctl.expectOne('/api/p').flush({ message: 'm' }, { status: 429, statusText: 'x', headers: { 'Retry-After': '10' } });
		expect(waits.remainingMsOf(LAST_RATE_LIMIT_SCOPE)).toBe(0);
		http.get('/api/g').subscribe({ error: () => undefined });
		ctl.expectOne('/api/g').flush({ message: 'm' }, { status: 429, statusText: 'x', headers: { 'Retry-After': '99' } });
		expect(waits.remainingMsOf(LAST_RATE_LIMIT_SCOPE)).toBe(99_000);
	});

	it('the 429 line is never combined with a generic server error or "no data"', () => {
		const e = { status: 429, headers: { get: () => '75' }, error: { message: 'x' } };
		const t = rateLimitToastMessage(e);
		expect(t).toBe('طلبات كثيرة، يمكنك إعادة المحاولة بعد دقيقتين');
		expect(t).not.toMatch(/حدث خطأ في الخادم|لا توجد بيانات/);
		expect(rateLimitEndsAt(e)).toBe(Date.now() + 75_000);
	});
});
