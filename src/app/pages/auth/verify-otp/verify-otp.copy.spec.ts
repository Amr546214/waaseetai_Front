import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { VerifyOtp } from './verify-otp';
import { AuthStore } from '../../../core/store/auth.store';
import { AuthApiService } from '../../../core/services/auth-api.service';

// The shared OTP screen words itself by context: the mandatory LOGIN code (flag kept by AuthApiService) is a login confirmation, not a
// step of the registration journey; account activation keeps the registration wording.
function render(loginOtp: boolean) {
	TestBed.configureTestingModule({
		imports: [VerifyOtp],
		providers: [provideRouter([]),
			{ provide: AuthStore, useValue: { isPendingVerification: () => true, token: () => null, pendingUserId: () => 'u1', pendingEmail: () => 'a@b.co', pendingRole: () => null, pendingAccountType: () => null } },
			{ provide: AuthApiService, useValue: { verifyOtp: vi.fn(), resendOtp: vi.fn(), isLoginOtpPending: () => loginOtp } }],
	});
	const f = TestBed.createComponent(VerifyOtp);
	f.detectChanges();
	return (f.nativeElement as HTMLElement);
}
const text = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ');

describe('verify-otp copy by context', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('login OTP: login wording, no registration step pill / stepper / "رحلة التسجيل", success button says it enters the dashboard', () => {
		const el = render(true);
		const t = text(el);
		expect(el.querySelector('#page-h1')?.textContent?.trim()).toBe('تأكيد تسجيل الدخول');
		expect(t).toContain('أدخل رمز التحقق المرسل إلى بريدك الإلكتروني لإكمال تسجيل الدخول');
		expect(t).not.toContain('الخطوة 3 من 3');
		expect(t).not.toContain('رحلة التسجيل');
		expect(el.querySelector('.stepper')).toBeNull();
		expect(el.querySelector('.auth-step-pill')).toBeNull();
		expect(t).toContain('الدخول إلى لوحة التحكم');
		expect(t).not.toContain('التالي: لوحة التحكم');
	});

	it('account activation (registration / unverified login): the registration wording is unchanged', () => {
		const el = render(false);
		const t = text(el);
		expect(el.querySelector('#page-h1')?.textContent?.trim()).toBe('تأكيد البريد الإلكتروني');
		expect(t).toContain('الخطوة 3 من 3 في رحلة التسجيل في وسيط AI');
		expect(el.querySelector('.stepper')).not.toBeNull();
		expect(el.querySelector('.auth-step-pill')).not.toBeNull();
		expect(t).toContain('التالي: لوحة التحكم');
	});
});
