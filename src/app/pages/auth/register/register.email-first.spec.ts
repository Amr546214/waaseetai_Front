import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { Component, signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SocialAuthService } from '@abacritt/angularx-social-login';

import { Register } from './register';
import { AuthStore } from '../../../core/store/auth.store';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

const PASSWORD = 'Aa1!aaaaaa';
const FORM = { firstName: 'Sara', lastName: 'Ali', email: 'sara@example.com', password: PASSWORD, confirmPassword: PASSWORD, phone: { dialCode: '+20', number: '01000000001' }, agreeData: true, agreeTerms: true };
const CONFLICT = () => throwError(() => ({ status: 409, error: { success: false, code: 'REGISTRATION_DATA_UNAVAILABLE', message: 'تعذّر إنشاء حساب بهذه البيانات لأن البريد الإلكتروني أو رقم الجوال مرتبط بحساب قائم. صحّح البيانات، أو سجّل الدخول، أو استعد كلمة المرور، أو تواصل مع الدعم' } }));

function mount(onPost: (url: string, body: any) => any) {
	const store = { currentUser: signal<any>(null), pendingUserId: signal<any>(null), isPendingVerification: () => false, token: () => null, authenticate: vi.fn(), setPendingVerification: vi.fn() };
	const post = vi.fn((url: string, body: any) => /referral-cookie/.test(String(url)) ? of({ success: true, data: {} }) : onPost(String(url), body));
	const setItem = vi.fn();
	vi.stubGlobal('localStorage', { getItem: () => null, setItem, removeItem: () => {} });
	TestBed.configureTestingModule({
		imports: [Register],
		providers: [
			provideRouter([{ path: '**', component: BlankTestComponent }]),
			{ provide: HttpClient, useValue: { post, get: () => of({ success: true, data: { active: false } }) } },
			{ provide: AuthStore, useValue: store },
			{ provide: SocialAuthService, useValue: { authState: new Subject<any>(), initState: of(undefined) } },
		],
	});
	const fixture = TestBed.createComponent(Register);
	fixture.detectChanges();
	const c: any = fixture.componentInstance;
	c.selectedAccountType = 'client_ind';
	c.currentStep = 2;
	c.basicInfoForm.patchValue(FORM);
	return { c, fixture, el: fixture.nativeElement as HTMLElement, post, setItem, store };
}
const type = (c: any, code = '123456') => { for (let i = 0; i < 6; i++) c.verificationForm.get(`code${i + 1}`).setValue(code[i]); };
const calls = (post: any, re: RegExp) => post.mock.calls.filter((x: any[]) => re.test(String(x[0])));

describe('Register (e-mail-first): proof before account', () => {
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('step 1 sends the data WITHOUT the password; the password travels only in step 2, and is never written to storage', () => {
		const m = mount((url) => /register\/start$/.test(url) ? of({ success: true, message: 'x', data: { emailSent: true, ticket: 'T' } }) : of({ success: true, data: { token: 't', user: { accountType: 'CLIENT_INDIVIDUAL' } } }));
		m.c.nextStep();
		const start = calls(m.post, /register\/start$/)[0];
		expect(JSON.stringify(start[1])).not.toContain(PASSWORD);
		expect(start[1].phoneNumber).toBe('01000000001');
		expect(start[1].password).toBeUndefined();
		type(m.c); m.c.onVerificationSubmit();
		const done = calls(m.post, /register\/complete$/)[0];
		expect(done[1]).toEqual(expect.objectContaining({ password: PASSWORD, ticket: 'T', code: '123456' }));
		expect(calls(m.post, /verify-otp$/).length).toBe(0);
		for (const [, v] of m.setItem.mock.calls) expect(String(v)).not.toContain(PASSWORD);
	});

	it('a proven e-mail whose data is refused (409): ONE clear panel with correct-data / login / recovery, no navigation, no new mail, nothing about the other account', () => {
		const m = mount((url) => /register\/start$/.test(url) ? of({ success: true, data: { emailSent: true, ticket: 'T' } }) : CONFLICT());
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate');
		m.c.nextStep(); type(m.c); m.c.onVerificationSubmit();
		m.fixture.detectChanges(false);
		const panel = m.el.querySelector('[data-testid="register-data-unavailable"]')!;
		expect(panel).not.toBeNull();
		expect(panel.textContent).toContain('مرتبط بحساب قائم');
		expect(panel.querySelector('#data-unavailable-edit')).not.toBeNull();
		expect(panel.querySelector('#data-unavailable-login')!.getAttribute('href')).toContain('/auth/login');
		expect(panel.querySelector('#data-unavailable-forgot')!.getAttribute('href')).toContain('/auth/forget-password');
		expect(nav).not.toHaveBeenCalledWith(['/auth/welcome'], expect.anything());
		expect(m.store.authenticate).not.toHaveBeenCalled();
		expect(calls(m.post, /register\/start$/).length).toBe(1);
	});

	it('after the 409 the user corrects the phone: it is completed with the code already entered, without a new proof mail', () => {
		let answer: () => any = CONFLICT;
		const m = mount((url) => /register\/start$/.test(url) ? of({ success: true, data: { emailSent: true, ticket: 'T' } }) : answer());
		m.c.nextStep(); type(m.c); m.c.onVerificationSubmit();
		answer = () => of({ success: true, data: { token: 't', user: { accountType: 'CLIENT_INDIVIDUAL' } } });
		m.c.prevStep();
		m.c.basicInfoForm.patchValue({ phone: { dialCode: '+20', number: '01000000002' } });
		m.c.nextStep();
		expect(calls(m.post, /register\/start$/).length).toBe(1);
		const done = calls(m.post, /register\/complete$/);
		expect(done.length).toBe(2);
		expect(done[1][1].code).toBe('123456');
		expect(done[1][1].phoneNumber).toBe('01000000002');
	});

	it('a wrong code is a message on the code step (no panel); the typed e-mail is shown in full so a typo can be fixed', () => {
		const m = mount((url) => /register\/start$/.test(url) ? of({ success: true, data: { emailSent: true, ticket: 'T' } }) : throwError(() => ({ status: 400, error: { message: 'رمز التحقق غير صحيح أو منتهي' } })));
		m.c.nextStep(); type(m.c, '000000'); m.c.onVerificationSubmit();
		m.fixture.detectChanges(false);
		expect(m.c.errorMessage).toContain('غير صحيح');
		expect(m.el.querySelector('[data-testid="register-data-unavailable"]')).toBeNull();
		expect(m.el.querySelector('#masked-email')!.textContent!.trim()).toBe('sara@example.com');
	});

	it('SMTP failure at step 1: stays on the form with the reason; the data and the password field stay, no code step', () => {
		const m = mount(() => of({ success: false, message: 'تعذر إرسال رمز التحقق الآن', data: { emailSent: false } }));
		m.c.nextStep();
		expect(m.c.currentStep).toBe(2);
		expect(m.c.errorMessage).toContain('تعذر إرسال');
		expect(m.c.basicInfoForm.get('password').value).toBe(PASSWORD);
		expect(m.c.proofFlow).toBe(false);
	});
});
