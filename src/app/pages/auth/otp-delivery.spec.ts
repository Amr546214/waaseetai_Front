import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { Component, signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SocialAuthService } from '@abacritt/angularx-social-login';

import { Register } from './register/register';
import { Login } from './login/login';
import { VerifyOtp } from './verify-otp/verify-otp';
import { RestPassword } from './rest-password/rest-password';
import { AuthStore } from '../../core/store/auth.store';
import { OtpHandoffService } from '../../core/services/otp-handoff.service';
import { mapHttpError } from '../../core/forms/http-error';
import { resendNotice, unverifiedLoginNotice, REGISTER_CODE_STEP_MESSAGE, REGISTER_RESEND_MESSAGE, RESEND_SENT_MESSAGE } from '../../core/forms/otp-delivery';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

const SMS_503 = 'التحقق عبر الرسائل النصية غير متاح حاليًا، يرجى التواصل مع الدعم لإكمال تسجيل الدخول';
const SENT = 'تم إرسال رمز التحقق إلى بريدك';
const FAILED = 'تعذر إرسال رمز التحقق، حاول مرة أخرى بعد قليل أو تواصل مع الدعم';
const rateLimited = (seconds: number, headers = true) => throwError(() => ({
	status: 429,
	headers: headers ? new HttpHeaders({ 'Retry-After': String(seconds) }) : new HttpHeaders(),
	error: { success: false, message: `تم تجاوز عدد المحاولات، حاول مرة أخرى بعد ${seconds} ثانية`, errors: [{ code: 'OTP_RATE_LIMITED', retryAfterSeconds: seconds }] },
}));

function providers(postSpy: (...a: any[]) => any, pending: string | null = null) {
	const store = {
		currentUser: signal<any>(null),
		pendingUserId: signal<any>(pending),
		isPendingVerification: () => !!pending,
		token: () => null,
		authenticate: vi.fn(),
		setPendingVerification: vi.fn(),
	};
	return {
		store,
		list: [
			provideRouter([{ path: '**', component: BlankTestComponent }]),
			{ provide: HttpClient, useValue: { post: (...a: any[]) => postSpy(...a), get: () => of({ success: true, data: { active: false } }) } },
			{ provide: AuthStore, useValue: store },
			{ provide: SocialAuthService, useValue: { authState: new Subject<any>(), initState: of(undefined) } },
		],
	};
}

describe('OTP delivery: generic wording (no account-existence disclosure)', () => {
	it('register and resend never promise a code for an account: conditional wording, no "already registered"', () => {
		expect(REGISTER_CODE_STEP_MESSAGE).toContain('إن كان بريدك بحاجة إلى تفعيل');
		expect(REGISTER_RESEND_MESSAGE).toContain('إن كان هناك حساب بانتظار التفعيل');
		expect(RESEND_SENT_MESSAGE).toContain('إذا كان الحساب بانتظار التفعيل');
		for (const m of [REGISTER_CODE_STEP_MESSAGE, REGISTER_RESEND_MESSAGE, RESEND_SENT_MESSAGE]) expect(m).not.toMatch(/مسجل بالفعل|موجود بالفعل|لا يوجد حساب|تم إنشاء/);
	});
});

describe('OTP delivery: pure notices and error mapping', () => {
	it('unverified login: sent / not sent / throttled / neutral', () => {
		expect(unverifiedLoginNotice({ verified: false, emailSent: true }).sent).toBe(true);
		expect(unverifiedLoginNotice({ verified: false, emailSent: true }).message).toContain(SENT);
		const throttled = unverifiedLoginNotice({ verified: false, emailSent: false, retryAfterSeconds: 45 });
		expect(throttled).toEqual({ sent: false, message: 'يمكنك استخدام الرمز السابق أو إعادة المحاولة بعد 45 ثانية.' });
		expect(unverifiedLoginNotice({ verified: false, emailSent: false, retryAfterSeconds: 600 }).message).toContain('10 دقائق');
		expect(unverifiedLoginNotice({ verified: false, emailSent: false })).toEqual({ sent: false, message: FAILED });
		expect(unverifiedLoginNotice({ verified: false }).message).not.toContain('إرسال رمز التحقق إلى بريدك');
	});

	it('resend: success+emailSent is sent; success:false / emailSent:false is a failure', () => {
		expect(resendNotice({ success: true, emailSent: true, data: { verified: false, emailSent: true } }).sent).toBe(true);
		expect(resendNotice({ success: true, emailSent: true, data: { verified: false, emailSent: true } }).message).toBe(RESEND_SENT_MESSAGE);
		expect(resendNotice({ success: false, emailSent: false, data: { verified: false, emailSent: false } })).toEqual({ sent: false, message: FAILED });
		expect(resendNotice({ success: true, data: { verified: false } }).sent).toBe(false);
	});

	it('429 reads Retry-After, then the body retryAfterSeconds, and always shows the wait', () => {
		const viaHeader = mapHttpError({ status: 429, headers: new HttpHeaders({ 'Retry-After': '42' }), error: { message: 'محاولات كثيرة' } });
		expect(viaHeader.retryAfterSeconds).toBe(42);
		expect(viaHeader.message).toContain('42 ثانية');
		const viaBody = mapHttpError({ status: 429, headers: new HttpHeaders(), error: { message: 'محاولات كثيرة', errors: [{ code: 'OTP_RATE_LIMITED', retryAfterSeconds: 90 }] } });
		expect(viaBody.retryAfterSeconds).toBe(90);
		expect(viaBody.message).toContain('دقيقتين');
	});

	it('503 with the Arabic SMS message is shown as is; a bare 503 stays generic', () => {
		expect(mapHttpError({ status: 503, error: { message: SMS_503 } }).message).toBe(SMS_503);
		expect(mapHttpError({ status: 503, error: { message: 'Service Unavailable' } }).message).toBe('حدث خطأ في الخادم. حاول مرة أخرى بعد قليل.');
	});
});

describe('Register: uniform answer, e-mail keyed code step', () => {
	const run = (data: any) => {
		const post = vi.fn((url: string, ...rest: any[]) => /\/auth\/register$/.test(String(url)) ? of({ success: true, message: 'x', data }) : of({ success: true, data: {} }));
		const { list } = providers(post);
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		TestBed.configureTestingModule({ imports: [Register], providers: list });
		const fixture = TestBed.createComponent(Register);
		fixture.detectChanges();
		const c: any = fixture.componentInstance;
		c.basicInfoForm.patchValue({ email: ' Sara@Example.com ' });
		c.submitRegistration();
		fixture.detectChanges();
		return { c, el: fixture.nativeElement as HTMLElement, post };
	};
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('the answer carries no id and no flags: the code step opens with the neutral notice, never claims "sent", keyed by the typed e-mail', () => {
		const { c, el } = run({});
		expect(c.currentStep).toBe(3);
		expect(c.registeredEmail).toBe('sara@example.com');
		expect(c.otpNotice).toBe(REGISTER_CODE_STEP_MESSAGE);
		expect(el.textContent).not.toContain(SENT);
		expect(c.countdown).toBeGreaterThan(0);
		clearInterval(c.countdownTimer);
	});

	it('page behaviour is identical whatever the answer data holds (nothing in it is read)', () => {
		const a = run({}); const stateA = [a.c.currentStep, a.c.otpNotice, a.c.errorMessage, a.c.registeredEmail]; clearInterval(a.c.countdownTimer); TestBed.resetTestingModule();
		const b = run({ userId: 'u1', emailSent: false, accountCreated: false }); const stateB = [b.c.currentStep, b.c.otpNotice, b.c.errorMessage, b.c.registeredEmail]; clearInterval(b.c.countdownTimer);
		expect(stateB).toEqual(stateA);
	});

	it('the code is verified BY E-MAIL (POST /auth/verify-otp {email, code}), not by an id', () => {
		const { c, post } = run({});
		for (let i = 0; i < 6; i++) c.verificationForm.get(`code${i + 1}`).setValue(String(i + 1));
		c.onVerificationSubmit();
		const call = post.mock.calls.find(x => /\/verify-otp$/.test(String(x[0])))!;
		expect(call[1]).toEqual({ email: 'sara@example.com', code: '123456' });
		clearInterval(c.countdownTimer);
	});

	it('resend is by e-mail, generic, and starts the countdown; a 429 locks for the Retry-After wait', () => {
		const { c, post } = run({});
		clearInterval(c.countdownTimer); c.countdown = 0;
		c.resendOtp();
		const call = post.mock.calls.find(x => /\/resend-otp$/.test(String(x[0])))!;
		expect(call[1]).toEqual({ email: 'sara@example.com' });
		expect(c.otpNotice).toBe(REGISTER_RESEND_MESSAGE);
		expect(c.countdown).toBeGreaterThan(0);
		clearInterval(c.countdownTimer); c.countdown = 0;
		post.mockReturnValueOnce(rateLimited(75) as any);
		c.resendOtp();
		expect(c.countdown).toBe(75);
		expect(c.errorMessage).toContain('75');
		clearInterval(c.countdownTimer);
	});

	it('the code step shows login / password-recovery links for whoever received no code', () => {
		const { c, el } = run({});
		const help = el.querySelector('[data-testid="code-step-help"]')!;
		expect(help.querySelector('#code-step-login-link')!.getAttribute('href')).toContain('/auth/login');
		expect(help.querySelector('#code-step-forgot-link')!.getAttribute('href')).toContain('/auth/forget-password');
		clearInterval(c.countdownTimer);
	});
});

describe('Register: first registration, double submit and failed attempts', () => {
	const mount = (registerReply: (...a: any[]) => any, spy?: (...a: any[]) => void) => {
		// the page also POSTs referral-cookie/clear when it opens: only POST /auth/register goes to `registerReply`
		const post = (url: string, ...rest: any[]) => { if (/\/auth\/register$/.test(String(url))) { spy?.(url, ...rest); return registerReply(); } return of({ success: true, data: { cleared: true } }); };
		const { list } = providers(post);
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		TestBed.configureTestingModule({ imports: [Register], providers: list });
		const fixture = TestBed.createComponent(Register);
		fixture.detectChanges();
		return { c: fixture.componentInstance as any, el: fixture.nativeElement as HTMLElement, fixture };
	};
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('a first registration shows no cooldown wording before anything was sent (no countdown, no "wait N seconds")', () => {
		const { c, el } = mount(() => new Subject()); // request still running
		c.submitRegistration();
		expect(c.countdown).toBe(0);
		expect(c.otpNotice).toBe('');
		expect(el.textContent).not.toMatch(/انتظر|بعد \d+ ثانية|استخدم الرمز/);
	});

	it('double tap: while the first request runs a second submit sends nothing (ONE POST /register)', () => {
		const spy = vi.fn();
		const { c } = mount(() => new Subject(), spy);
		c.submitRegistration(); c.submitRegistration(); c.submitRegistration();
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('Enter / next while submitting is ignored too (nextStep guard)', () => {
		const spy = vi.fn();
		const { c } = mount(() => new Subject(), spy);
		c.currentStep = 2;
		c.submitRegistration();
		c.nextStep(); c.nextStep();
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('a failed attempt (409 duplicate) stays on the form: no verify step, no "sent", no countdown', () => {
		const reply409 = () => throwError(() => ({ status: 409, error: { success: false, message: 'البريد الإلكتروني أو رقم الجوال مسجل بالفعل، يرجى تسجيل الدخول' } }));
		const { c, el } = mount(reply409);
		c.currentStep = 2; c.submitRegistration();
		expect(c.currentStep).toBe(2);
		expect(c.errorMessage).toContain('مسجل بالفعل');
		expect(c.countdown).toBe(0); expect(c.otpNotice).toBe('');
		expect(el.textContent).not.toContain(SENT);
	});

	it('a 429 on register shows the server wording (cooldown AFTER a real send / rate limited), opens no verify step and never claims "sent"', () => {
		const cooldown = 'أرسلنا الرمز بالفعل. يمكنك إعادة الإرسال بعد 45 ثانية، أو استخدم الرمز الذي وصلك.';
		const reply429 = () => throwError(() => ({ status: 429, headers: new HttpHeaders({ 'Retry-After': '45' }), error: { success: false, message: cooldown, errors: [{ code: 'OTP_RATE_LIMITED', reason: 'interval', retryAfterSeconds: 45 }] } }));
		const { c } = mount(reply429);
		c.currentStep = 2; c.submitRegistration();
		expect(c.currentStep).toBe(2);
		expect(c.errorMessage).toContain('45');
		expect(c.otpNotice).toBe('');
	});
});

describe('Login: unverified account hand-off', () => {
	const run = (data: any) => {
		const post = vi.fn(() => of({ success: true, message: 'x', data: { verified: false, userId: 'u1', ...data } }));
		const { list } = providers(post);
		TestBed.configureTestingModule({ imports: [Login], providers: list });
		const fixture = TestBed.createComponent(Login);
		fixture.detectChanges();
		const router = TestBed.inject(Router);
		const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
		fixture.componentInstance.loginForm.patchValue({ email: 'a@b.co', password: 'Passw0rd!x' });
		fixture.componentInstance.onSubmit();
		return { nav, handoff: TestBed.inject(OtpHandoffService).consume() };
	};
	afterEach(() => TestBed.resetTestingModule());

	it('emailSent=true: opens verify with a "sent" notice', () => {
		const { nav, handoff } = run({ emailSent: true });
		expect(nav).toHaveBeenCalledWith(['/auth/verify-otp']);
		expect(handoff?.sent).toBe(true);
	});

	it('throttled (emailSent=false + retryAfterSeconds): still opens verify, says to use the previous code, not "sent"', () => {
		const { nav, handoff } = run({ emailSent: false, retryAfterSeconds: 30 });
		expect(nav).toHaveBeenCalledWith(['/auth/verify-otp']);
		expect(handoff).toEqual({ sent: false, message: 'يمكنك استخدام الرمز السابق أو إعادة المحاولة بعد 30 ثانية.' });
	});

	it('emailSent=false without a wait: failure notice', () => {
		expect(run({ emailSent: false }).handoff).toEqual({ sent: false, message: FAILED });
	});

	it('SMS login with no provider (503) shows the Arabic message, never "sent to your phone"', () => {
		const post = vi.fn(() => throwError(() => ({ status: 503, error: { success: false, message: SMS_503 } })));
		const { list } = providers(post);
		TestBed.configureTestingModule({ imports: [Login], providers: list });
		const fixture = TestBed.createComponent(Login);
		fixture.detectChanges();
		fixture.componentInstance.loginForm.patchValue({ email: 'a@b.co', password: 'Passw0rd!x' });
		fixture.componentInstance.onSubmit();
		fixture.detectChanges();
		expect(fixture.componentInstance.errorMessage).toBe(SMS_503);
		expect(fixture.nativeElement.querySelector('#modal-otp')).toBeNull();
	});
});

describe('Verify page: countdown only after a real send', () => {
	const make = (handoff: any, post = vi.fn()) => {
		const { list } = providers(post, 'u1');
		TestBed.configureTestingModule({ imports: [VerifyOtp], providers: list });
		if (handoff) TestBed.inject(OtpHandoffService).set(handoff);
		const fixture = TestBed.createComponent(VerifyOtp);
		fixture.detectChanges();
		return { c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, fixture, post };
	};
	afterEach(() => TestBed.resetTestingModule());

	it('hand-off "sent": success banner and countdown', () => {
		const { c } = make({ sent: true, message: SENT });
		expect(c.successMsg).toBe(SENT);
		expect(c.countdown).toBe(60);
		(c as any).clearTimer();
	});

	it('hand-off "not sent / throttled": message shown as a warning, NO countdown, resend enabled', () => {
		const { c, el } = make({ sent: false, message: 'يمكنك استخدام الرمز السابق أو إعادة المحاولة بعد 30 ثانية.' });
		expect(c.errorMsg).toContain('الرمز السابق');
		expect(c.successMsg).toBe('');
		expect(c.countdown).toBe(0);
		expect((el.querySelector('#btn-resend') as HTMLButtonElement).disabled).toBe(false);
	});

	it('no hand-off (reload): no claim and no countdown', () => {
		const { c } = make(null);
		expect(c.successMsg).toBe('');
		expect(c.countdown).toBe(0);
	});

	it('resend success starts the countdown', () => {
		const post = vi.fn(() => of({ success: true, emailSent: true, message: 'x', data: { emailSent: true } }));
		const { c } = make(null, post);
		c.resendOtp();
		expect(c.successMsg).toBe(RESEND_SENT_MESSAGE);
		expect(c.countdown).toBe(60);
		(c as any).clearTimer();
	});

	it('resend failure (success:false / emailSent:false) shows the failure, starts no countdown and does not lock the button', () => {
		const post = vi.fn(() => of({ success: false, emailSent: false, message: 'x', data: { emailSent: false } }));
		const { c, el, fixture } = make(null, post);
		c.resendOtp();
		fixture.detectChanges();
		expect(c.errorMsg).toBe(FAILED);
		expect(c.successMsg).toBe('');
		expect(c.countdown).toBe(0);
		expect((el.querySelector('#btn-resend') as HTMLButtonElement).disabled).toBe(false);
	});

	it('resend 429 locks for Retry-After and shows the wait', () => {
		const post = vi.fn(() => rateLimited(120));
		const { c } = make(null, post);
		c.resendOtp();
		expect(c.countdown).toBe(120);
		expect(c.errorMsg).toContain('ثانية');
		(c as any).clearTimer();
	});
});

describe('Forgot password: 429 and no false "sent"', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('429 shows the wait from Retry-After, stays on step 1 (no "code sent" step)', () => {
		const post = vi.fn(() => rateLimited(300));
		const { list } = providers(post);
		TestBed.configureTestingModule({ imports: [RestPassword], providers: list });
		const fixture = TestBed.createComponent(RestPassword);
		fixture.detectChanges();
		const c: any = fixture.componentInstance;
		c.recoveryForm.patchValue({ email: 'a@b.co' });
		c.sendOtp();
		expect(c.currentStep).toBe(1);
		expect(c.bannerError).toContain('300');
	});
});

describe('Email OTP cards carry no decorative star icon', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('verify page: OTP card renders without the ws-ai-spark icon and without any SMS wording', () => {
		const { list } = providers(vi.fn(), 'u1');
		TestBed.configureTestingModule({ imports: [VerifyOtp], providers: list });
		const fixture = TestBed.createComponent(VerifyOtp);
		fixture.detectChanges();
		const el = fixture.nativeElement as HTMLElement;
		expect(el.querySelectorAll('.otp-box').length).toBe(6);
		expect(el.querySelector('.otp-card use[href="#ws-ai-spark"]')).toBeNull();
		expect(el.textContent).not.toContain('لجوالك');
	});
});
