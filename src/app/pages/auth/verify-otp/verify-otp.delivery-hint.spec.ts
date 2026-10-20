import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { VerifyOtp } from './verify-otp';
import { AuthStore } from '../../../core/store/auth.store';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { OtpHandoffService } from '../../../core/services/otp-handoff.service';
import { OTP_DELIVERY_HINT, maskEmailAddress } from '../../../core/forms/otp-delivery';

// The code step names the address the code was sent to (masked) and tells the user where to look; it never promises delivery.
describe('verify-otp: target address and delivery hint', () => {
	function mount(handoff?: { sent: boolean; message: string; to?: string }) {
		TestBed.configureTestingModule({ imports: [VerifyOtp], providers: [provideRouter([]),
			{ provide: AuthStore, useValue: { isPendingVerification: () => true, token: () => null, pendingUserId: () => 'u1' } },
			{ provide: AuthApiService, useValue: { verifyOtp: vi.fn(), resendOtp: vi.fn(), isLoginOtpPending: () => true } }] });
		if (handoff) TestBed.inject(OtpHandoffService).set(handoff);
		const f = TestBed.createComponent(VerifyOtp);
		f.detectChanges();
		return f.nativeElement as HTMLElement;
	}
	afterEach(() => TestBed.resetTestingModule());

	it('arriving from the login page: masked target + Spam hint, and the hint is extra guidance only (no promise, no disclaimer)', () => {
		const el = mount({ sent: true, message: 'أرسلنا رمز تسجيل الدخول إلى بريدك الإلكتروني، أدخله لإكمال الدخول.', to: maskEmailAddress('amr250010+provider-test2@gmail.com') });
		expect(el.querySelector('[data-testid="otp-target"]')?.textContent).toContain('a***2@gm***.com');
		const hint = el.querySelector('[data-testid="otp-delivery-hint"]')?.textContent ?? '';
		expect(hint).toBe(OTP_DELIVERY_HINT);
		expect(hint).toContain('Spam');
		expect(hint).not.toContain('لا نضمن');
		expect(hint).toContain('إرشاد إضافي');
	});
	it('after a reload (no hand-off): no invented address, the hint stays', () => {
		const el = mount();
		expect(el.querySelector('[data-testid="otp-target"]')).toBeNull();
		expect(el.querySelector('[data-testid="otp-delivery-hint"]')).not.toBeNull();
	});
	it('a refused send shows the refusal, not «sent»: the notice text is the server-driven one', () => {
		const el = mount({ sent: false, message: 'يمكنك استخدام الرمز السابق أو إعادة المحاولة بعد 34 ثانية.', to: 'a***0@gm***.com' });
		expect(el.querySelector('.banner-success')).toBeNull();
		expect(el.querySelector('#banner-error-txt')?.textContent).toContain('34');
	});
	it('maskEmailAddress hides the address and ignores junk', () => {
		expect(maskEmailAddress('ab@x.io')).toBe('a*@x*.io');
		expect(maskEmailAddress('')).toBe('');
		expect(maskEmailAddress('not-an-email')).toBe('');
	});
});
