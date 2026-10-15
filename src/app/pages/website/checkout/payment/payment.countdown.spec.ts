import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CheckoutPaymentComponent } from './payment';
import { CartService } from '../../../../core/services/cart.service';
import { CheckoutService } from '../../../../core/services/checkout.service';
import { CheckoutApiService } from '../../../../core/services/checkout-api.service';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

// A 429 on the wallet payment is a wait, never a payment failure: the page stays, keeps the order and consent, shows the countdown on the pay button only,
// and never pays again by itself at zero.
describe('CheckoutPaymentComponent countdown (429)', () => {
	beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z')); localStorage.clear(); });
	afterEach(() => { vi.useRealTimers(); localStorage.clear(); TestBed.resetTestingModule(); });

	function mount(initiate: ReturnType<typeof vi.fn>) {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			imports: [CheckoutPaymentComponent],
			providers: [
				provideRouter([{ path: '**', component: BlankTestComponent }]),
				{ provide: CartService, useValue: { items: signal([]), itemCount: signal(1), subtotal: signal(0), discount: signal(0), total: signal(4500), coupon: signal(null), couponNotice: signal(null) } },
				{ provide: CheckoutService, useValue: { currentOrder: signal({ id: 'o1', total: 4500, subtotal: 4500, discount: 0 }), initiatePayment: initiate } },
				{ provide: CheckoutApiService, useValue: { getPaymentMethods: () => of({ data: [{ id: 'wallet', balance: 10000 }] }) } },
			],
		});
		const f = TestBed.createComponent(CheckoutPaymentComponent);
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		f.detectChanges();
		const c: any = f.componentInstance;
		c.agreedToTerms.set(true); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const btn = () => el.querySelector('.btn-pay') as HTMLButtonElement;
		return { f, c, el, btn, navigate };
	}
	const limited = (endsAt?: number) => of({ success: false, message: 'محاولات دفع كثيرة', errorKind: 'RATE_LIMITED', ...(endsAt != null ? { retryEndsAt: endsAt } : {}) });

	it('429 with a stated end: stays on the page, pay button disabled with «بعد m:ss», sentence ticks, enabled at zero with NO second request, no failure navigation', () => {
		const initiate = vi.fn(() => limited(Date.now() + 90_000));
		const { f, c, el, btn, navigate } = mount(initiate);
		c.payNow(); f.detectChanges();
		expect(initiate).toHaveBeenCalledTimes(1);
		expect(navigate).not.toHaveBeenCalled();
		expect(btn().disabled).toBe(true);
		expect(el.querySelector('[data-testid="pay-wait"]')!.textContent).toContain('بعد 1:30');
		expect(el.querySelector('[data-testid="rate-limit-msg"]')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد 1:30');
		expect(el.textContent).not.toContain('حدث خطأ في الخادم');
		expect(el.textContent).not.toContain('لا توجد بيانات');
		c.payNow(); expect(initiate).toHaveBeenCalledTimes(1); // locked
		vi.advanceTimersByTime(30_000); f.detectChanges();
		expect(el.querySelector('[data-testid="pay-wait"]')!.textContent).toContain('بعد 1:00');
		vi.advanceTimersByTime(61_000); f.detectChanges();
		expect(btn().disabled).toBe(false);
		expect(el.querySelector('[data-testid="rate-limit-msg"]')).toBeNull();
		expect(initiate).toHaveBeenCalledTimes(1); // zero never pays by itself
		expect(c.agreedToTerms()).toBe(true); // consent kept
	});

	it('429 with NO stated time: honest sentence without a number; the button stays usable', () => {
		const { f, c, el, btn } = mount(vi.fn(() => limited()));
		c.payNow(); f.detectChanges();
		const t = el.querySelector('[data-testid="rate-limit-msg"]')!.textContent!;
		expect(t).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد قليل');
		expect(t).not.toMatch(/\d/);
		expect(btn().disabled).toBe(false);
		expect(el.querySelector('[data-testid="pay-wait"]')).toBeNull();
	});

	it('refresh: a new page instance keeps the pay wait', () => {
		const first = mount(vi.fn(() => limited(Date.now() + 60_000)));
		first.c.payNow();
		vi.advanceTimersByTime(25_000);
		const second = mount(vi.fn());
		second.f.detectChanges();
		expect(second.btn().disabled).toBe(true);
		expect(second.c.payWait.remainingSeconds()).toBe(35);
	});
});
