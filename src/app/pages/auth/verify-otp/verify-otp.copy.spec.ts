import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { VerifyOtp } from './verify-otp';
import { AuthStore } from '../../../core/store/auth.store';
import { OtpHandoffService } from '../../../core/services/otp-handoff.service';
import { AuthApiService } from '../../../core/services/auth-api.service';

// The shared OTP screen words itself by context: the mandatory LOGIN code (flag kept by AuthApiService) is a login confirmation, not a
// step of the registration journey; account activation keeps the registration wording.
function render(loginOtp: boolean, failed = false) {
	TestBed.configureTestingModule({
		imports: [VerifyOtp],
		providers: [provideRouter([]),
			{ provide: AuthStore, useValue: { isPendingVerification: () => true, token: () => null, pendingUserId: () => 'u1', pendingEmail: () => 'a@b.co', pendingRole: () => null, pendingAccountType: () => null } },
			{ provide: AuthApiService, useValue: { verifyOtp: vi.fn(), resendOtp: vi.fn(), isLoginOtpPending: () => loginOtp } }],
	});
	if (failed) TestBed.inject(OtpHandoffService).set({ sent: false, to: 'a***@b.co', message: 'لم يُرسل رمز جديد.' });
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
		expect(t).toContain('أدخل رمز التحقق لإكمال تسجيل الدخول');
		expect(t).not.toContain('الخطوة 3 من 3');
		expect(t).not.toContain('رحلة التسجيل');
		expect(el.querySelector('.stepper')).toBeNull();
		expect(el.querySelector('.auth-step-pill')).toBeNull();
		expect(t).toContain('الدخول إلى لوحة التحكم');
		expect(t).not.toContain('التالي: لوحة التحكم');
	});

	it('a failed send uses the red alert and never labels the masked address as sent', () => {
		const el = render(true, true);
		expect(el.querySelector('.banner-error[role="alert"]')?.textContent).toContain('لم يُرسل رمز جديد');
		expect(el.querySelector('[data-testid="otp-target"]')?.textContent).toContain('a***@b.co');
		expect(text(el)).not.toContain('أرسلنا الرمز إلى');
		expect(el.querySelector('.banner-success')).toBeNull();
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
