import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CheckoutService } from './checkout.service';
import { AuthStore } from '../store/auth.store';

/**
 * Regression coverage for the checkout error-classification fix: errorKind
 * must be derived ONLY from the real HTTP status code, never from
 * string-matching the Arabic message, and the 402 insufficientBalance shape
 * must remain exactly as before.
 */
function setup() {
	const postSpy = vi.fn<(...args: any[]) => any>();
	const fakeAuthStore = { isAuthenticated: signal(false), currentUser: signal(null) };

	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

	TestBed.configureTestingModule({
		providers: [
			{ provide: HttpClient, useValue: { post: (...args: any[]) => postSpy(...args), get: () => of({ success: true, data: [] }) } },
			{ provide: AuthStore, useValue: fakeAuthStore },
		],
	});

	const service = TestBed.inject(CheckoutService);
	// A real order must be present for initiatePayment()/confirmPayment() to
	// proceed past their own "no active order" guard.
	(service as any)._currentOrder.set({ id: 'order-1', orderNumber: 'ORD-1', total: 4500, status: 'pending_payment', items: [] });
	return { service, postSpy };
}

describe('CheckoutService — error classification (errorKind)', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('classifies a 402 response as INSUFFICIENT_BALANCE and preserves the required/available/shortfall shape', async () => {
		const { service, postSpy } = setup();
		postSpy.mockReturnValue(throwError(() => ({
			status: 402,
			error: { message: 'رصيد المحفظة غير كافٍ', errors: [{ required: 4500, available: 1000, shortfall: 3500 }] }
		})));

		const result = await new Promise<any>(resolve => service.initiatePayment('wallet').subscribe(resolve));

		expect(result.success).toBe(false);
		expect(result.errorKind).toBe('INSUFFICIENT_BALANCE');
		expect(result.insufficientBalance).toEqual({ required: 4500, available: 1000, shortfall: 3500 });
	});

	it('classifies a 409 conflict (e.g. active-purchase guard) as CONFLICT, with the real backend message preserved and no insufficientBalance', async () => {
		const { service, postSpy } = setup();
		const conflictMessage = 'لديك طلب قائم على هذه الخدمة وما زال قيد التنفيذ — لا يمكن شراؤها مرة أخرى قبل اكتمال المشروع الحالي';
		postSpy.mockReturnValue(throwError(() => ({ status: 409, error: { message: conflictMessage } })));

		const result = await new Promise<any>(resolve => service.initiatePayment('wallet').subscribe(resolve));

		expect(result.success).toBe(false);
		expect(result.errorKind).toBe('CONFLICT');
		expect(result.message).toBe(conflictMessage);
		expect(result.insufficientBalance).toBeUndefined();
	});

	it('classifies a 400 business-validation error as VALIDATION', async () => {
		const { service, postSpy } = setup();
		postSpy.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'الطلب لا ينتظر الدفع' } })));

		const result = await new Promise<any>(resolve => service.initiatePayment('wallet').subscribe(resolve));

		expect(result.success).toBe(false);
		expect(result.errorKind).toBe('VALIDATION');
		expect(result.message).toBe('الطلب لا ينتظر الدفع');
	});

	it('classifies a 500 / unexpected server error as UNEXPECTED', async () => {
		const { service, postSpy } = setup();
		postSpy.mockReturnValue(throwError(() => ({ status: 500, error: { message: 'خطأ داخلي' } })));

		const result = await new Promise<any>(resolve => service.initiatePayment('wallet').subscribe(resolve));

		expect(result.success).toBe(false);
		expect(result.errorKind).toBe('UNEXPECTED');
	});

	it('classifies a network failure with no HTTP status at all as UNEXPECTED', async () => {
		const { service, postSpy } = setup();
		postSpy.mockReturnValue(throwError(() => ({ status: 0, message: 'Network error' })));

		const result = await new Promise<any>(resolve => service.initiatePayment('wallet').subscribe(resolve));

		expect(result.success).toBe(false);
		expect(result.errorKind).toBe('UNEXPECTED');
	});

	it('does not derive errorKind from the message text — an unrelated 409 with different wording is still CONFLICT, never string-matched', async () => {
		const { service, postSpy } = setup();
		postSpy.mockReturnValue(throwError(() => ({ status: 409, error: { message: 'نص مختلف تماماً لا علاقة له بالنشاط' } })));

		const result = await new Promise<any>(resolve => service.initiatePayment('wallet').subscribe(resolve));

		expect(result.errorKind).toBe('CONFLICT');
	});
});
