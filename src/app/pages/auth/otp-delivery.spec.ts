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
import { registerNotice, resendNotice, unverifiedLoginNotice } from '../../core/forms/otp-delivery';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

const SMS_503 = 'التحقق عبر الرسائل النصية غير متاح حاليًا، يرجى التواصل مع الدعم لإكمال تسجيل الدخول';
const SENT = 'تم إرسال رمز التحقق إلى بريدك';
const FAILED = 'تعذر إرسال رمز التحقق، حاول مرة أخرى بعد قليل أو تواصل مع الدعم';
const REGISTER_FAILED = 'تم إنشاء الحساب، لكن تعذر إرسال رمز التحقق. حاول إعادة الإرسال بعد قليل.';
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

describe('OTP delivery: pure notices and error mapping', () => {
	it('register: "sent" only when emailSent is exactly true', () => {
		expect(registerNotice({ data: { verified: false, emailSent: true } })).toEqual({ sent: true, message: SENT });
		expect(registerNotice({ data: { verified: false, emailSent: false } })).toEqual({ sent: false, message: REGISTER_FAILED });
		expect(registerNotice({ data: { verified: false } }).sent).toBe(false); // no claim without the flag
	});

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

describe('Register: honest delivery status', () => {
	const run = (emailSent: boolean | undefined) => {
		const post = vi.fn(() => of({ success: true, message: 'x', data: { userId: 'u1', verified: false, ...(emailSent === undefined ? {} : { emailSent }) } }));
		const { list } = providers(post);
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		TestBed.configureTestingModule({ imports: [Register], providers: list });
		const fixture = TestBed.createComponent(Register);
		fixture.detectChanges();
		const c: any = fixture.componentInstance;
		c.submitRegistration();
		fixture.detectChanges();
		return { c, el: fixture.nativeElement as HTMLElement };
	};
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('emailSent=true: says it was sent and starts the countdown', () => {
		const { c, el } = run(true);
		expect(c.currentStep).toBe(3);
		expect(c.otpNotice).toBe(SENT);
		expect(c.countdown).toBe(90);
		expect(el.querySelector('#otp-notice')!.textContent).toContain(SENT);
		clearInterval(c.countdownTimer);
	});

	it('emailSent=false: still moves to the verify step, never says sent, no countdown, resend stays enabled', () => {
		const { c, el } = run(false);
		expect(c.currentStep).toBe(3);
		expect(c.errorMessage).toBe(REGISTER_FAILED);
		expect(el.querySelector('#otp-notice')).toBeNull();
		expect(el.textContent).not.toContain(SENT);
		expect(c.countdown).toBe(0);
		expect(c.countdownTimer).toBeNull();
		expect((el.querySelector('#btn-resend') as HTMLButtonElement).disabled).toBe(false);
	});

	it('a resend that fails does not start the countdown; a 429 locks for the Retry-After wait and shows it', () => {
		const { c } = run(false);
		const store = TestBed.inject(AuthStore) as any;
		store.pendingUserId.set('u1');
		const spy = vi.spyOn(TestBed.inject(HttpClient), 'post' as any);
		spy.mockReturnValueOnce(of({ success: false, emailSent: false, message: 'x', data: { verified: false, emailSent: false } }) as any);
		c.resendOtp();
		expect(c.errorMessage).toBe(FAILED);
		expect(c.countdown).toBe(0);
		spy.mockReturnValueOnce(rateLimited(75) as any);
		c.resendOtp();
		expect(c.countdown).toBe(75);
		expect(c.errorMessage).toContain('75');
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

	it('the cooldown timer starts only after a send the backend confirmed (emailSent === true)', () => {
		const sent = mount(() => of({ success: true, data: { userId: 'u1', verified: false, emailSent: true } }));
		sent.c.submitRegistration();
		expect(sent.c.countdown).toBeGreaterThan(0);
		clearInterval(sent.c.countdownTimer);
		TestBed.resetTestingModule();
		const notSent = mount(() => of({ success: true, data: { userId: 'u1', verified: false, emailSent: false } }));
		notSent.c.submitRegistration();
		expect(notSent.c.countdown).toBe(0);
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
		expect(c.successMsg).toBe(SENT);
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
