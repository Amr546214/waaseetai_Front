import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';

import { CheckoutFailureComponent } from './failure';
import { CheckoutService } from '../../../../core/services/checkout.service';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

/**
 * Regression coverage: the checkout failure screen must never claim a card
 * was declined (WaseetAI checkout is wallet-only; PayPal is a wallet-
 * funding rail, never introduced here as a direct checkout method), and
 * must not overclaim a definitive "failed" state the backend response
 * didn't actually establish.
 */
function setup() {
	const fakeCheckoutService = {
		currentOrder: signal(null),
		error: signal<string | null>(null),
	};

	TestBed.configureTestingModule({
		imports: [CheckoutFailureComponent],
		providers: [
			provideRouter([{ path: '**', component: BlankTestComponent }]),
			{ provide: CheckoutService, useValue: fakeCheckoutService },
		],
	});

	const fixture: ComponentFixture<CheckoutFailureComponent> = TestBed.createComponent(CheckoutFailureComponent);
	return { fixture };
}

describe('CheckoutFailureComponent — no card-payment language, wallet-correct copy', () => {
	it('contains no card/CVV/card-decline language anywhere on the page', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';

		expect(text).not.toContain('بطاقة');
		expect(text).not.toContain('CVV');
		expect(text).not.toContain('نفس البطاقة');
	});

	it('does not offer a "change payment method" action (wallet is the only method — no direct PayPal/card checkout is introduced)', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';

		expect(text).not.toContain('تغيير طريقة الدفع');
	});

	it('does not overclaim that money was debited or that payment definitively failed', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';

		expect(text).not.toContain('تعذّر تحصيل المبلغ');
		expect(text).toContain('لم يتم تأكيد العملية');
	});

	it('still offers a retry action back to the payment step', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const retryLink = (fixture.nativeElement as HTMLElement).querySelector('a[href="/checkout/payment"]');
		expect(retryLink).toBeTruthy();
	});
});
