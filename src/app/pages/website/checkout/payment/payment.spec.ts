import { ComponentFixture, TestBed } from '@angular/core/testing';
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

/**
 * Regression coverage for the checkout error-mapping fix: a real backend
 * business error (409 conflict, 400 validation) must be shown inline and
 * must NEVER navigate to /checkout/failure or be labelled a payment
 * failure. Only a genuinely unexpected failure may reach that screen.
 *
 * proceedToPaymentStep() itself doesn't read cart/order state, so it's
 * exercised directly here (it's a private method, invoked via bracket
 * access — a deliberate, minimal way to unit-test this exact fix without
 * needing to fully populate cart/order/wallet-balance state that this
 * particular code path never touches).
 */
function setup() {
	const initiatePaymentSpy = vi.fn<(...args: any[]) => any>();
	const fakeCheckoutService = {
		currentOrder: signal(null),
		initiatePayment: (...args: any[]) => initiatePaymentSpy(...args),
	};
	const fakeCartService = {
		items: signal([]),
		itemCount: signal(0),
		subtotal: signal(0),
		discount: signal(0),
		total: signal(4500),
		coupon: signal(null),
	};
	const fakeCheckoutApi = {
		getPaymentMethods: () => of({ success: true, data: [{ id: 'wallet', balance: 10000 }] }),
	};

	TestBed.configureTestingModule({
		imports: [CheckoutPaymentComponent],
		providers: [
			provideRouter([{ path: '**', component: BlankTestComponent }]),
			{ provide: CartService, useValue: fakeCartService },
			{ provide: CheckoutService, useValue: fakeCheckoutService },
			{ provide: CheckoutApiService, useValue: fakeCheckoutApi },
		],
	});

	const fixture: ComponentFixture<CheckoutPaymentComponent> = TestBed.createComponent(CheckoutPaymentComponent);
	const component = fixture.componentInstance;
	const router = TestBed.inject(Router);
	const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

	return { fixture, component, initiatePaymentSpy, navigateSpy };
}

describe('CheckoutPaymentComponent — error-kind-driven routing (checkout error-mapping fix)', () => {
	it('402 insufficient balance uses the existing wallet-funding flow — no navigation, no error banner', () => {
		const { fixture, component, initiatePaymentSpy, navigateSpy } = setup();
		fixture.detectChanges();
		initiatePaymentSpy.mockReturnValue(of({
			success: false,
			message: 'رصيد المحفظة غير كافٍ',
			errorKind: 'INSUFFICIENT_BALANCE',
			insufficientBalance: { required: 4500, available: 1000, shortfall: 3500 },
		}));

		(component as any).proceedToPaymentStep();

		expect(navigateSpy).not.toHaveBeenCalled();
		expect(component.errorMessage()).toBeNull();
		expect((component as any).raceInsufficientBalance()).toEqual({ required: 4500, available: 1000, shortfall: 3500 });
	});

	it('409 active-purchase conflict stays inline with the real backend message and NEVER navigates to /checkout/failure', () => {
		const { fixture, component, initiatePaymentSpy, navigateSpy } = setup();
		fixture.detectChanges();
		const conflictMessage = 'لديك طلب قائم على هذه الخدمة وما زال قيد التنفيذ — لا يمكن شراؤها مرة أخرى قبل اكتمال المشروع الحالي';
		initiatePaymentSpy.mockReturnValue(of({ success: false, message: conflictMessage, errorKind: 'CONFLICT' }));

		(component as any).proceedToPaymentStep();

		expect(navigateSpy).not.toHaveBeenCalled();
		expect(component.errorMessage()).toBe(conflictMessage);
		expect(component.isProcessing()).toBe(false);
	});

	it('a safe 400 validation error stays inline and is never labelled a payment/card failure', () => {
		const { fixture, component, initiatePaymentSpy, navigateSpy } = setup();
		fixture.detectChanges();
		initiatePaymentSpy.mockReturnValue(of({ success: false, message: 'الطلب لا ينتظر الدفع', errorKind: 'VALIDATION' }));

		(component as any).proceedToPaymentStep();

		expect(navigateSpy).not.toHaveBeenCalled();
		expect(component.errorMessage()).toBe('الطلب لا ينتظر الدفع');
	});

	it('an unexpected failure (5xx/network) gets neutral failure handling via /checkout/failure', () => {
		const { fixture, component, initiatePaymentSpy, navigateSpy } = setup();
		fixture.detectChanges();
		initiatePaymentSpy.mockReturnValue(of({ success: false, message: 'خطأ داخلي', errorKind: 'UNEXPECTED' }));

		(component as any).proceedToPaymentStep();

		expect(navigateSpy).toHaveBeenCalledWith(['/checkout/failure']);
		expect(component.errorMessage()).toBeNull();
	});

	it('a genuinely thrown/unhandled observable error also falls back to /checkout/failure (defensive path)', () => {
		const { fixture, component, initiatePaymentSpy, navigateSpy } = setup();
		fixture.detectChanges();
		initiatePaymentSpy.mockReturnValue({ subscribe: (handlers: any) => handlers.error(new Error('boom')) });

		(component as any).proceedToPaymentStep();

		expect(navigateSpy).toHaveBeenCalledWith(['/checkout/failure']);
	});

	it('success navigates to /checkout/confirm as before', () => {
		const { fixture, component, initiatePaymentSpy, navigateSpy } = setup();
		fixture.detectChanges();
		initiatePaymentSpy.mockReturnValue(of({ success: true, message: 'تم إرسال رمز التحقق' }));

		(component as any).proceedToPaymentStep();

		expect(navigateSpy).toHaveBeenCalledWith(['/checkout/confirm']);
	});
});
