import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SocialAuthService } from '@abacritt/angularx-social-login';

import { Login, SMS_UNAVAILABLE_MESSAGE } from './login';
import { AuthStore } from '../../../core/store/auth.store';

/** No SMS / phone-verification UI anywhere on the page (modal, "sent to your phone" text, OTP boxes, decorative star in an OTP card). */
function expectNoSmsUi(root: HTMLElement) {
	expect(root.querySelector('#modal-otp')).toBeNull();
	expect(root.querySelector('.otp-row, .otp-in, [id^="login-otp-"]')).toBeNull();
	expect(root.textContent).not.toContain('لجوالك');
	expect(root.textContent).not.toContain('تحقق من هويتك');
	expect(root.querySelector('.modal-box use[href="#ws-ai-spark"], .otp-card use[href="#ws-ai-spark"]')).toBeNull();
}

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

function setup() {
	const postSpy = vi.fn<(...args: any[]) => any>();
	const fakeAuthStore = {
		currentUser: signal<any>(null),
		authenticate: vi.fn(),
		setPendingVerification: vi.fn(),
	};
	const authState = new Subject<any>();
	// GoogleSigninButtonDirective (rendered by login.html's <asl-google-signin-button>)
	// separately reads socialAuthService.initState on construction.
	const fakeSocialAuthService = { authState, initState: of(undefined) };

	TestBed.configureTestingModule({
		imports: [Login],
		providers: [
			provideRouter([{ path: '**', component: BlankTestComponent }]),
			{ provide: HttpClient, useValue: { post: (...args: any[]) => postSpy(...args) } },
			{ provide: AuthStore, useValue: fakeAuthStore },
			{ provide: SocialAuthService, useValue: fakeSocialAuthService },
		],
	});

	const fixture: ComponentFixture<Login> = TestBed.createComponent(Login);
	const component = fixture.componentInstance;
	const router = TestBed.inject(Router);
	const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

	return { fixture, component, router, postSpy, fakeAuthStore, authState, navigateByUrlSpy };
}

describe('Login', () => {
	it('the trust row claims no MFA (there is no MFA feature): no "MFA" badge on the page', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const badges = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.trust-bdg')).map(b => b.textContent?.trim());
		expect(badges).not.toContain('MFA');
		expect((fixture.nativeElement as HTMLElement).textContent).not.toMatch(/\bMFA\b/);
	});

	it('should create', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});

	describe('Google sign-in (intent: login)', () => {
		it('sends intent "login" and, on an existing-account success, navigates straight to the dashboard — never /auth/welcome', async () => {
			const { fixture, postSpy, authState, navigateByUrlSpy } = setup();
			fixture.detectChanges();

			postSpy.mockReturnValue(of({
				success: true,
				data: {
					verified: true,
					token: 'tok-1',
					user: { id: 'u1', accountType: 'PROVIDER_INDIVIDUAL', activeRole: 'PROVIDER', roles: ['PROVIDER'] }
				}
			}));

			authState.next({ idToken: 'google-id-token' });
			await fixture.whenStable();

			expect(postSpy).toHaveBeenCalledWith(
				expect.stringContaining('/google'),
				expect.objectContaining({ idToken: 'google-id-token', intent: 'login' })
			);
			expect(navigateByUrlSpy).toHaveBeenCalledWith('/provider-overview');
			expect(navigateByUrlSpy).not.toHaveBeenCalledWith(expect.stringContaining('/auth/welcome'));
		});

		it('a 404 (no account for this Google identity) shows the account-not-found state instead of creating one', async () => {
			const { fixture, postSpy, authState, navigateByUrlSpy, component } = setup();
			fixture.detectChanges();

			postSpy.mockReturnValue(throwError(() => ({
				status: 404,
				error: { message: 'لا يوجد حساب بهذا البريد الإلكتروني، يرجى إنشاء حساب أولاً' }
			})));

			authState.next({ idToken: 'google-id-token' });
			await fixture.whenStable();

			expect(component.accountNotFoundError).toBe(true);
			expect(component.errorMessage).toContain('لا يوجد حساب');
			expect(navigateByUrlSpy).not.toHaveBeenCalled();
		});

		it('a phone-OTP challenge never opens an SMS modal: Arabic "unavailable" error, no navigation, no pending verification', async () => {
			const { fixture, postSpy, authState, navigateByUrlSpy, component, fakeAuthStore } = setup();
			fixture.detectChanges();

			postSpy.mockReturnValue(of({
				success: true,
				data: { verified: false, phoneOtpRequired: true, userId: 'u2' }
			}));

			authState.next({ idToken: 'google-id-token' });
			await fixture.whenStable();
			fixture.detectChanges();

			expect(component.errorMessage).toBe(SMS_UNAVAILABLE_MESSAGE);
			expect(navigateByUrlSpy).not.toHaveBeenCalled();
			expectNoSmsUi(fixture.nativeElement);
		});

		it('Google login answered with the 503 "SMS unavailable" shows the Arabic message and no SMS boxes', async () => {
			const { fixture, postSpy, authState, component } = setup();
			fixture.detectChanges();
			postSpy.mockReturnValue(throwError(() => ({ status: 503, error: { success: false, message: SMS_UNAVAILABLE_MESSAGE } })));
			authState.next({ idToken: 'google-id-token' });
			await fixture.whenStable();
			fixture.detectChanges();
			expect(component.errorMessage).toBe(SMS_UNAVAILABLE_MESSAGE);
			expectNoSmsUi(fixture.nativeElement);
		});

		it('Google login of an unverified account goes to the EMAIL verification screen', async () => {
			const { fixture, postSpy, authState, router } = setup();
			fixture.detectChanges();
			const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
			postSpy.mockReturnValue(of({ success: true, data: { verified: false, userId: 'u3', emailSent: true } }));
			authState.next({ idToken: 'google-id-token' });
			await fixture.whenStable();
			expect(nav).toHaveBeenCalledWith(['/auth/verify-otp']);
		});
	});

	describe('Password login', () => {
		it('an existing account navigates straight to the dashboard — never /auth/welcome', async () => {
			const { fixture, component, postSpy, navigateByUrlSpy } = setup();
			fixture.detectChanges();

			postSpy.mockReturnValue(of({
				success: true,
				data: {
					verified: true,
					token: 'tok-2',
					user: { id: 'u3', accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT', roles: ['CLIENT'] }
				}
			}));

			component.loginForm.setValue({ email: 'a@b.com', password: 'password123', remember: false });
			component.onSubmit();
			await fixture.whenStable();

			expect(navigateByUrlSpy).toHaveBeenCalledWith('/client-overview');
			expect(navigateByUrlSpy).not.toHaveBeenCalledWith(expect.stringContaining('/auth/welcome'));
		});

		it('a phone-OTP challenge on password login shows the Arabic error, never an SMS step', async () => {
			const { fixture, component, postSpy, navigateByUrlSpy } = setup();
			fixture.detectChanges();
			postSpy.mockReturnValue(of({ success: true, data: { verified: false, phoneOtpRequired: true, userId: 'u9' } }));
			component.loginForm.setValue({ email: 'a@b.com', password: 'password123', remember: false });
			component.onSubmit();
			await fixture.whenStable();
			fixture.detectChanges();
			expect(component.errorMessage).toBe(SMS_UNAVAILABLE_MESSAGE);
			expect(navigateByUrlSpy).not.toHaveBeenCalled();
			expectNoSmsUi(fixture.nativeElement);
		});

		it('a 503 SMS-unavailable answer to password login shows the Arabic message', async () => {
			const { fixture, component, postSpy } = setup();
			fixture.detectChanges();
			postSpy.mockReturnValue(throwError(() => ({ status: 503, error: { success: false, message: SMS_UNAVAILABLE_MESSAGE } })));
			component.loginForm.setValue({ email: 'a@b.com', password: 'password123', remember: false });
			component.onSubmit();
			await fixture.whenStable();
			fixture.detectChanges();
			expect(component.errorMessage).toBe(SMS_UNAVAILABLE_MESSAGE);
			expectNoSmsUi(fixture.nativeElement);
		});

		it('the login page has no SMS UI at all by default', () => {
			const { fixture } = setup();
			fixture.detectChanges();
			expectNoSmsUi(fixture.nativeElement);
		});
	});

	describe('always starts empty', () => {
		it('the form is empty on open, with standard credential semantics and nothing read-only', () => {
			const { fixture, component } = setup();
			fixture.detectChanges();
			const el: HTMLElement = fixture.nativeElement;
			expect(component.loginForm.value).toEqual({ email: '', password: '', remember: false });
			const form = el.querySelector('#login-form') as HTMLFormElement;
			expect(form.tagName).toBe('FORM');
			expect(form.hasAttribute('autocomplete')).toBe(false);
			const email = el.querySelector('#identifier') as HTMLInputElement;
			const pass = el.querySelector('#password') as HTMLInputElement;
			expect(email.type).toBe('email');
			expect(email.getAttribute('autocomplete')).toBe('username');
			expect(email.getAttribute('inputmode')).toBe('email');
			expect(email.getAttribute('name')).toBe('email');
			expect(pass.type).toBe('password');
			expect(pass.getAttribute('autocomplete')).toBe('current-password');
			expect(pass.getAttribute('name')).toBe('password');
			expect(form.contains(email) && form.contains(pass)).toBe(true);
			expect(form.querySelector('button[type=submit]#btn-login')).not.toBeNull();
			// e-mail first, password right after it, no other text input in between
			const fields = Array.from(form.querySelectorAll('input:not([type=checkbox])'));
			expect(fields.indexOf(pass) - fields.indexOf(email)).toBe(1);
			for (const i of [email, pass]) {
				expect(i.hasAttribute('readonly')).toBe(false);
				i.dispatchEvent(new Event('focus'));
				expect(i.hasAttribute('readonly')).toBe(false);
				expect(i.getAttribute('autocomplete')).not.toBe('off');
			}
		});

		it('a fill that arrives before any user gesture (Chrome autofill on load) is dropped once', () => {
			const { fixture, component } = setup();
			fixture.detectChanges();
			const el: HTMLElement = fixture.nativeElement;
			const email = el.querySelector('#identifier') as HTMLInputElement;
			const pass = el.querySelector('#password') as HTMLInputElement;
			email.value = 'saved@example.com'; email.dispatchEvent(new Event('input'));
			pass.value = 'saved-password'; pass.dispatchEvent(new Event('input'));
			expect(email.value).toBe('');
			expect(pass.value).toBe('');
			expect(component.loginForm.value).toEqual({ email: '', password: '', remember: false });
		});

		it('after a user gesture, typed or picked values are never cleared', async () => {
			const { fixture, component } = setup();
			fixture.detectChanges();
			const el: HTMLElement = fixture.nativeElement;
			const email = el.querySelector('#identifier') as HTMLInputElement;
			const pass = el.querySelector('#password') as HTMLInputElement;
			document.dispatchEvent(new Event('pointerdown'));
			email.value = 'picked@example.com'; email.dispatchEvent(new Event('input')); email.dispatchEvent(new Event('change'));
			pass.value = 'picked-pass'; pass.dispatchEvent(new Event('input')); pass.dispatchEvent(new Event('change'));
			window.dispatchEvent(new Event('pageshow'));
			await new Promise(r => setTimeout(r, 700));
			expect(email.value).toBe('picked@example.com');
			expect(pass.value).toBe('picked-pass');
			expect(component.loginForm.value.email).toBe('picked@example.com');
			expect(component.loginForm.value.password).toBe('picked-pass');
		});

		it('a bfcache restore (pageshow persisted) starts empty again', () => {
			const { fixture, component } = setup();
			fixture.detectChanges();
			const el: HTMLElement = fixture.nativeElement;
			document.dispatchEvent(new Event('keydown'));
			component.loginForm.patchValue({ email: 'a@b.co', password: 'x' });
			const ev = new Event('pageshow') as any; ev.persisted = true;
			window.dispatchEvent(ev);
			expect((el.querySelector('#identifier') as HTMLInputElement).value).toBe('');
			expect(component.loginForm.value.email).toBe('');
		});

		it('values painted by the browser (no input event) are kept and reach the form on submit even without input events', async () => {
			const { fixture, component, postSpy } = setup();
			fixture.detectChanges();
			const el: HTMLElement = fixture.nativeElement;
			(el.querySelector('#identifier') as HTMLInputElement).value = 'saved@example.com';
			(el.querySelector('#password') as HTMLInputElement).value = 'saved-password';
			await new Promise(r => setTimeout(r, 700));
			expect((el.querySelector('#identifier') as HTMLInputElement).value).toBe('saved@example.com');
			postSpy.mockReturnValue(throwError(() => ({ status: 401, error: { message: 'x' } })));
			component.onSubmit();
			expect(component.loginForm.value.email).toBe('saved@example.com');
			expect(component.loginForm.value.password).toBe('saved-password');
		});

		it('the app never writes the e-mail or password to any storage while typing and submitting', () => {
			const written: string[] = [];
			const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string, v: string) => { written.push(`${k}=${v}`); });
			try {
				const { fixture, component, postSpy } = setup();
				fixture.detectChanges();
				postSpy.mockReturnValue(throwError(() => ({ status: 401, error: { message: 'x' } })));
				component.loginForm.patchValue({ email: 'typed@example.com', password: 'S3cret-typed' });
				component.onSubmit();
				expect(written.join('|')).not.toContain('typed@example.com');
				expect(written.join('|')).not.toContain('S3cret-typed');
			} finally { setItem.mockRestore(); }
		});

		it('there is no "AI protection" badge at all (no system behind it), and never the sparkle/star', () => {
			const { fixture } = setup();
			fixture.detectChanges();
			const el: HTMLElement = fixture.nativeElement;
			expect(el.querySelector('.ai-auth-badge')).toBeNull();
			expect(el.textContent).not.toContain('حماية متقدمة بالذكاء الاصطناعي');
			expect(el.querySelector('use[href="#ws-ai-spark"]')).toBeNull();
		});
	});
});
