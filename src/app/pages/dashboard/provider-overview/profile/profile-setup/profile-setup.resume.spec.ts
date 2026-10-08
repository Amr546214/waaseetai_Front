import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { providerSetupGuard } from './profile-setup.guard';
import { PROVIDER_EDIT_PAGE, resolveProviderSetup } from './provider-setup-state';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService } from '../../../../../core/services/setup-test.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

const SAVED = {
	headline: 'مطور واجهات', yearsOfExperience: 4, country: 'السعودية', city: 'الرياض', bio: 'خبرة طويلة في تطوير الواجهات الحديثة',
	mainSpecialty: 'برمجة', subSpecialties: ['React'], paypalPayoutEmail: 'p@x.co', frontIdUrlAccess: { private: true },
	portfolioItems: [{ title: 'نموذج أعمال - React', description: 'https://res.cloudinary.com/x/sample.pdf' }],
	isProfileSetupComplete: false, setupTestStatus: 'PENDING',
};

describe('provider setup wizard: where it opens (resolveProviderSetup)', () => {
	it('everything done (form submitted + test completed) -> redirect, the wizard is not shown', () => {
		expect(resolveProviderSetup({ ...SAVED, isProfileSetupComplete: true, setupTestStatus: 'COMPLETED' })).toEqual({ kind: 'redirect', reason: 'complete' });
	});
	it('form submitted but the test is not done -> step 7 (never step 1)', () => {
		expect(resolveProviderSetup({ ...SAVED, isProfileSetupComplete: true })).toEqual({ kind: 'step', step: 7 });
		expect(resolveProviderSetup({ ...SAVED, isProfileSetupComplete: true, setupTestStatus: 'PENDING' })).toEqual({ kind: 'step', step: 7 });
	});
	it('nothing saved -> step 1', () => {
		expect(resolveProviderSetup({})).toEqual({ kind: 'step', step: 1 });
		expect(resolveProviderSetup(null)).toEqual({ kind: 'step', step: 1 });
	});
	it('first really-missing step: 1 details -> 2 specialties -> 3 PayPal -> 4 ID -> 5 portfolio -> 6 review', () => {
		expect(resolveProviderSetup({ ...SAVED, bio: '' })).toEqual({ kind: 'step', step: 1 });
		expect(resolveProviderSetup({ ...SAVED, subSpecialties: [] })).toEqual({ kind: 'step', step: 2 });
		expect(resolveProviderSetup({ ...SAVED, paypalPayoutEmail: '' })).toEqual({ kind: 'step', step: 3 });
		expect(resolveProviderSetup({ ...SAVED, frontIdUrlAccess: null, frontIdUrl: null })).toEqual({ kind: 'step', step: 4 });
		expect(resolveProviderSetup({ ...SAVED, portfolioItems: [] })).toEqual({ kind: 'step', step: 5 });
		expect(resolveProviderSetup({ ...SAVED })).toEqual({ kind: 'step', step: 6 });
	});
	it('details saved but PayPal missing -> step 3, NOT step 1', () => {
		expect(resolveProviderSetup({ ...SAVED, paypalPayoutEmail: null })).toEqual({ kind: 'step', step: 3 });
	});
	it('an ID document under review (private marker / PENDING) is not a missing step', () => {
		expect(resolveProviderSetup({ ...SAVED, kycStatus: 'PENDING', frontIdUrlAccess: { private: true }, portfolioItems: [] })).toEqual({ kind: 'step', step: 5 });
		expect(resolveProviderSetup({ ...SAVED, kycStatus: 'PENDING', frontIdUrl: 'https://res.cloudinary.com/x/id.png', frontIdUrlAccess: null })).toEqual({ kind: 'step', step: 6 });
	});
});

describe('provider setup route guard', () => {
	function run(opts: { accountType?: string; res: any }) {
		const getSetup = vi.fn(() => opts.res);
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: opts.accountType ?? 'PROVIDER_INDIVIDUAL' }) } },
				{ provide: ProfileApiService, useValue: { getProviderProfileSetup: getSetup } },
			],
		});
		const out = TestBed.runInInjectionContext(() => providerSetupGuard({} as any, {} as any));
		return { getSetup, result: isObservable(out) ? firstValueFrom(out as any) : Promise.resolve(out), notify: TestBed.inject(UiNotificationService), router: TestBed.inject(Router) };
	}
	afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });

	it('everything done: opening /profile/setup by hand redirects to the profile edit page with a light message', async () => {
		const { result, notify, router } = run({ res: of({ data: { ...SAVED, isProfileSetupComplete: true, setupTestStatus: 'COMPLETED' } }) });
		const r = await result;
		expect(r).toBeInstanceOf(UrlTree);
		expect(router.serializeUrl(r as UrlTree)).toBe(PROVIDER_EDIT_PAGE);
		expect(notify.toasts().length).toBe(1);
	});
	it('a provider who still has the test (or any step) to do may open the wizard', async () => {
		expect(await run({ res: of({ data: { ...SAVED, isProfileSetupComplete: true } }) }).result).toBe(true);
		TestBed.resetTestingModule();
		expect(await run({ res: of({ data: { ...SAVED, paypalPayoutEmail: '' } }) }).result).toBe(true);
	});
	it('companies are never touched (no request)', async () => {
		const { result, getSetup } = run({ accountType: 'PROVIDER_COMPANY', res: of({ data: { isProfileSetupComplete: true, setupTestStatus: 'COMPLETED' } }) });
		expect(await result).toBe(true);
		expect(getSetup).not.toHaveBeenCalled();
	});
	it('a failed read never blocks', async () => {
		expect(await run({ res: throwError(() => new HttpErrorResponse({ status: 500 })) }).result).toBe(true);
	});
});

describe('provider setup wizard component: resume from saved data', () => {
	function mount(data: any) {
		const navigateByUrl = vi.fn();
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [
				provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
				{ provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data }), saveProviderProfileSetup: vi.fn(() => of({ success: true })) } },
				{ provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: [] }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
				{ provide: SetupTestService, useValue: { warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), disconnect: vi.fn(), startTest: vi.fn() } },
			],
		});
		vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(navigateByUrl);
		const f = TestBed.createComponent(ProfileSetupDashboard);
		f.detectChanges();
		return { f, c: f.componentInstance, navigateByUrl, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });

	it('saved details but no PayPal: opens on step 3 with the saved values prefilled (not step 1)', () => {
		const { c } = mount({ ...SAVED, paypalPayoutEmail: null });
		expect(c.currentStep()).toBe(3);
		expect(c.setupForm.get('profData')!.value).toEqual(expect.objectContaining({ jobTitle: 'مطور واجهات', country: 'السعودية', city: 'الرياض' }));
		expect(c.setupForm.get('specialties.mainSpec')!.value).toBe('برمجة');
	});
	it('a fresh instance (refresh / back) opens at the same step with the same prefill', () => {
		const data = { ...SAVED, paypalPayoutEmail: null };
		expect(mount(data).c.currentStep()).toBe(3);
		TestBed.resetTestingModule();
		const again = mount(data);
		expect(again.c.currentStep()).toBe(3);
		expect(again.c.setupForm.get('profData.jobTitle')!.value).toBe('مطور واجهات');
	});
	it('form submitted, test pending: opens on step 7', () => {
		expect(mount({ ...SAVED, isProfileSetupComplete: true }).c.currentStep()).toBe(7);
	});
	it('nothing saved: step 1', () => {
		expect(mount({}).c.currentStep()).toBe(1);
	});
	it('everything done: redirects to the edit page with a message, no wizard', () => {
		const { navigateByUrl } = mount({ ...SAVED, isProfileSetupComplete: true, setupTestStatus: 'COMPLETED' });
		expect(navigateByUrl).toHaveBeenCalledWith(PROVIDER_EDIT_PAGE);
		expect(TestBed.inject(UiNotificationService).toasts().length).toBe(1);
	});
	it('ID documents under review are shown as pending, the document step is not required again', () => {
		const { c, el } = mount({ ...SAVED, kycStatus: 'PENDING', portfolioItems: [] });
		expect(c.kycPending()).toBe(true);
		expect(c.currentStep()).toBe(5);
		expect(el.querySelector('[data-testid="kyc-pending-note"]')?.textContent).toContain('قيد المراجعة');
		expect(el.querySelector('[data-testid="kyc-pending-note"]')?.textContent).toContain('لا حاجة لإعادة إرسالها');
	});
});
