import { installMemoryStorage } from './memory-storage.testkit';
import { Component, DestroyRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { WaitHandle, WaitTimerService, httpWaitScope, waitScope } from './wait-timer.service';
import { WaitLabelComponent } from './wait-label.component';

const STORE = (scope: string) => 'ws:wait:v1:' + scope;

function fresh(): WaitTimerService {
	TestBed.resetTestingModule();
	return TestBed.inject(WaitTimerService);
}

let restoreStorage: () => void = () => undefined;
beforeEach(() => { restoreStorage = installMemoryStorage(); });
afterEach(() => restoreStorage());

describe('WaitTimerService', () => {
	beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z')); localStorage.clear(); });
	afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

	it('ticks every second from an END TIMESTAMP and reaches zero (label gone, action enabled)', () => {
		const svc = fresh();
		const h = svc.track('otp-resend', null);
		expect(h.active()).toBe(false);
		h.start(Date.now() + 3_000);
		expect(h.label()).toBe('بعد 0:03');
		vi.advanceTimersByTime(1000); expect(h.remainingSeconds()).toBe(2); expect(h.label()).toBe('بعد 0:02');
		vi.advanceTimersByTime(1000); expect(h.remainingSeconds()).toBe(1);
		vi.advanceTimersByTime(1000); expect(h.remainingSeconds()).toBe(0); expect(h.active()).toBe(false); expect(h.label()).toBe(''); expect(h.endsAt()).toBeNull();
		expect(svc.activeIntervals).toBe(0);
	});

	it('zero does not fire anything on its own: no HTTP call, no callback', () => {
		const svc = fresh();
		const spy = vi.fn();
		const h = svc.track('payment-send', null);
		h.start(Date.now() + 1_000);
		const unsub = vi.spyOn(globalThis, 'fetch' as any).mockImplementation(spy);
		vi.advanceTimersByTime(5_000);
		expect(h.active()).toBe(false);
		expect(spy).not.toHaveBeenCalled();
		unsub.mockRestore();
	});

	it('returning from a throttled background tab: the remaining time follows the clock, not the number of ticks', () => {
		const svc = fresh();
		const h = svc.track('login-resend', null);
		h.start(Date.now() + 90_000);
		// the browser froze the interval; the wall clock moved 70 s
		vi.setSystemTime(Date.now() + 70_000);
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
		expect(h.remainingSeconds()).toBe(20);
		// and after the full time away it is simply over
		vi.setSystemTime(Date.now() + 60_000);
		window.dispatchEvent(new Event('focus'));
		expect(h.active()).toBe(false);
		expect(svc.activeIntervals).toBe(0);
	});

	it('refresh: a new instance restores the stored end (no fresh duration); an expired entry is ignored and removed', () => {
		const svc = fresh();
		const scope = waitScope('otp-resend', 'A@b.co');
		svc.track(scope, null).start(Date.now() + 45_000);
		vi.advanceTimersByTime(10_000);
		// "reload": a new service/injector, same storage
		const svc2 = fresh();
		const h2 = svc2.track(scope, null);
		expect(h2.remainingSeconds()).toBe(35);
		// another identity does not share it
		expect(svc2.track(waitScope('otp-resend', 'other@b.co'), null).active()).toBe(false);
		// expired entry
		localStorage.setItem(STORE('old'), JSON.stringify({ endsAt: Date.now() - 1000 }));
		const h3 = svc2.track('old', null);
		expect(h3.active()).toBe(false);
		expect(localStorage.getItem(STORE('old'))).toBeNull();
	});

	it('the server has the last word: a newer 429 replaces (extends or shortens) the stored end', () => {
		const svc = fresh();
		const h = svc.track('x', null);
		h.start(Date.now() + 30_000);
		const e = new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '120' }) });
		expect(h.startFromResponse(e)).toBe(Date.now() + 120_000);
		expect(h.remainingSeconds()).toBe(120);
		h.startFromResponse(new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '10' }) }));
		expect(h.remainingSeconds()).toBe(10);
		expect(JSON.parse(localStorage.getItem(STORE('x'))!).endsAt).toBe(Date.now() + 10_000);
	});

	it('a response without any duration starts NO timer (honest, nothing invented)', () => {
		const svc = fresh();
		const h = svc.track('y', null);
		expect(h.startFromResponse(new HttpErrorResponse({ status: 429, error: { message: 'طلبات كثيرة' } }))).toBeNull();
		expect(h.active()).toBe(false);
		expect(svc.activeIntervals).toBe(0);
	});

	it('a wrong code starts no wait unless the server sent one', () => {
		const svc = fresh();
		const h = svc.track('otp-verify-block', null);
		expect(h.startFromResponse(new HttpErrorResponse({ status: 400, error: { message: 'رمز التحقق غير صحيح' } }))).toBeNull();
		expect(h.active()).toBe(false);
		expect(h.startFromResponse(new HttpErrorResponse({ status: 429, error: { message: 'x', retryAfterSeconds: 30 } }))).toBe(Date.now() + 30_000);
		expect(h.active()).toBe(true);
	});

	it('one interval only, however many times the same or other waits start; cleared when the last live handle is destroyed', () => {
		@Component({ selector: 'app-host', template: '', standalone: true })
		class Host { readonly ref = inject(DestroyRef); readonly svc = inject(WaitTimerService); }
		TestBed.resetTestingModule();
		const f = TestBed.createComponent(Host);
		const svc = f.componentInstance.svc;
		const spy = vi.spyOn(globalThis, 'setInterval');
		const a = svc.track('a', f.componentInstance.ref);
		const b = svc.track('b', f.componentInstance.ref);
		a.start(Date.now() + 60_000); a.start(Date.now() + 60_000); b.start(Date.now() + 60_000); a.startIn(30);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(svc.activeIntervals).toBe(1);
		f.destroy();
		expect(svc.activeIntervals).toBe(0);
		// the stored end survives the component (it belongs to the scope, not to the component)
		expect(localStorage.getItem(STORE('b'))).not.toBeNull();
		spy.mockRestore();
	});

	it('clear() stops the wait and removes the stored end; a past end clears too', () => {
		const svc = fresh();
		const h = svc.track('z', null);
		h.start(Date.now() + 5_000); h.clear();
		expect(h.active()).toBe(false); expect(localStorage.getItem(STORE('z'))).toBeNull(); expect(svc.activeIntervals).toBe(0);
		h.start(Date.now() - 1); expect(h.active()).toBe(false);
	});

	it('storage that throws never breaks the wait (in-memory still counts down)', () => {
		const svc = fresh();
		const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
		const boom = () => { throw new Error('blocked'); };
		Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: boom, setItem: boom, removeItem: boom, clear: boom } });
		try {
			const h = svc.track('s', null);
			h.start(Date.now() + 2_000);
			expect(h.active()).toBe(true);
			vi.advanceTimersByTime(2_000);
			expect(h.active()).toBe(false);
		} finally { Object.defineProperty(globalThis, 'localStorage', real); }
	});

	it('scope helpers: identity is hashed (no e-mail in storage keys); http scope drops origin and query', () => {
		expect(waitScope('login', 'User@Mail.com')).toBe(waitScope('login', ' user@mail.com '));
		expect(waitScope('login', 'user@mail.com')).not.toContain('mail');
		expect(waitScope('login')).toBe('login');
		expect(httpWaitScope('post', 'https://api.x.com/api/auth/resend-otp?a=1')).toBe('http:POST:/api/auth/resend-otp');
	});

	it('the label component shows «بعد 1:23» and nothing at zero', () => {
		const f = TestBed.createComponent(WaitLabelComponent);
		f.componentRef.setInput('seconds', 83); f.detectChanges();
		expect(f.nativeElement.querySelector('[data-testid="wait-label"]').textContent.trim()).toBe('بعد 1:23');
		f.componentRef.setInput('seconds', 0); f.detectChanges();
		expect(f.nativeElement.querySelector('[data-testid="wait-label"]')).toBeNull();
	});
});
