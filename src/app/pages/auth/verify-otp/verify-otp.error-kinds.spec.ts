import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { vi } from 'vitest';
import { VerifyOtp } from './verify-otp';
import { AuthStore } from '../../../core/store/auth.store';
import { AuthApiService } from '../../../core/services/auth-api.service';

// The code boxes are marked invalid ONLY when the message is about the code (wrong / expired / locked / not six digits).
// A server, gateway, network or limit failure says nothing about a code that may be right: general message, boxes untouched, digits kept.
describe('verify-otp: which failures mark the code boxes', () => {
	function mount(failure: any) {
		TestBed.configureTestingModule({ imports: [VerifyOtp], providers: [provideRouter([]),
			{ provide: AuthStore, useValue: { isPendingVerification: () => true, token: () => null, pendingUserId: () => 'u1' } },
			{ provide: AuthApiService, useValue: { verifyOtp: vi.fn(() => throwError(() => failure)), resendOtp: vi.fn(), isLoginOtpPending: () => true } }] });
		const f = TestBed.createComponent(VerifyOtp); f.detectChanges();
		const c = f.componentInstance as any; c.otpCtrl.setValue('123456'); c.verify(); f.detectChanges();
		return { c, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => TestBed.resetTestingModule());
	const marked = (el: HTMLElement) => el.querySelectorAll('.otp-box[aria-invalid="true"]').length;
	const http = (status: number, error: any = null) => new HttpErrorResponse({ status, error });

	it('wrong / expired code (400): boxes marked, message shown', () => {
		const { c, el } = mount(http(400, { message: 'رمز التحقق غير صحيح' }));
		expect(c.errorMsg).toBe('رمز التحقق غير صحيح'); expect(marked(el)).toBe(6);
	});
	it('attempts locked (429 + OTP_ATTEMPTS_LOCKED): boxes marked, a NEW code is asked for', () => {
		const { c, el } = mount(http(429, { code: 'OTP_ATTEMPTS_LOCKED', message: 'تم تجاوز عدد المحاولات المسموح به، يرجى طلب رمز جديد' }));
		expect(c.errorMsg).toContain('رمز جديد'); expect(marked(el)).toBe(6);
	});
	it('500 / 502 / 504 / network: honest general message, boxes NOT marked, the digits stay', () => {
		for (const failure of [http(500, { code: 'INTERNAL_ERROR', traceId: 'ABCD1234', message: 'x' }), http(502, '<html>Bad Gateway</html>'), http(504, ''), http(0)]) {
			const { c, el } = mount(failure);
			expect(c.errorMsg.length).toBeGreaterThan(20); expect(marked(el)).toBe(0); expect(c.otpCtrl.value).toBe('123456');
			TestBed.resetTestingModule();
		}
	});
	it('the trace id reaches the screen for an unexpected failure', () => {
		const { el } = mount(http(500, { code: 'INTERNAL_ERROR', traceId: 'ABCD1234', message: 'x' }));
		expect(el.textContent).toContain('ABCD1234');
	});
});
