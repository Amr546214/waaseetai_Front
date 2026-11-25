import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { clientSetupGuard } from './profile-setup.guard';
import { CLIENT_EDIT_PAGE, resolveClientSetup } from './profile-setup-state';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

const FULL = { idNumber: '2000000001', dob: '1990-01-01T00:00:00.000Z', country: 'السعودية', city: 'الرياض', industry: 'مهندس', address: 'شارع 1', paypalPayoutEmail: 'p@x.co', accurateAgreed: true, termsAgreed: true, privacyAgreed: true };

describe('client setup wizard: where it opens (resolveClientSetup)', () => {
	it('100% -> redirect (the wizard is not shown)', () => {
		expect(resolveClientSetup({ ...FULL, completionPercentage: 100 })).toEqual({ kind: 'redirect', reason: 'complete' });
		expect(resolveClientSetup({ completionPercentage: 100 })).toEqual({ kind: 'redirect', reason: 'complete' });
	});
	it('nothing saved -> step 1; no data at all -> step 1', () => {
		expect(resolveClientSetup({ completionPercentage: 0 })).toEqual({ kind: 'step', step: 1 });
		expect(resolveClientSetup(null)).toEqual({ kind: 'step', step: 1 });
	});
	it('details saved, agreements missing -> step 2 (the identity page with the review and the send); PayPal and documents are not part of the path', () => {
		expect(resolveClientSetup({ ...FULL, paypalPayoutEmail: '', accurateAgreed: false, completionPercentage: 60 })).toEqual({ kind: 'step', step: 2 });
		expect(resolveClientSetup({ ...FULL, accurateAgreed: false, notes: 'ملاحظة', completionPercentage: 70 })).toEqual({ kind: 'step', step: 2 });
	});
	it('only the document number, birth date and country decide step 1: a missing city / occupation / address never sends the person back', () => {
		expect(resolveClientSetup({ ...FULL, address: '  ', city: '', industry: '', completionPercentage: 70 })).toEqual({ kind: 'redirect', reason: 'nothing-to-collect' });
		expect(resolveClientSetup({ ...FULL, country: '', completionPercentage: 70 })).toEqual({ kind: 'step', step: 1 });
	});
	it('everything the wizard collects is saved but the profile is < 100 (avatar / bio live elsewhere) -> redirect to the edit page', () => {
		expect(resolveClientSetup({ ...FULL, completionPercentage: 70 })).toEqual({ kind: 'redirect', reason: 'nothing-to-collect' });
	});
	it('documents under review (kycStatus PENDING) never move the start step', () => {
		expect(resolveClientSetup({ ...FULL, accurateAgreed: false, kycStatus: 'PENDING', completionPercentage: 60 })).toEqual({ kind: 'step', step: 2 });
		expect(resolveClientSetup({ ...FULL, kycStatus: 'PENDING', completionPercentage: 70 })).toEqual({ kind: 'redirect', reason: 'nothing-to-collect' });
	});
});

describe('client setup route guard', () => {
	function run(opts: { accountType?: string; res: any }) {
		const getSetup = vi.fn(() => opts.res);
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: opts.accountType ?? 'CLIENT_INDIVIDUAL' }) } },
				{ provide: ProfileApiService, useValue: { getClientProfileSetup: getSetup } },
			],
		});
		const out = TestBed.runInInjectionContext(() => clientSetupGuard({} as any, {} as any));
		return { getSetup, result: isObservable(out) ? firstValueFrom(out as any) : Promise.resolve(out), notify: TestBed.inject(UiNotificationService), router: TestBed.inject(Router) };
	}
	afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });

	it('opening /profile-setup by hand at 100% redirects to the edit page with a light message', async () => {
		const { result, notify, router } = run({ res: of({ data: { ...FULL, completionPercentage: 100 } }) });
		const r = await result;
		expect(r).toBeInstanceOf(UrlTree);
		expect(router.serializeUrl(r as UrlTree)).toBe(CLIENT_EDIT_PAGE);
		expect(notify.toasts().some(t => t.message.includes('100%'))).toBe(true);
	});
	it('an incomplete client may open the wizard', async () => {
		const { result } = run({ res: of({ data: { ...FULL, accurateAgreed: false, completionPercentage: 60 } }) });
		expect(await result).toBe(true);
	});
	it('companies are never touched (no request, wizard route unchanged)', async () => {
		const { result, getSetup } = run({ accountType: 'CLIENT_COMPANY', res: of({ data: { completionPercentage: 100 } }) });
		expect(await result).toBe(true);
		expect(getSetup).not.toHaveBeenCalled();
	});
	it('a failed read never blocks the page', async () => {
		const { result } = run({ res: throwError(() => new HttpErrorResponse({ status: 500 })) });
		expect(await result).toBe(true);
	});
});

describe('client setup wizard component: resume from saved data', () => {
	function mount(data: any, extra: Partial<{ navigateByUrl: any }> = {}) {
		const navigateByUrl = vi.fn();
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [
				provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }), token: () => 't', authenticate: vi.fn() } },
				{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data }), saveClientProfileSetup: vi.fn(() => of({ success: true })), saveClientSetupStep: vi.fn(() => of({ success: true, data: {} })) } },
			],
		});
		const router = TestBed.inject(Router);
		vi.spyOn(router, 'navigateByUrl').mockImplementation(extra.navigateByUrl ?? navigateByUrl);
		const f = TestBed.createComponent(ProfileSetupDashboard);
		f.detectChanges();
		return { f, c: f.componentInstance, navigateByUrl: (extra.navigateByUrl ?? navigateByUrl) as ReturnType<typeof vi.fn>, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });

	it('saved details, agreements missing: opens on step 2 with the saved details prefilled (not step 1)', () => {
		const { c } = mount({ ...FULL, accurateAgreed: false, completionPercentage: 60 });
		expect(c.currentStep()).toBe(2);
		expect(c.setupForm.get('details')!.value).toEqual(expect.objectContaining({ idNumber: '2000000001', country: 'السعودية', city: 'الرياض', occupation: 'مهندس', address: 'شارع 1' }));
		expect(c.setupForm.get('details')!.value.dob).toBe('1990-01-01');
	});

	it('a fresh instance (refresh / back) opens at the same place with the same prefill', () => {
		const data = { ...FULL, accurateAgreed: false, completionPercentage: 60 };
		const first = mount(data); expect(first.c.currentStep()).toBe(2);
		TestBed.resetTestingModule();
		const again = mount(data);
		expect(again.c.currentStep()).toBe(2);
		expect(again.c.setupForm.get('details.idNumber')!.value).toBe('2000000001');
	});

	it('nothing saved: step 1 (really missing)', () => {
		expect(mount({ completionPercentage: 0 }).c.currentStep()).toBe(1);
	});

	it('already accepted agreements stay accepted; only the agreements missing -> step 2', () => {
		const { c } = mount({ ...FULL, accurateAgreed: false, termsAgreed: true, privacyAgreed: true, completionPercentage: 80 });
		expect(c.currentStep()).toBe(2);
		expect(c.setupForm.get('agreements')!.value).toEqual({ accurate: false, terms: true, privacy: true });
	});

	// at 100% the page asks the server whether the identity passed: passed -> edit page; not yet -> the wizard stays open on the identity step (no loop)
	function answerGate(canAdvance: boolean) {
		const http = TestBed.inject(HttpTestingController);
		http.expectOne(x => x.url.endsWith('/client/profile/setup')).flush({ data: { ...FULL, completionPercentage: 100, kycStatus: canAdvance ? 'VERIFIED' : 'PENDING' } });
		http.expectOne(x => x.url.endsWith('/client/profile/setup/identity')).flush({ data: { canAdvance } });
	}
	it('100% and the identity passed: redirects to the edit page with a message, no wizard', () => {
		const { navigateByUrl } = mount({ ...FULL, completionPercentage: 100 });
		answerGate(true);
		expect(navigateByUrl).toHaveBeenCalledWith(CLIENT_EDIT_PAGE);
		expect(TestBed.inject(UiNotificationService).toasts().some(t => t.message.includes('100%'))).toBe(true);
	});
	it('100% but the identity did not pass yet: goes to the waiting page, not the edit page', () => {
		const { navigateByUrl } = mount({ ...FULL, completionPercentage: 100 });
		answerGate(false);
		expect(navigateByUrl).toHaveBeenCalledWith('/client-overview/review-wait');
		expect(navigateByUrl).not.toHaveBeenCalledWith(CLIENT_EDIT_PAGE);
	});

	it('identity documents under review are shown as pending (not as an empty step) and are not re-required', () => {
		const { c, f, el } = mount({ ...FULL, paypalPayoutEmail: null, kycStatus: 'PENDING', frontIdUrl: 'https://res.cloudinary.com/x/front.png', completionPercentage: 60 });
		expect(c.kycPending()).toBe(true);
		c.currentStep.set(2); f.detectChanges();
		expect(el.querySelector('[data-testid="kyc-pending-note"]')?.textContent).toContain('قيد المراجعة');
		expect(c.setupForm.get('identity')!.valid).toBe(true);
		expect(c.setupForm.get('identity.frontId')!.value).toBe('https://res.cloudinary.com/x/front.png');
	});

	it('REJECTED identity review: opens the documents step (even at 100%) with the admin reason, never as "missing"', () => {
		const { c, f, el } = mount({ ...FULL, kycStatus: 'REJECTED', kycRejectionReason: 'الصورة غير واضحة', completionPercentage: 100 });
		expect(c.currentStep()).toBe(2);
		expect(c.kycPending()).toBe(false);
		f.detectChanges();
		const note = el.querySelector('[data-testid="kyc-rejected-note"]')!;
		expect(note.textContent).toContain('الصورة غير واضحة');
		expect(el.querySelector('[data-testid="kyc-pending-note"]')).toBeNull();
	});

	it('REJECTED without a stored reason still says it was rejected; the resolver opens step 2 first', () => {
		expect(resolveClientSetup({ ...FULL, kycStatus: 'REJECTED', completionPercentage: 70 })).toEqual({ kind: 'step', step: 2 });
		const { c, f, el } = mount({ ...FULL, kycStatus: 'REJECTED', completionPercentage: 70 });
		f.detectChanges();
		expect(c.kycRejectedReason()).toContain('لم تستوفِ');
		expect(el.querySelector('[data-testid="kyc-rejected-note"]')).toBeTruthy();
	});

	it('VERIFIED / PENDING never show a rejection', () => {
		for (const kycStatus of ['VERIFIED', 'PENDING']) {
			const { c } = mount({ ...FULL, paypalPayoutEmail: null, kycStatus, kycRejectionReason: 'قديم', completionPercentage: 60 });
			expect(c.kycRejectedReason()).toBeNull();
			TestBed.resetTestingModule();
		}
	});
});
