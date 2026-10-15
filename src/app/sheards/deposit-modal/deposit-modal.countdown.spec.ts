import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DepositModal } from './deposit-modal';
import { LevelsService } from '../../core/levels/levels.service';
import { PaypalDepositService } from '../../core/services/paypal-deposit.service';
import { AuthStore } from '../../core/store/auth.store';
import { WaitTimerService } from '../../core/wait/wait-timer.service';
import { installMemoryStorage } from '../../core/wait/memory-storage.testkit';

// Wallet deposit: a 429 on creating the PayPal order is a wait (sentence + ticking label, no request while it runs, nothing retried at zero), never a generic error.
describe('deposit modal countdown (429 on create order)', () => {
	let restoreStorage: () => void = () => undefined;
	let cfg: any;
	beforeEach(() => {
		restoreStorage = installMemoryStorage();
		vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
		cfg = null;
		(globalThis as any).paypal = { Buttons: (c: any) => { cfg = c; return { render: () => undefined }; } };
	});
	afterEach(() => { vi.useRealTimers(); delete (globalThis as any).paypal; restoreStorage(); TestBed.resetTestingModule(); });

	function mount(createOrder: ReturnType<typeof vi.fn>) {
		TestBed.configureTestingModule({
			imports: [DepositModal],
			providers: [
				{ provide: LevelsService, useValue: { payload: signal({ payments: { clientDeposit: { paypal: 7 }, marketerWithdrawal: {} } }), ensureLoaded: () => undefined } },
				{ provide: PaypalDepositService, useValue: { createOrder } },
				{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'u1', accountType: 'CLIENT_INDIVIDUAL' }) } },
			],
		});
		const f = TestBed.createComponent(DepositModal);
		f.detectChanges();
		const c: any = f.componentInstance;
		c.amount.set(100); c.termsAccepted.set(true);
		f.detectChanges();
		c.initPaypalButtons();
		return { f, c, el: f.nativeElement as HTMLElement };
	}
	const tooMany = (retryAfter: string | null, body: any = { message: 'محاولات دفع كثيرة' }) => throwError(() => ({ status: 429, headers: { get: (k: string) => (k === 'Retry-After' ? retryAfter : null) }, error: body }));

	it('429 with a wait: the sentence ticks, no second request while it runs, the form keeps amount and terms, nothing retried at zero', async () => {
		const createOrder = vi.fn(() => tooMany('60'));
		const { f, c, el } = mount(createOrder);
		expect(cfg).not.toBeNull();
		await expect(cfg.createOrder()).rejects.toThrow();
		f.detectChanges();
		expect(el.querySelector('[data-testid="deposit-rate-limit"]')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد 1:00');
		expect(el.querySelector('[data-testid="deposit-wait"]')!.textContent).toContain('بعد 1:00');
		expect(el.textContent).not.toContain('حدث خطأ في الخادم');
		expect(c.amount()).toBe(100); expect(c.termsAccepted()).toBe(true);
		await expect(cfg.createOrder()).rejects.toThrow(); // blocked locally
		expect(createOrder).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(61_000); f.detectChanges();
		expect(el.querySelector('[data-testid="deposit-rate-limit"]')).toBeNull();
		expect(createOrder).toHaveBeenCalledTimes(1);
	});

	it('429 with no stated time: honest sentence, no number, and the next try goes to the server (it has the last word)', async () => {
		const createOrder = vi.fn(() => tooMany(null));
		const { f, el } = mount(createOrder);
		await expect(cfg.createOrder()).rejects.toThrow();
		f.detectChanges();
		const t = el.querySelector('[data-testid="deposit-rate-limit"]')!.textContent!;
		expect(t).toContain('بعد قليل'); expect(t).not.toMatch(/\d/);
		await expect(cfg.createOrder()).rejects.toThrow();
		expect(createOrder).toHaveBeenCalledTimes(2);
	});

	it('refresh: a new modal keeps the stored wait; timers stop with the component', async () => {
		const first = mount(vi.fn(() => tooMany('90')));
		await expect(cfg.createOrder()).rejects.toThrow();
		vi.advanceTimersByTime(30_000);
		first.f.destroy(); TestBed.resetTestingModule();
		const createOrder = vi.fn(() => of({ success: true, data: { paypalOrderId: 'X' } }));
		const second = mount(createOrder);
		expect(second.c.orderWait.remainingSeconds()).toBe(60);
		await expect(cfg.createOrder()).rejects.toThrow();
		expect(createOrder).not.toHaveBeenCalled();
		const svc = TestBed.inject(WaitTimerService);
		second.f.destroy();
		expect(svc.activeIntervals).toBe(0);
	});
});
