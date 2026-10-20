import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CheckoutService, OTP_MAIL_FAILED_MESSAGE } from './checkout.service';
import { AuthStore } from '../store/auth.store';

// The backend now says whether the mail server took the payment code (`emailSent`). After a known failure the checkout never says "sent".
function setup(answer: any) {
	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
	TestBed.configureTestingModule({ providers: [
		{ provide: HttpClient, useValue: { post: () => of({ success: true, data: answer }), get: () => of({ success: true, data: [] }) } },
		{ provide: AuthStore, useValue: { isAuthenticated: signal(false), currentUser: signal(null) } },
	] });
	const service = TestBed.inject(CheckoutService);
	(service as any)._currentOrder.set({ id: 'order-1', orderNumber: 'ORD-1', total: 4500, status: 'pending_payment', items: [] });
	return service;
}
const first = <T>(o: any) => new Promise<T>(r => o.subscribe(r));

describe('checkout: payment code mail result', () => {
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });
	const base = { paymentReference: 'pr-1', otpSentTo: 'a***@x.com', expiresAt: new Date(Date.now() + 120_000).toISOString() };

	it('emailSent false: initiate and resend fail honestly (stay on the page, no "sent")', async () => {
		const s = setup({ ...base, emailSent: false });
		const a: any = await first(s.initiatePayment('wallet'));
		expect(a.success).toBe(false); expect(a.message).toBe(OTP_MAIL_FAILED_MESSAGE); expect(a.errorKind).toBe('VALIDATION');
		const b: any = await first(s.resendOtp());
		expect(b.success).toBe(false); expect(b.message).toBe(OTP_MAIL_FAILED_MESSAGE);
	});
	it('emailSent true or absent (older backend): unchanged success', async () => {
		for (const extra of [{ emailSent: true }, {}]) {
			TestBed.resetTestingModule();
			const s = setup({ ...base, ...extra });
			expect(((await first(s.initiatePayment('wallet'))) as any).success).toBe(true);
			expect(((await first(s.resendOtp())) as any).success).toBe(true);
		}
	});
});
