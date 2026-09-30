import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SocialAuthService } from '@abacritt/angularx-social-login';

import { Register } from './register';
import { AuthStore } from '../../../core/store/auth.store';
import { AffiliatePicker } from './affiliate-picker/affiliate-picker';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

function setup() {
	const postSpy = vi.fn<(...args: any[]) => any>();
	const fakeAuthStore = {
		currentUser: signal<any>(null),
		pendingUserId: signal<any>(null),
		authenticate: vi.fn(),
		setPendingVerification: vi.fn(),
	};
	const authState = new Subject<any>();
	// GoogleSigninButtonDirective (rendered by register.html's <asl-google-signin-button>)
	// separately reads socialAuthService.initState on construction.
	const fakeSocialAuthService = { authState, initState: of(undefined) };

	// Register's ngOnInit() calls checkDraft(), which reads localStorage.
	vi.stubGlobal('localStorage', {
		getItem: () => null,
		setItem: () => {},
		removeItem: () => {},
	});

	TestBed.configureTestingModule({
		imports: [Register],
		providers: [
			provideRouter([{ path: '**', component: BlankTestComponent }]),
			{ provide: HttpClient, useValue: { post: (...args: any[]) => postSpy(...args) } },
			{ provide: AuthStore, useValue: fakeAuthStore },
			{ provide: SocialAuthService, useValue: fakeSocialAuthService },
		],
	});

	const fixture: ComponentFixture<Register> = TestBed.createComponent(Register);
	const component = fixture.componentInstance;

	return { fixture, component, postSpy, authState };
}

describe('Register', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('should create', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});

	describe('Google sign-in (intent: register)', () => {
		it('a brand-new Google identity sends intent "register" and switches step 2 into "complete your profile" mode, without logging in', async () => {
			const { fixture, component, postSpy, authState } = setup();
			fixture.detectChanges();
			component.currentStep = 2;
			component.selectedAccountType = 'service_provider_ind';

			postSpy.mockReturnValue(of({
				success: true,
				data: {
					verified: false,
					registrationRequired: true,
					googleProfile: { email: 'new@example.com', firstName: 'Sara', lastName: 'Ali' }
				}
			}));

			authState.next({ idToken: 'google-id-token' });
			await fixture.whenStable();

			expect(postSpy).toHaveBeenCalledWith(
				expect.stringContaining('/google'),
				expect.objectContaining({ idToken: 'google-id-token', intent: 'register', accountType: 'PROVIDER_INDIVIDUAL' })
			);
			expect(component.isGoogleFlow).toBe(true);
			expect(component.basicInfoForm.get('email')?.value).toBe('new@example.com');
			expect(component.basicInfoForm.get('firstName')?.value).toBe('Sara');
		});

		it('an already-registered Google identity shows "account already exists" with a link to Login, never logs in or creates a duplicate', async () => {
			const { fixture, component, postSpy, authState } = setup();
			fixture.detectChanges();
			component.currentStep = 2;
			component.selectedAccountType = 'service_provider_ind';

			postSpy.mockReturnValue(throwError(() => ({
				status: 409,
				error: { message: 'هذا الحساب موجود بالفعل، يرجى تسجيل الدخول' }
			})));

			authState.next({ idToken: 'google-id-token' });
			await fixture.whenStable();

			expect(component.accountExistsError).toBe(true);
			expect(component.errorMessage).toContain('موجود بالفعل');
			expect(component.isGoogleFlow).toBe(false);
		});
	});

	describe('Affiliate referral attribution (P-LG-012)', () => {
		it('manual code entry flows through to the /auth/register payload as affiliateIdentifier', () => {
			const { fixture, component, postSpy } = setup();
			fixture.detectChanges();

			component.affiliateIdentifier = 'AFF-CODE-1';
			postSpy.mockReturnValue(of({ success: true, data: { userId: 'u1' } }));

			(component as any).submitRegistration();

			expect(postSpy).toHaveBeenCalledWith(
				expect.stringContaining('/register'),
				expect.objectContaining({ affiliateIdentifier: 'AFF-CODE-1' })
			);
		});

		it('a search-by-name selection on app-affiliate-picker flows through the same field', () => {
			const { fixture, component, postSpy } = setup();
			// app-affiliate-picker only renders once step 2 (the basic-info form) is shown.
			component.currentStep = 2;
			fixture.detectChanges();

			const picker = fixture.debugElement.query(By.directive(AffiliatePicker)).componentInstance as AffiliatePicker;
			picker.pickResult({ id: 'a1', referralSlug: 'marketer-sara', displayName: 'سارة المسوقة' });
			fixture.detectChanges();

			expect(component.affiliateIdentifier).toBe('marketer-sara');

			postSpy.mockReturnValue(of({ success: true, data: { userId: 'u1' } }));
			(component as any).submitRegistration();

			expect(postSpy).toHaveBeenCalledWith(
				expect.stringContaining('/register'),
				expect.objectContaining({ affiliateIdentifier: 'marketer-sara' })
			);
		});

		it('clearing the selection removes affiliateIdentifier from the payload entirely (never sent as "" or null)', () => {
			const { fixture, component, postSpy } = setup();
			component.currentStep = 2;
			fixture.detectChanges();

			const picker = fixture.debugElement.query(By.directive(AffiliatePicker)).componentInstance as AffiliatePicker;
			picker.pickResult({ id: 'a1', referralSlug: 'marketer-sara', displayName: 'سارة المسوقة' });
			fixture.detectChanges();
			expect(component.affiliateIdentifier).toBe('marketer-sara');

			picker.clearSelection();
			fixture.detectChanges();
			expect(component.affiliateIdentifier).toBeNull();

			postSpy.mockReturnValue(of({ success: true, data: { userId: 'u1' } }));
			(component as any).submitRegistration();

			const lastCall = postSpy.mock.calls[postSpy.mock.calls.length - 1];
			expect(lastCall[1].affiliateIdentifier).toBeUndefined();
		});

		it('wires the same affiliateIdentifier into the Google registration payload', async () => {
			const { fixture, component, postSpy, authState } = setup();
			fixture.detectChanges();
			component.currentStep = 2;
			component.selectedAccountType = 'service_provider_ind';
			component.affiliateIdentifier = 'AFF-CODE-1';

			postSpy.mockReturnValue(of({
				success: true,
				data: {
					verified: false,
					registrationRequired: true,
					googleProfile: { email: 'new@example.com', firstName: 'Sara', lastName: 'Ali' }
				}
			}));

			authState.next({ idToken: 'google-id-token' });
			await fixture.whenStable();

			expect(postSpy).toHaveBeenCalledWith(
				expect.stringContaining('/google'),
				expect.objectContaining({ affiliateIdentifier: 'AFF-CODE-1' })
			);
		});
	});
});
