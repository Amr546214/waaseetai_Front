import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CheckoutPaymentComponent } from './payment';
import { CartService } from '../../../../core/services/cart.service';
import { CheckoutService } from '../../../../core/services/checkout.service';
import { CheckoutApiService } from '../../../../core/services/checkout-api.service';

@Component({ selector: 'app-test-blank2', template: '' })
class Blank {}

// Once the server has created the order, ITS total is what the payment page shows and checks the wallet against — not the cart's local figure.
function setup(opts: { cartTotal: number; order?: { subtotal: number; discount: number; total: number }; balance: number; createdOrder?: { subtotal: number; discount: number; total: number } }) {
	const order = signal<any>(opts.order ? { id: 'o1', ...opts.order } : null);
	const initiatePayment = vi.fn(() => of({ success: true }));
	const createOrder = vi.fn(() => { order.set({ id: 'o1', ...opts.createdOrder }); return of({ success: true, message: 'ok', data: order() }); });
	TestBed.configureTestingModule({ imports: [CheckoutPaymentComponent], providers: [provideRouter([{ path: '**', component: Blank }]),
		{ provide: CartService, useValue: { items: signal([]), itemCount: signal(1), subtotal: signal(opts.cartTotal), discount: signal(0), total: signal(opts.cartTotal), coupon: signal(null), couponNotice: signal(null) } },
		{ provide: CheckoutService, useValue: { currentOrder: order, initiatePayment, createOrder } },
		{ provide: CheckoutApiService, useValue: { getPaymentMethods: () => of({ success: true, data: [{ id: 'wallet', balance: opts.balance }] }) } }] });
	const f = TestBed.createComponent(CheckoutPaymentComponent);
	vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
	f.detectChanges();
	return { f, c: f.componentInstance, initiatePayment, createOrder, text: () => (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ') };
}

describe('payment page shows the order\'s real total', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('with an order created by the server, the displayed subtotal / discount / total are the ORDER\'s, not the cart\'s', () => {
		const s = setup({ cartTotal: 900, order: { subtotal: 1000, discount: 50, total: 950 }, balance: 5000 });
		expect(s.c.total()).toBe(950); expect(s.c.discount()).toBe(50); expect(s.c.subtotal()).toBe(1000);
		expect(s.text()).toContain('950');
	});

	it('before an order exists the cart\'s (server-validated) figures are used', () => {
		const s = setup({ cartTotal: 900, balance: 5000 });
		expect(s.c.total()).toBe(900);
	});

	it('the wallet check uses the order total: cart says it fits, the order total does not => insufficient', () => {
		const s = setup({ cartTotal: 900, order: { subtotal: 1000, discount: 0, total: 1000 }, balance: 950 });
		expect(s.c.hasSufficientBalance()).toBe(false);
		expect(s.c.shortfall()).toBe(50);
	});

	it('when creating the order reveals a higher final total than the wallet covers, the payment is NOT started and the shortfall is shown', () => {
		const s = setup({ cartTotal: 900, balance: 950, createdOrder: { subtotal: 1000, discount: 0, total: 1000 } });
		s.c.agreedToTerms.set(true);
		(s.c as any).walletBalance.set(950);
		// the cart total (900) fits the 950 balance, so payNow proceeds to createOrder ...
		expect(s.c.canPay()).toBe(true);
		s.c.payNow();
		// ... and the order's real total (1000) does not: stop, explain, never initiate the payment
		expect(s.createOrder).toHaveBeenCalledTimes(1);
		expect(s.initiatePayment).not.toHaveBeenCalled();
		expect(s.c.errorMessage()).toContain('إجمالي الطلب النهائي 1000');
		expect(s.c.errorMessage()).toContain('يلزم شحن 50');
		expect(s.c.isProcessing()).toBe(false);
	});

	it('when the order total is covered, the payment starts as before', () => {
		const s = setup({ cartTotal: 900, balance: 5000, createdOrder: { subtotal: 1000, discount: 100, total: 900 } });
		s.c.agreedToTerms.set(true);
		(s.c as any).walletBalance.set(5000);
		s.c.payNow();
		expect(s.initiatePayment).toHaveBeenCalledTimes(1);
	});
});
