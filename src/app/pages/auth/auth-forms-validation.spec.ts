import { ChangeDetectorRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SocialAuthService } from '@abacritt/angularx-social-login';

import { Login } from './login/login';
import { Register } from './register/register';
import { VerifyOtp } from './verify-otp/verify-otp';
import { RestPassword } from './rest-password/rest-password';
import { AuthStore } from '../../core/store/auth.store';
import { UiNotificationService } from '../../core/services/ui-notification.service';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

// The components are zoneless/markForCheck-driven: tests that set plain fields must mark the view dirty first.
const render = (fixture: { componentRef: { injector: { get: (t: any) => any } }; detectChanges: () => void }) => {
	fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
	fixture.detectChanges();
};
const httpErr = (status: number, body?: any) => throwError(() => new HttpErrorResponse({ status, error: body }));
const NO_ENGLISH = /[A-Za-z]/;

function baseProviders(opts: { post: (...a: any[]) => any; store?: any; withSocial?: boolean }) {
	const store = opts.store ?? {
		currentUser: signal<any>(null),
		pendingUserId: signal<any>(null),
		token: () => null,
		authenticate: vi.fn(),
		setPendingVerification: vi.fn(),
		isPendingVerification: () => true,
	};
	const providers: any[] = [
		provideRouter([{ path: '**', component: BlankTestComponent }]),
		{ provide: HttpClient, useValue: { post: (...a: any[]) => opts.post(...a), get: () => of({ success: true, data: { active: false } }) } },
		{ provide: AuthStore, useValue: store },
	];
	if (opts.withSocial !== false) providers.push({ provide: SocialAuthService, useValue: { authState: new Subject<any>(), initState: of(undefined) } });
	return { providers, store };
}

// ───────────────────────────────── Login ─────────────────────────────────
describe('Login (shared validation)', () => {
	const setup = (post: (...a: any[]) => any) => {
		const { providers, store } = baseProviders({ post });
		TestBed.configureTestingModule({ imports: [Login], providers });
		const fixture = TestBed.createComponent(Login);
		render(fixture);
		const router = TestBed.inject(Router);
		const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
		const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
		return { fixture, component: fixture.componentInstance, store, navigate, navigateByUrl, el: fixture.nativeElement as HTMLElement };
	};

	it('an empty submit makes no request, shows a summary naming both fields, touches them, and the button stays enabled', () => {
		const post = vi.fn();
		const { fixture, component, el } = setup(post);
		component.onSubmit();
		render(fixture);
		expect(post).not.toHaveBeenCalled();
		const summary = el.querySelector('[data-testid="form-summary"]')!;
		expect(summary.textContent).toContain('البريد الإلكتروني');
		expect(summary.textContent).toContain('كلمة المرور');
		expect(component.loginForm.get('email')!.touched).toBe(true);
		expect((el.querySelector('#btn-login') as HTMLButtonElement).disabled).toBe(false);
		expect(el.querySelector('#err-identifier-txt')?.textContent).toContain('مطلوب');
	});

	it('the field is email only (no phone promise) and a bad email gets an Arabic message', () => {
		const { fixture, component, el } = setup(vi.fn());
		expect(el.textContent).not.toContain('05XXXXXXXX');
		component.loginForm.patchValue({ email: 'not-an-email', password: 'x' });
		component.onSubmit();
		render(fixture);
		expect(el.querySelector('#err-identifier-txt')?.textContent).toContain('بريدًا إلكترونيًا صالحًا');
	});

	it('401 = wrong credentials: Arabic banner, no navigation, not treated as an expired session', () => {
		const { fixture, component, el, navigate, navigateByUrl } = setup(() => httpErr(401, { message: 'Unauthorized' }));
		component.loginForm.patchValue({ email: 'a@b.co', password: 'x' });
		component.onSubmit();
		render(fixture);
		expect(el.querySelector('#banner-error-txt')?.textContent).toContain('غير صحيحة');
		expect(navigate).not.toHaveBeenCalled();
		expect(navigateByUrl).not.toHaveBeenCalled();
		expect(component.isSubmitting).toBe(false);
	});

	it.each([
		[429, { message: 'Too many authentication attempts, please try again after an hour' }, 'ساعة'],
		[0, undefined, 'الاتصال'],
		[500, { message: 'Internal Server Error' }, 'الخادم'],
	])('status %s is shown in Arabic only', (status, body, expected) => {
		const { fixture, component, el } = setup(() => httpErr(status as number, body));
		component.loginForm.patchValue({ email: 'a@b.co', password: 'x' });
		component.onSubmit();
		render(fixture);
		const txt = el.querySelector('#banner-error-txt')!.textContent!;
		expect(txt).toContain(expected);
		expect(txt).not.toMatch(NO_ENGLISH);
	});

	it('an unverified account is sent to the email-OTP step (with an explanation), not left on the sign-up page', () => {
		const { fixture, component, navigate } = setup(() => of({ success: true, data: { verified: false, userId: 'u1' } }));
		const notify = TestBed.inject(UiNotificationService);
		component.loginForm.patchValue({ email: 'a@b.co', password: 'x' });
		component.onSubmit();
		render(fixture);
		expect(navigate).toHaveBeenCalledWith(['/auth/verify-otp']);
		expect(notify.toasts()[0].message).toContain('غير مفعّل');
		notify.clearAll();
	});

	it('login OTP: an incomplete code is not a silent no-op and the verify button is not disabled', () => {
		const post = vi.fn();
		const { fixture, component, el } = setup(post);
		(component as any).pendingLoginUserId = 'u1';
		component.otpRequired = true;
		render(fixture);
		component.submitLoginOtp();
		render(fixture);
		expect(post).not.toHaveBeenCalled();
		expect(component.errorMessage).toContain('6 أرقام');
		expect((el.querySelector('#btn-otp-verify') as HTMLButtonElement).disabled).toBe(false);
	});

	it('login OTP: wrong code (400) and resend rate limit (429) show Arabic', () => {
		let status = 400;
		const { fixture, component } = setup(() => httpErr(status, status === 400 ? { message: 'رمز التحقق غير صحيح' } : { message: 'Too many requests' }));
		(component as any).pendingLoginUserId = 'u1';
		['1', '2', '3', '4', '5', '6'].forEach((d, i) => component.otpForm.get(`code${i + 1}`)!.setValue(d));
		component.submitLoginOtp();
		expect(component.errorMessage).toBe('رمز التحقق غير صحيح');
		status = 429;
		component.submitLoginOtp();
		expect(component.errorMessage).not.toMatch(NO_ENGLISH);
		fixture.destroy();
	});
});

// ──────────────────────────────── Register ───────────────────────────────
describe('Register (shared validation)', () => {
	const setup = (post: (...a: any[]) => any) => {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		const { providers } = baseProviders({ post });
		TestBed.configureTestingModule({ imports: [Register], providers });
		const fixture = TestBed.createComponent(Register);
		render(fixture);
		const component = fixture.componentInstance;
		component.selectedAccountType = 'service_requester_ind';
		component.currentStep = 2;
		render(fixture);
		return { fixture, component, el: fixture.nativeElement as HTMLElement };
	};
	afterEach(() => vi.unstubAllGlobals());

	const fillValid = (c: Register) =>
		c.basicInfoForm.patchValue({
			firstName: 'سارة', lastName: 'أحمد', email: 'a@b.co',
			phone: { countryCode: 'SA', dialCode: '+966', number: '55 123 4567', e164Number: '+966551234567' },
			password: 'Abcdefg1', confirmPassword: 'Abcdefg1', agreeData: true, agreeTerms: true,
		});

	it('an empty submit shows a summary that names every missing field INCLUDING both consent checkboxes; the button is not disabled', () => {
		const post = vi.fn();
		const { fixture, component, el } = setup(post);
		component.nextStep();
		render(fixture);
		expect(post).not.toHaveBeenCalled();
		const txt = el.querySelector('[data-testid="form-summary"]')!.textContent!;
		for (const name of ['الاسم الأول', 'اسم العائلة', 'البريد الإلكتروني', 'رقم الجوال', 'كلمة المرور', 'الموافقة على شروط الاستخدام وسياسة الخصوصية', 'الإقرار بصحة البيانات']) {
			expect(txt, name).toContain(name);
		}
		expect((el.querySelector('#btn-next') as HTMLButtonElement).disabled).toBe(false);
		expect(el.querySelector('#err-agree-terms')?.textContent).toContain('شروط الاستخدام وسياسة الخصوصية');
		expect(el.querySelector('#err-agree-data')?.textContent).toContain('الإقرار');
	});

	it('the consent checkboxes carry a required marker', () => {
		const { el } = setup(vi.fn());
		expect(el.querySelector('#terms-chk')!.closest('label')!.querySelector('.field-req')).toBeTruthy();
		expect(el.querySelector('#chk-accuracy')!.closest('label')!.querySelector('.field-req')).toBeTruthy();
	});

	it('password rules match the backend (8+, uppercase, digit) and the message names the missing rule', () => {
		const { fixture, component, el } = setup(vi.fn());
		const pw = component.basicInfoForm.get('password')!;
		pw.setValue('abcdefg1'); expect(pw.invalid).toBe(true);
		pw.setValue('Abcdefgh'); expect(pw.invalid).toBe(true);
		pw.setValue('Ab1'); expect(pw.invalid).toBe(true);
		pw.setValue('Abcdefg1'); expect(pw.valid).toBe(true);
		pw.setValue('abcdefg1'); pw.markAsTouched(); render(fixture);
		expect(el.querySelector('#err-password')?.textContent).toContain('حرف إنجليزي كبير');
		expect(el.querySelector('#password-rules')?.textContent).toContain('8 أحرف');
	});

	it('names need 2+ characters and the phone needs 9+ digits (backend rules)', () => {
		const { component } = setup(vi.fn());
		const f = component.basicInfoForm;
		f.get('firstName')!.setValue('س'); expect(f.get('firstName')!.invalid).toBe(true);
		f.get('firstName')!.setValue('سا'); expect(f.get('firstName')!.valid).toBe(true);
		f.get('phone')!.setValue({ number: '5512', dialCode: '+966' }); expect(f.get('phone')!.errors?.['phoneDigits']).toBeTruthy();
		f.get('phone')!.setValue({ number: '55 123 4567', dialCode: '+966' }); expect(f.get('phone')!.valid).toBe(true);
	});

	it('a valid form sends digits-only phoneNumber and agreedToTerms, and moves to the OTP step', () => {
		const post = vi.fn(() => of({ success: true, data: { userId: 'u1' } }));
		const { component } = setup(post);
		fillValid(component);
		component.nextStep();
		expect(post).toHaveBeenCalledTimes(1);
		const body = (post.mock.calls[0] as any[])[1];
		expect(body.phoneNumber).toBe('551234567');
		expect(body.agreedToTerms).toBe(true);
		expect(component.currentStep).toBe(3);
	});

	it('backend zod errors become field errors on the matching inputs (not "Validation Error")', () => {
		const { fixture, component, el } = setup(() => httpErr(400, {
			message: 'Validation Error',
			errors: [{ path: 'body.email', message: 'صيغة البريد الإلكتروني غير صحيحة' }, { path: 'body.firstName', message: 'الاسم الأول يجب أن يكون حرفين على الأقل' }],
		}));
		fillValid(component);
		component.nextStep();
		render(fixture);
		expect(component.basicInfoForm.get('email')!.errors?.['server']).toBe('صيغة البريد الإلكتروني غير صحيحة');
		expect(component.basicInfoForm.get('firstName')!.errors?.['server']).toContain('حرفين');
		expect(el.querySelector('#err-email')?.textContent).toContain('صيغة البريد');
		expect(component.errorMessage).not.toMatch(NO_ENGLISH);
		expect(component.currentStep).toBe(2);
	});

	it('409 (already registered) and 429 are Arabic; 409 offers the login link', () => {
		let status = 409;
		const { fixture, component, el } = setup(() => httpErr(status, status === 409 ? { message: 'البريد الإلكتروني أو رقم الجوال مسجل بالفعل، يرجى تسجيل الدخول' } : { message: 'Too many requests' }));
		fillValid(component);
		component.nextStep();
		render(fixture);
		expect(component.accountExistsError).toBe(true);
		expect(el.querySelector('#banner-error-txt')?.textContent).toContain('مسجل بالفعل');
		status = 429;
		component.nextStep();
		render(fixture);
		expect(component.errorMessage).not.toMatch(NO_ENGLISH);
	});

	it('OTP step: an incomplete code is not a silent no-op and the confirm button is not disabled', () => {
		const post = vi.fn();
		const { fixture, component, el } = setup(post);
		component.currentStep = 3;
		render(fixture);
		component.onVerificationSubmit();
		render(fixture);
		expect(post).not.toHaveBeenCalled();
		expect(component.errorMessage).toContain('6 أرقام');
		expect((el.querySelector('#btn-confirm') as HTMLButtonElement).disabled).toBe(false);
	});
});

// ─────────────────────────────── Verify OTP ──────────────────────────────
describe('VerifyOtp (shared validation)', () => {
	const setup = (post: (...a: any[]) => any, storeOverrides: any = {}) => {
		const store = {
			currentUser: signal<any>(null),
			pendingUserId: signal<any>('u1'),
			token: () => null,
			authenticate: vi.fn(),
			isPendingVerification: () => true,
			...storeOverrides,
		};
		const { providers } = baseProviders({ post, store, withSocial: false });
		TestBed.configureTestingModule({ imports: [VerifyOtp], providers });
		const fixture = TestBed.createComponent(VerifyOtp);
		render(fixture);
		return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
	};
	const sessionStore = (initial: Record<string, string> = {}) => {
		const data = { ...initial };
		vi.stubGlobal('sessionStorage', { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, removeItem: (k: string) => { delete data[k]; } });
		return data;
	};
	afterEach(() => vi.unstubAllGlobals());

	it('an incomplete code is not a silent failure; the button is not disabled', () => {
		sessionStore();
		const post = vi.fn();
		const { fixture, component, el } = setup(post);
		component.verify();
		render(fixture);
		expect(post).not.toHaveBeenCalled();
		expect(component.errorMsg).toContain('6 أرقام');
		expect((el.querySelector('#btn-confirm') as HTMLButtonElement).disabled).toBe(false);
	});

	it('wrong code (400, English or Arabic) and 429 are shown in Arabic', () => {
		sessionStore();
		let status = 400;
		const { component } = setup(() => httpErr(status, status === 400 ? { message: 'رمز التحقق غير صحيح' } : { message: 'Too many requests from this IP, please try again after 15 minutes' }));
		(component as any).otpCtrl.setValue('123456');
		component.verify();
		expect(component.errorMsg).toBe('رمز التحقق غير صحيح');
		status = 429;
		component.verify();
		expect(component.errorMsg).toContain('15 دقيقة');
		expect(component.errorMsg).not.toMatch(NO_ENGLISH);
	});

	it('auto-send for a user redirected with a session is NOT repeated within 90 s (saves the shared rate limit)', () => {
		sessionStore({ waseet_otp_autosend_u1: String(Date.now() - 20_000) });
		const post = vi.fn(() => of({ success: true }));
		const { component } = setup(post, { token: () => 'tok' });
		expect(post).not.toHaveBeenCalled();
		expect(component.successMsg).toContain('أرسلنا');
		expect(component.countdown).toBeGreaterThan(0);
		expect(component.countdown).toBeLessThanOrEqual(70);
	});

	it('auto-send still happens the first time (nothing recent) and is recorded', () => {
		const data = sessionStore();
		const post = vi.fn(() => of({ success: true, emailSent: true })); // recorded only when a code really went out
		setup(post, { token: () => 'tok' });
		expect(post).toHaveBeenCalledTimes(1);
		expect(data['waseet_otp_autosend_u1']).toBeTruthy();
	});

	it('a 429 on resend keeps the resend locked for the time the server asked', () => {
		sessionStore();
		const { component } = setup(() => httpErr(429, { message: 'Too many requests from this IP, please try again after 15 minutes' }), { token: () => 'tok' });
		expect(component.errorMsg).toContain('15 دقيقة');
		expect(component.countdown).toBe(900);
	});
});

// ───────────────────────────── Reset password ────────────────────────────
describe('RestPassword (shared validation)', () => {
	const setup = (post: (...a: any[]) => any) => {
		const { providers } = baseProviders({ post, withSocial: false });
		TestBed.configureTestingModule({ imports: [RestPassword], providers });
		const fixture = TestBed.createComponent(RestPassword);
		render(fixture);
		return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
	};

	it('step 1: an empty email is not a silent no-op: Arabic required message, no request', () => {
		const post = vi.fn();
		const { fixture, component, el } = setup(post);
		component.sendOtp();
		render(fixture);
		expect(post).not.toHaveBeenCalled();
		expect(el.querySelector('#err-email')?.textContent).toContain('مطلوب');
	});

	it('step 3: the rules are visible BEFORE submitting, the unsupported "log out all devices" option is gone, and the button is not disabled', () => {
		const { fixture, component, el } = setup(vi.fn());
		component.currentStep = 3;
		render(fixture);
		expect(el.querySelector('#pw-rules')?.textContent).toContain('حرف إنجليزي كبير');
		expect(el.querySelector('#logout-all')).toBeNull();
		expect(component.passwordForm.get('logoutAll')).toBeNull();
		expect((el.querySelector('#btn-save-pw') as HTMLButtonElement).disabled).toBe(false);
	});

	it('step 3: submitting with a weak/empty password shows a summary naming the fields; no request', () => {
		const post = vi.fn();
		const { fixture, component, el } = setup(post);
		component.currentStep = 3;
		render(fixture);
		component.passwordForm.patchValue({ newPassword: 'abcdefg1', confirmPassword: 'abcdefg1' });
		component.savePassword();
		render(fixture);
		expect(post).not.toHaveBeenCalled();
		expect(el.querySelector('[data-testid="form-summary"]')!.textContent).toContain('كلمة المرور الجديدة');
		expect(el.querySelector('#err-new-pw')?.textContent).toContain('حرف إنجليزي كبير');

		component.passwordForm.patchValue({ newPassword: 'Abcdefg1', confirmPassword: 'Different1' });
		component.savePassword();
		render(fixture);
		expect(el.querySelector('#err-confirm-pw')?.textContent).toContain('غير متطابقتين');
	});

	it('a valid reset sends only email, code and newPassword; failures are Arabic', () => {
		let fail = false;
		const post = vi.fn(() => (fail ? httpErr(429, { message: 'Too many authentication attempts, please try again after an hour' }) : of({ success: true })));
		const { component } = setup(post);
		(component as any).verifiedEmail = 'a@b.co';
		component.currentStep = 3;
		['1', '2', '3', '4', '5', '6'].forEach((d, i) => component.verificationForm.get(`code${i + 1}`)!.setValue(d));
		component.passwordForm.patchValue({ newPassword: 'Abcdefg1', confirmPassword: 'Abcdefg1' });
		component.savePassword();
		expect((post.mock.calls[0] as any[])[1]).toEqual({ email: 'a@b.co', code: '123456', newPassword: 'Abcdefg1' });
		expect(component.currentStep).toBe(4);

		fail = true;
		component.currentStep = 3;
		component.savePassword();
		expect(component.bannerError).toContain('ساعة');
		expect(component.bannerError).not.toMatch(NO_ENGLISH);
	});

	it('step 2: an incomplete code is not a silent no-op and the verify button is not disabled', () => {
		const post = vi.fn();
		const { fixture, component, el } = setup(post);
		component.currentStep = 2;
		render(fixture);
		component.verifyOtp();
		render(fixture);
		expect(post).not.toHaveBeenCalled();
		expect(component.bannerError).toContain('6 أرقام');
		expect((el.querySelector('#btn-verify') as HTMLButtonElement).disabled).toBe(false);
	});
});
