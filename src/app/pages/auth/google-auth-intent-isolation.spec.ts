import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { ReplaySubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SocialAuthService } from '@abacritt/angularx-social-login';

import { Login } from './login/login';
import { Register } from './register/register';
import { AuthStore } from '../../core/store/auth.store';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

/**
 * REGRESSION for a real browser bug: SocialAuthService.authState is a single
 * app-wide ReplaySubject(1) (confirmed in
 * node_modules/@abacritt/angularx-social-login — `this._authState = new
 * ReplaySubject(1)`). Neither Login nor Register unsubscribed from it in
 * ngOnDestroy, so visiting /auth/login and then navigating to /auth/register
 * WITHOUT the fix left Login's subscription alive. When the user then
 * completed "Sign Up with Google" for an email that ALREADY has a Waseet
 * account, BOTH the (leaked) Login handler and the live Register handler
 * received the exact same Google sign-in emission. Login's handler
 * unconditionally sends intent:'login', which succeeds for an existing
 * account and calls authStore.authenticate(...) — silently logging the user
 * in behind an unrelated signup attempt, even though Register's own handler
 * correctly received a 409.
 *
 * This is deliberately a multi-component integration test — a single
 * component's own isolated spec can never catch this, because the bug only
 * exists when TWO page instances (one stale, one live) share one real
 * ReplaySubject at the same time. That is exactly what this test sets up.
 */
function setup() {
	const postSpy = vi.fn<(...args: any[]) => any>((_url: string, body: any) => {
		if (body.intent === 'register') {
			return throwError(() => ({
				status: 409,
				error: { message: 'هذا الحساب موجود بالفعل، يرجى تسجيل الدخول' }
			}));
		}
		// intent 'login' against an existing account always succeeds —
		// exactly the real backend contract (see auth.service.test.ts).
		return of({
			success: true,
			data: {
				verified: true,
				token: 'leaked-session-token',
				user: { id: 'existing-user-1', accountType: 'PROVIDER_INDIVIDUAL', activeRole: 'PROVIDER', roles: ['PROVIDER'] }
			}
		});
	});

	const authenticateSpy = vi.fn();
	const fakeAuthStore = {
		currentUser: signal<any>(null),
		pendingUserId: signal<any>(null),
		authenticate: authenticateSpy,
		setPendingVerification: vi.fn(),
	};

	// The REAL RxJS primitive the library uses, not a plain Subject — a late
	// subscriber (Register, mounted after Login) still gets the replayed
	// last value, exactly like production.
	const authState = new ReplaySubject<any>(1);
	const fakeSocialAuthService = { authState, initState: of(undefined) };

	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

	TestBed.configureTestingModule({
		imports: [Login, Register],
		providers: [
			provideRouter([{ path: '**', component: BlankTestComponent }]),
			{ provide: HttpClient, useValue: { post: (...args: any[]) => postSpy(...args) } },
			{ provide: AuthStore, useValue: fakeAuthStore },
			{ provide: SocialAuthService, useValue: fakeSocialAuthService },
		],
	});

	return { postSpy, authenticateSpy, authState };
}

describe('Google auth intent isolation across Login and Register (real leaked-subscription bug)', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('BEFORE the fix would have logged the user in via a leaked Login subscription; AFTER the fix, no session is ever created for Sign Up + Google + existing account', async () => {
		const { postSpy, authenticateSpy, authState } = setup();

		// 1. User visits /auth/login earlier in the tab session (leaves a
		// subscription behind if not properly torn down).
		const loginFixture: ComponentFixture<Login> = TestBed.createComponent(Login);
		loginFixture.detectChanges();

		// 2. User navigates away — Angular destroys the component. With the
		// fix (takeUntilDestroyed), this MUST tear down its authState
		// subscription. Without the fix, the closure leaks and stays live.
		loginFixture.destroy();

		// 3. User goes to /auth/register instead, reaches step 2, picks a
		// role, and clicks "Continue with Google".
		const registerFixture: ComponentFixture<Register> = TestBed.createComponent(Register);
		const register = registerFixture.componentInstance;
		registerFixture.detectChanges();
		register.currentStep = 2;
		register.selectedAccountType = 'service_provider_ind';

		// 4. A single Google sign-in event for an email that ALREADY has a
		// Waseet account.
		authState.next({ idToken: 'google-id-token-existing-account' });
		await registerFixture.whenStable();

		// The critical invariant: no Waseet session may ever be created by
		// this attempted signup, regardless of how many stale subscriptions
		// also received the event.
		expect(authenticateSpy).not.toHaveBeenCalled();

		// Register's own handling must still correctly show "account exists".
		expect(register.accountExistsError).toBe(true);
		expect(register.errorMessage).toContain('موجود بالفعل');

		// Only ONE request should ever have reached the backend for this
		// single Google sign-in event — the leaked Login subscription (if the
		// fix regresses) would produce a second, intent:'login' call.
		expect(postSpy).toHaveBeenCalledTimes(1);
		expect(postSpy).toHaveBeenCalledWith(
			expect.stringContaining('/google'),
			expect.objectContaining({ intent: 'register' })
		);
	});

	it('Login + Google + the SAME existing account, as its own fresh page visit, still succeeds normally', async () => {
		const { postSpy, authenticateSpy, authState } = setup();

		const loginFixture: ComponentFixture<Login> = TestBed.createComponent(Login);
		loginFixture.detectChanges();

		authState.next({ idToken: 'google-id-token-existing-account' });
		await loginFixture.whenStable();

		expect(authenticateSpy).toHaveBeenCalledTimes(1);
		expect(postSpy).toHaveBeenCalledWith(
			expect.stringContaining('/google'),
			expect.objectContaining({ intent: 'login' })
		);
	});

	it('REPLAY REGRESSION: a cached Google credential (already consumed by Register) must NOT auto-authenticate when the user navigates to Login — only an explicit NEW Google click on the Login page may', async () => {
		const { postSpy, authenticateSpy, authState } = setup();

		// 1. Sign Up -> Google -> existing account -> ACCOUNT_EXISTS. This is
		// the exact real reproduction: authState now holds this credential as
		// its buffered ReplaySubject(1) value.
		const registerFixture: ComponentFixture<Register> = TestBed.createComponent(Register);
		const register = registerFixture.componentInstance;
		registerFixture.detectChanges();
		register.currentStep = 2;
		register.selectedAccountType = 'service_provider_ind';

		authState.next({ idToken: 'google-id-token-existing-account' });
		await registerFixture.whenStable();

		expect(register.accountExistsError).toBe(true);
		expect(authenticateSpy).not.toHaveBeenCalled();
		postSpy.mockClear();

		// 2. User clicks "تسجيل الدخول" -> real navigation to /auth/login,
		// which destroys the Register component (and, with the leak fix,
		// unsubscribes it) — but the SHARED authState ReplaySubject(1) still
		// holds the same buffered credential regardless.
		registerFixture.destroy();

		// 3. Login mounts fresh and subscribes to that same, still-buffered
		// authState. Merely arriving here must not be interpreted as a login
		// attempt.
		const loginFixture: ComponentFixture<Login> = TestBed.createComponent(Login);
		loginFixture.detectChanges();
		await loginFixture.whenStable();

		expect(postSpy).not.toHaveBeenCalled();
		expect(authenticateSpy).not.toHaveBeenCalled();
		expect(loginFixture.componentInstance.isSubmitting).toBe(false);

		// 4. THEN the user explicitly clicks "Continue with Google" on the
		// Login page itself — a genuinely new emission, which must succeed.
		authState.next({ idToken: 'google-id-token-existing-account' });
		await loginFixture.whenStable();

		expect(postSpy).toHaveBeenCalledWith(
			expect.stringContaining('/google'),
			expect.objectContaining({ intent: 'login' })
		);
		expect(authenticateSpy).toHaveBeenCalledTimes(1);
	});

	it('REPLAY REGRESSION (Register side): merely visiting /auth/register must not consume a cached Google credential and start registration', async () => {
		const { postSpy, authenticateSpy, authState } = setup();

		// A Google credential was already emitted (e.g. from a prior Login
		// attempt on this same identity) and sits buffered in authState.
		authState.next({ idToken: 'google-id-token-existing-account' });

		const registerFixture: ComponentFixture<Register> = TestBed.createComponent(Register);
		const register = registerFixture.componentInstance;
		registerFixture.detectChanges();
		register.currentStep = 2;
		register.selectedAccountType = 'service_provider_ind';
		await registerFixture.whenStable();

		// Simply being on step 2 with an account type selected must not, by
		// itself, retroactively process the already-buffered credential.
		expect(postSpy).not.toHaveBeenCalled();
		expect(authenticateSpy).not.toHaveBeenCalled();
		expect(register.accountExistsError).toBe(false);
		expect(register.isGoogleFlow).toBe(false);

		// An explicit NEW Google click on Register now works normally.
		authState.next({ idToken: 'google-id-token-new-identity' });
		await registerFixture.whenStable();
		expect(postSpy).toHaveBeenCalledWith(
			expect.stringContaining('/google'),
			expect.objectContaining({ intent: 'register' })
		);
	});
});
