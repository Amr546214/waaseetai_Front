import { installMemoryStorage } from '../../core/wait/memory-storage.testkit';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LoadRetryComponent } from './load-retry';
import { LAST_RATE_LIMIT_SCOPE, WaitTimerService, httpWaitScope } from '../../core/wait/wait-timer.service';
import { RATE_LIMIT_MESSAGE } from '../../core/utils/rate-limit.util';

// A list that hit a 429 with nothing loaded: the retry button waits for the server's end timestamp, ticks, never retries by itself.
let restoreStorage: () => void = () => undefined;
beforeEach(() => { restoreStorage = installMemoryStorage(); });
afterEach(() => restoreStorage());

describe('LoadRetryComponent countdown', () => {
	beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z')); localStorage.clear(); });
	afterEach(() => { vi.useRealTimers(); localStorage.clear(); TestBed.resetTestingModule(); });

	function mount(scope?: string) {
		TestBed.resetTestingModule();
		const f = TestBed.createComponent(LoadRetryComponent);
		if (scope) f.componentRef.setInput('waitScope', scope);
		const retry = vi.fn(); f.componentInstance.retry.subscribe(retry);
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		return { f, el, retry, svc: TestBed.inject(WaitTimerService), btn: () => el.querySelector('[data-testid="load-retry-btn"]') as HTMLButtonElement };
	}

	it('no stored wait: the plain 429 message and an enabled button', () => {
		const { el, btn } = mount();
		expect(el.querySelector('[data-testid="load-retry-msg"]')!.textContent).toBe(RATE_LIMIT_MESSAGE);
		expect(btn().disabled).toBe(false);
	});

	it('a stored end for the latest 429: button disabled with the ticking label, sentence ticks, enabled at zero, retry never fires by itself', () => {
		const svc0 = (() => { TestBed.resetTestingModule(); return TestBed.inject(WaitTimerService); })();
		svc0.setEnd(LAST_RATE_LIMIT_SCOPE, Date.now() + 5_000);
		const { f, el, btn, retry } = mount();
		expect(btn().disabled).toBe(true);
		expect(el.querySelector('[data-testid="load-retry-wait"]')!.textContent).toContain('بعد 0:05');
		expect(el.querySelector('[data-testid="load-retry-msg"]')!.textContent).toContain('بعد 0:05');
		btn().click(); expect(retry).not.toHaveBeenCalled();
		vi.advanceTimersByTime(2000); f.detectChanges();
		expect(el.querySelector('[data-testid="load-retry-wait"]')!.textContent).toContain('بعد 0:03');
		vi.advanceTimersByTime(4000); f.detectChanges();
		expect(btn().disabled).toBe(false);
		expect(retry).not.toHaveBeenCalled();
		btn().click(); expect(retry).toHaveBeenCalledTimes(1);
	});

	it('a specific endpoint scope is honoured and another endpoint\'s wait is not', () => {
		const svc0 = (() => { TestBed.resetTestingModule(); return TestBed.inject(WaitTimerService); })();
		svc0.setEnd(httpWaitScope('GET', '/api/offers?page=1'), Date.now() + 30_000);
		expect(mount(httpWaitScope('GET', '/api/offers')).btn().disabled).toBe(true);
		expect(mount(httpWaitScope('GET', '/api/other')).btn().disabled).toBe(false);
	});
});
