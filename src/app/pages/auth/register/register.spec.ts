import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ChangeDetectorRef, Component, signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SocialAuthService } from '@abacritt/angularx-social-login';

import { Register } from './register';
import { AuthStore } from '../../../core/store/auth.store';
import { AffiliatePicker } from './affiliate-picker/affiliate-picker';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

/**
 * `ref: true` (default) = the page was opened through a real referral link (`/auth/register?ref=1`);
 * `ref: false` = opened directly (no marker).
 */
function setup(opts: { ref?: boolean } = {}) {
	const ref = opts.ref ?? true;
	// The clear-cookie call made by a direct visit needs a real observable; every other POST is set per test.
	const postSpy = vi.fn<(...args: any[]) => any>((url: string) => /referral-cookie\/clear/.test(String(url)) ? of({ success: true, data: { cleared: true } }) : undefined);
	// GET is only used by AffiliateApiService.getReferralStatus() (checked once
	// in Register's ngOnInit — P-LG-012 locked attribution) and by
	// AffiliatePicker's own resolve()/search() calls. Defaults to "no lock" so
	// every pre-existing test (written before this endpoint existed) keeps
	// exercising the normal unlocked picker without having to know about it.
	const getSpy = vi.fn<(...args: any[]) => any>().mockReturnValue(of({ success: true, data: { active: false } }));
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
			{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(ref ? { ref: '1' } : {}) } } },
			{ provide: HttpClient, useValue: { post: (...args: any[]) => postSpy(...args), get: (...args: any[]) => getSpy(...args) } },
			{ provide: AuthStore, useValue: fakeAuthStore },
			{ provide: SocialAuthService, useValue: fakeSocialAuthService },
		],
	});

	const fixture: ComponentFixture<Register> = TestBed.createComponent(Register);
	const component = fixture.componentInstance;

	return { fixture, component, postSpy, getSpy, authState };
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

	describe('Locked attribution via referral cookie (P-LG-012)', () => {
		it('renders the locked affiliate display with the resolved displayName when getReferralStatus() reports an active attribution', () => {
			const { fixture, component, getSpy } = setup();
			getSpy.mockReturnValue(of({
				success: true,
				data: { active: true, referralSlug: 'marketer-sara', displayName: 'سارة المسوقة' }
			}));

			// app-affiliate-picker (and its locked-display replacement) only render
			// once step 2 is shown — set before the single detectChanges() call so
			// ngOnInit's getReferralStatus() and the step-2 render happen together,
			// same pattern as the other picker tests above.
			component.currentStep = 2;
			fixture.detectChanges();

			expect(component.lockedAffiliate()).toEqual({ referralSlug: 'marketer-sara', displayName: 'سارة المسوقة' });
			const locked = fixture.debugElement.query(By.css('#affiliate-locked-display'));
			expect(locked).toBeTruthy();
			expect(locked.nativeElement.textContent).toContain('سارة المسوقة');
		});

		it('renders zero interactive picker controls when locked — no app-affiliate-picker is instantiated at all', () => {
			const { fixture, component, getSpy } = setup();
			getSpy.mockReturnValue(of({
				success: true,
				data: { active: true, referralSlug: 'marketer-sara', displayName: 'سارة المسوقة' }
			}));

			component.currentStep = 2;
			fixture.detectChanges();

			expect(fixture.debugElement.query(By.directive(AffiliatePicker))).toBeNull();
			expect(fixture.debugElement.query(By.css('#aff-code'))).toBeNull();
			expect(fixture.debugElement.query(By.css('#aff-search'))).toBeNull();
			expect(fixture.debugElement.query(By.css('#affiliate-locked-display input'))).toBeNull();
			expect(fixture.debugElement.query(By.css('#affiliate-locked-display button'))).toBeNull();
		});

		it('never sends affiliateIdentifier on submit when locked — attribution stays entirely server-side via the cookie', () => {
			const { fixture, component, postSpy, getSpy } = setup();
			getSpy.mockReturnValue(of({
				success: true,
				data: { active: true, referralSlug: 'marketer-sara', displayName: 'سارة المسوقة' }
			}));

			component.currentStep = 2;
			fixture.detectChanges();

			// Confirms the design decision: the locked display never populates
			// affiliateIdentifier, even though a lock is in effect.
			expect(component.affiliateIdentifier).toBeNull();

			postSpy.mockReturnValue(of({ success: true, data: { userId: 'u1' } }));
			(component as any).submitRegistration();

			// Same convention as the "clearing the selection" test above: the payload
			// literal always structurally defines the key, but with value
			// `undefined` — which JSON.stringify (the actual HTTP body) drops
			// entirely, so it is never sent over the wire.
			const lastCall = postSpy.mock.calls[postSpy.mock.calls.length - 1];
			expect(lastCall[1].affiliateIdentifier).toBeUndefined();
			expect(JSON.stringify(lastCall[1])).not.toContain('affiliateIdentifier');
		});

		it('falls back to the normal interactive picker when getReferralStatus() reports active:false', () => {
			const { fixture, component, getSpy } = setup();
			getSpy.mockReturnValue(of({ success: true, data: { active: false } }));

			component.currentStep = 2;
			fixture.detectChanges();

			expect(component.lockedAffiliate()).toBeNull();
			expect(fixture.debugElement.query(By.directive(AffiliatePicker))).toBeTruthy();
			expect(fixture.debugElement.query(By.css('#affiliate-locked-display'))).toBeNull();
		});

		it('fails open to the normal interactive picker when getReferralStatus() errors', () => {
			const { fixture, component, getSpy } = setup();
			getSpy.mockReturnValue(throwError(() => new Error('network error')));

			component.currentStep = 2;
			fixture.detectChanges();

			expect(component.lockedAffiliate()).toBeNull();
			expect(fixture.debugElement.query(By.directive(AffiliatePicker))).toBeTruthy();
		});
	});

	describe('account-type step: one continue button per card, no duplicate bottom button', () => {
		it('has no big bottom "متابعة" button / hint, and every card keeps its own button (disabled only on the "قريبًا" cards)', () => {
			const { fixture } = setup();
			fixture.detectChanges();
			const el: HTMLElement = fixture.nativeElement;
			expect(el.querySelector('#btn-proceed')).toBeNull();
			expect(el.querySelector('#proceed-hint')).toBeNull();
			expect(el.querySelector('.proceed-row')).toBeNull();
			const cards = Array.from(el.querySelectorAll('.roles-grid .role-card'));
			expect(cards.length).toBe(5);
			const ctas = cards.map(c => c.querySelector<HTMLButtonElement>('button.role-cta'));
			expect(ctas.every(b => !!b && b.textContent!.trim() === 'متابعة')).toBe(true);
			expect(ctas.map(b => b!.disabled)).toEqual([true, false, true, false, false]);
			expect(el.querySelectorAll('.role-soon-overlay').length).toBe(2);
		});

		for (const [idx, type] of [[1, 'service_requester_ind'], [3, 'service_provider_ind'], [4, 'marketing_broker']] as const) {
			it(`the card button of ${type} selects it and moves to step 2`, () => {
				const { fixture, component } = setup();
				fixture.detectChanges();
				fixture.nativeElement.querySelectorAll('.roles-grid .role-card')[idx].querySelector('button.role-cta').click();
				fixture.detectChanges();
				expect(component.selectedAccountType).toBe(type);
				expect(component.currentStep).toBe(2);
			});
		}
	});

	describe('never restores earlier input', () => {
		it('purges a legacy draft (that could hold a password), shows no restore banner and starts with empty fields', () => {
			const { fixture, component } = setup();
			const removed: string[] = [];
			vi.stubGlobal('localStorage', {
				getItem: (k: string) => k === 'waseet_register_draft' ? JSON.stringify({ accountType: 'service_requester_ind', basicInfo: { email: 'old@example.com', password: 'OldPassw0rd!' } }) : null,
				setItem: () => {},
				removeItem: (k: string) => removed.push(k),
			});
			fixture.detectChanges();
			const el: HTMLElement = fixture.nativeElement;
			expect(removed).toContain('waseet_register_draft');
			expect(el.querySelector('#draft-banner')).toBeNull();
			expect(component.basicInfoForm.get('email')!.value).toBeFalsy();
			expect(component.basicInfoForm.get('password')!.value).toBeFalsy();
			expect(el.querySelector('use[href="#ws-ai-spark"]')).toBeNull();
		});
	});

	describe('Referral section by account type (marketer is never attributed)', () => {
		const LOCKED = { success: true, data: { active: true, referralSlug: 'marketer-sara', displayName: 'سارة المسوّقة' } };

		function stepTwo(accountType: string, withReferralLink: boolean) {
			const ctx = setup();
			if (withReferralLink) ctx.getSpy.mockReturnValue(of(LOCKED));
			ctx.fixture.detectChanges();
			ctx.component.selectedAccountType = accountType;
			ctx.component.currentStep = 2;
			ctx.fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
			ctx.fixture.detectChanges(false);
			return { ...ctx, el: ctx.fixture.nativeElement as HTMLElement };
		}
		const sectionText = (el: HTMLElement) => el.textContent ?? '';

		it('client account with a referral link: the locked referral box shows the referring marketer', () => {
			const { el } = stepTwo('service_requester_ind', true);
			expect(el.querySelector('#affiliate-locked-display')).not.toBeNull();
			expect(sectionText(el)).toContain('سارة المسوّقة');
		});

		it('provider account with a referral link: the locked referral box shows', () => {
			const { el } = stepTwo('service_provider_ind', true);
			expect(el.querySelector('#affiliate-locked-display')).not.toBeNull();
		});

		it('client / provider without a link: the optional picker shows', () => {
			expect(stepTwo('service_requester_ind', false).el.querySelector('app-affiliate-picker')).not.toBeNull();
			TestBed.resetTestingModule();
			expect(stepTwo('service_provider_ind', false).el.querySelector('app-affiliate-picker')).not.toBeNull();
		});

		it('marketer account with a referral link: no section at all (no locked box, no input, no search) and nothing is sent', () => {
			const { el, component, postSpy } = stepTwo('marketing_broker', true);
			expect(el.querySelector('#affiliate-locked-display')).toBeNull();
			expect(el.querySelector('app-affiliate-picker')).toBeNull();
			expect(sectionText(el)).not.toContain('وسيط الإحالة');
			expect(sectionText(el)).not.toContain('الوسيط المُحيل');
			// even if a value was picked earlier (e.g. before switching the account type), it is not sent
			component.affiliateIdentifier = 'marketer-sara';
			postSpy.mockReturnValue(of({ success: true, data: { userId: 'u1' } }));
			(component as any).submitRegistration();
			const payload = postSpy.mock.calls.find(c => String(c[0]).includes('/register'))![1];
			expect(payload.accountType).toBe('MARKETING_BROKER');
			expect(payload.affiliateIdentifier).toBeUndefined();
			expect(JSON.stringify(payload)).not.toContain('marketer-sara');
		});

		it('marketer direct registration (no link): the referral section is not rendered', () => {
			const { el } = stepTwo('marketing_broker', false);
			expect(el.querySelector('app-affiliate-picker')).toBeNull();
			expect(el.querySelector('#affiliate-locked-display')).toBeNull();
			expect(sectionText(el)).not.toContain('وسيط الإحالة');
		});

		it('marketer Google registration sends no referral either; a client still does', async () => {
			const marketer = setup();
			marketer.fixture.detectChanges();
			marketer.component.currentStep = 2;
			marketer.component.selectedAccountType = 'marketing_broker';
			marketer.component.affiliateIdentifier = 'marketer-sara';
			marketer.postSpy.mockReturnValue(of({ success: true, data: { verified: false, registrationRequired: true, googleProfile: { email: 'm@example.com', firstName: 'M', lastName: 'K' } } }));
			marketer.authState.next({ idToken: 'google-id-token' });
			await marketer.fixture.whenStable();
			expect(marketer.postSpy.mock.calls.find(c => String(c[0]).includes('/google'))![1].affiliateIdentifier).toBeUndefined();
			TestBed.resetTestingModule();

			const client = setup();
			client.fixture.detectChanges();
			client.component.currentStep = 2;
			client.component.selectedAccountType = 'service_requester_ind';
			client.component.affiliateIdentifier = 'marketer-sara';
			client.postSpy.mockReturnValue(of({ success: true, data: { verified: false, registrationRequired: true, googleProfile: { email: 'c@example.com', firstName: 'C', lastName: 'L' } } }));
			client.authState.next({ idToken: 'google-id-token' });
			await client.fixture.whenStable();
			expect(client.postSpy.mock.calls.find(c => String(c[0]).includes('/google'))![1].affiliateIdentifier).toBe('marketer-sara');
		});
	});

	describe('Current-visit referral (?ref=1 marker)', () => {
		const LOCKED = { success: true, data: { active: true, referralSlug: 'marketer-sara', displayName: 'سارة المسوقة' } };
		const clearCalls = (postSpy: ReturnType<typeof vi.fn>) => postSpy.mock.calls.filter(c => /referral-cookie\/clear/.test(String(c[0])));
		const statusCalls = (getSpy: ReturnType<typeof vi.fn>) => getSpy.mock.calls.filter(c => /referral-status/.test(String(c[0])));

		it('/auth/register?ref=1 reads the referral status and shows the locked referrer; it never clears the cookie', () => {
			const { fixture, component, getSpy, postSpy } = setup({ ref: true });
			getSpy.mockReturnValue(of(LOCKED));
			component.currentStep = 2;
			fixture.detectChanges();
			expect(statusCalls(getSpy).length).toBe(1);
			expect(clearCalls(postSpy).length).toBe(0);
			expect(fixture.debugElement.query(By.css('#affiliate-locked-display'))).toBeTruthy();
			expect(fixture.debugElement.query(By.directive(AffiliatePicker))).toBeNull();
		});

		it('a refresh keeps the referral: the marker is still in the URL, so a fresh page load shows the locked referrer again', () => {
			const first = setup({ ref: true });
			first.getSpy.mockReturnValue(of(LOCKED));
			first.component.currentStep = 2;
			first.fixture.detectChanges();
			expect(first.component.lockedAffiliate()).not.toBeNull();
			first.fixture.destroy();
			TestBed.resetTestingModule();

			const reloaded = setup({ ref: true }); // same URL (?ref=1) after F5
			reloaded.getSpy.mockReturnValue(of(LOCKED));
			reloaded.component.currentStep = 2;
			reloaded.fixture.detectChanges();
			expect(reloaded.component.lockedAffiliate()).toEqual({ referralSlug: 'marketer-sara', displayName: 'سارة المسوقة' });
			expect(clearCalls(reloaded.postSpy).length).toBe(0);
		});

		it('/auth/register direct (no marker) clears the old cookie first, does not even ask the status, and shows the normal picker', () => {
			const { fixture, component, getSpy, postSpy } = setup({ ref: false });
			getSpy.mockReturnValue(of(LOCKED)); // a stale cookie would have made the status "active"
			component.currentStep = 2;
			fixture.detectChanges();
			expect(clearCalls(postSpy).length).toBe(1);
			expect(statusCalls(getSpy).length).toBe(0);
			expect(component.lockedAffiliate()).toBeNull();
			expect(fixture.debugElement.query(By.css('#affiliate-locked-display'))).toBeNull();
			expect(fixture.debugElement.query(By.directive(AffiliatePicker))).toBeTruthy();
		});

		it('visiting /ref/slug and then opening /auth/register directly is clean: no locked box, cookie cleared', () => {
			// 1) the referral visit (?ref=1) shows the referrer
			const visit = setup({ ref: true });
			visit.getSpy.mockReturnValue(of(LOCKED));
			visit.component.currentStep = 2;
			visit.fixture.detectChanges();
			expect(visit.component.lockedAffiliate()).not.toBeNull();
			visit.fixture.destroy();
			TestBed.resetTestingModule();

			// 2) a later direct visit: the backend would still report the stale cookie as active, but the page never asks
			const direct = setup({ ref: false });
			direct.getSpy.mockReturnValue(of(LOCKED));
			direct.component.currentStep = 2;
			direct.fixture.detectChanges();
			expect(clearCalls(direct.postSpy).length).toBe(1);
			expect(direct.component.lockedAffiliate()).toBeNull();
			expect(direct.fixture.debugElement.query(By.css('#affiliate-locked-display'))).toBeNull();
		});

		it('a failing clear call never blocks registration (fails open to the picker)', () => {
			const { fixture, component, postSpy } = setup({ ref: false });
			postSpy.mockReturnValue(throwError(() => ({ status: 500 })));
			component.currentStep = 2;
			expect(() => fixture.detectChanges()).not.toThrow();
			expect(fixture.debugElement.query(By.directive(AffiliatePicker))).toBeTruthy();
		});

		it('manual picker still works on a direct visit: the typed code is sent as affiliateIdentifier', () => {
			const { fixture, component, postSpy } = setup({ ref: false });
			component.selectedAccountType = 'service_requester_ind';
			component.currentStep = 2;
			fixture.detectChanges();
			component.affiliateIdentifier = 'AFF-CODE-1';
			postSpy.mockReturnValue(of({ success: true, data: { userId: 'u1' } }));
			(component as any).submitRegistration();
			const register = postSpy.mock.calls.find(c => /\/register/.test(String(c[0])))!;
			expect(register[1].affiliateIdentifier).toBe('AFF-CODE-1');
		});

		it('a marketer account still hides the referral section on a referral-link visit', () => {
			const { fixture, component, getSpy } = setup({ ref: true });
			getSpy.mockReturnValue(of(LOCKED));
			component.selectedAccountType = 'marketing_broker';
			component.currentStep = 2;
			fixture.detectChanges();
			expect(fixture.debugElement.query(By.css('#affiliate-locked-display'))).toBeNull();
			expect(fixture.debugElement.query(By.directive(AffiliatePicker))).toBeNull();
		});
	});
});
