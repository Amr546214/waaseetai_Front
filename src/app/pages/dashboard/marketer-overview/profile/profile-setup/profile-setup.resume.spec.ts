import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetup } from './profile-setup';
import { marketerSetupGuard } from './profile-setup.guard';
import { MARKETER_EDIT_PAGE, resolveMarketerSetup } from './marketer-setup-state';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

const item = (key: string, status: 'missing' | 'pending_review' = 'missing') => ({ key, status, label: key, points: 20, tab: 'profile', hint: '' });
const profile = (over: any = {}) => ({ id: 'a1', user: {}, marketingChannels: [], completionPercentage: 40, missingItems: [], bio: '', iban: '', bankStatus: 'none', ...over });

describe('marketer setup wizard: where it opens (resolveMarketerSetup)', () => {
	it('100% -> redirect, no wizard', () => {
		expect(resolveMarketerSetup({ completionPercentage: 100, missingItems: [] })).toEqual({ kind: 'redirect', reason: 'complete' });
	});
	it('bio missing -> step 2; bio saved but no channel -> step 3; only the bank missing -> step 4 (never always step 1)', () => {
		expect(resolveMarketerSetup({ completionPercentage: 20, missingItems: [item('bio'), item('channel'), item('iban')] })).toEqual({ kind: 'step', step: 2 });
		expect(resolveMarketerSetup({ completionPercentage: 40, missingItems: [item('channel'), item('iban')] })).toEqual({ kind: 'step', step: 3 });
		expect(resolveMarketerSetup({ completionPercentage: 70, missingItems: [item('iban')] })).toEqual({ kind: 'step', step: 4 });
	});
	it('a bank request under review (pending_review) is NOT missing and does not send the user back to the bank step', () => {
		expect(resolveMarketerSetup({ completionPercentage: 70, missingItems: [item('iban', 'pending_review')] })).toEqual({ kind: 'redirect', reason: 'nothing-to-collect' });
		expect(resolveMarketerSetup({ completionPercentage: 40, missingItems: [item('channel'), item('iban', 'pending_review')] })).toEqual({ kind: 'step', step: 3 });
	});
	it('only the avatar left (edit page item) -> redirect to the edit page', () => {
		expect(resolveMarketerSetup({ completionPercentage: 80, missingItems: [item('avatar')] })).toEqual({ kind: 'redirect', reason: 'nothing-to-collect' });
	});
	it('an answer without a missing-items report falls back to the first form step', () => {
		expect(resolveMarketerSetup({ completionPercentage: 10 })).toEqual({ kind: 'step', step: 2 });
		expect(resolveMarketerSetup(null)).toEqual({ kind: 'step', step: 2 });
	});
});

describe('marketer setup route guard', () => {
	function run(res: any) {
		const getProfile = vi.fn(() => res);
		TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: MarketerProfileService, useValue: { getProfile } }] });
		const out = TestBed.runInInjectionContext(() => marketerSetupGuard({} as any, {} as any));
		return { result: isObservable(out) ? firstValueFrom(out as any) : Promise.resolve(out), notify: TestBed.inject(UiNotificationService), router: TestBed.inject(Router) };
	}
	afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });

	it('at 100% opening /profile-setup by hand redirects to the profile page with a light message', async () => {
		const { result, notify, router } = run(of({ success: true, data: profile({ completionPercentage: 100 }) }));
		const r = await result;
		expect(r).toBeInstanceOf(UrlTree);
		expect(router.serializeUrl(r as UrlTree)).toBe(MARKETER_EDIT_PAGE);
		expect(notify.toasts().length).toBe(1);
	});
	it('an incomplete marketer may open the wizard', async () => {
		expect(await run(of({ success: true, data: profile({ missingItems: [item('channel')] }) })).result).toBe(true);
	});
	it('a failed / unsuccessful read never blocks', async () => {
		expect(await run(throwError(() => new HttpErrorResponse({ status: 500 }))).result).toBe(true);
		TestBed.resetTestingModule();
		expect(await run(of({ success: false })).result).toBe(true);
	});
});

describe('marketer setup wizard component: resume from saved data', () => {
	function mount(data: any) {
		const navigateByUrl = vi.fn();
		const getProfile = vi.fn(() => of({ success: true, data }));
		TestBed.configureTestingModule({
			imports: [ProfileSetup],
			providers: [provideRouter([]), { provide: MarketerProfileService, useValue: { getProfile, updateMarketingInfo: vi.fn(() => of({ success: true })), addChannel: vi.fn(() => of({ success: true })), updateBankInfo: vi.fn(() => of({ success: true })) } }],
		});
		vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(navigateByUrl);
		const f = TestBed.createComponent(ProfileSetup);
		f.detectChanges();
		return { f, c: f.componentInstance, navigateByUrl, getProfile };
	}
	afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });

	const BIO = 'وصف تسويقي طويل يتجاوز الخمسين حرفًا ليكون مقبولًا في الاكتمال';

	it('bio saved, channel missing: opens on step 3 with the saved bio prefilled', () => {
		const { c } = mount(profile({ bio: BIO, missingItems: [item('channel'), item('iban')], completionPercentage: 40 }));
		expect(c.currentStep()).toBe(3);
		expect(c.marketingForm.value.bio).toBe(BIO);
	});
	it('only the bank missing: opens on step 4; a refresh (new instance) opens on the same step', () => {
		const data = profile({ bio: BIO, marketingChannels: [{ id: 'c1' }], missingItems: [item('iban')], completionPercentage: 70 });
		expect(mount(data).c.currentStep()).toBe(4);
		TestBed.resetTestingModule();
		expect(mount(data).c.currentStep()).toBe(4);
	});
	it('a bank request under review: shown as "قيد المراجعة", no bank step, redirected to the profile page', () => {
		const { c, navigateByUrl } = mount(profile({ bio: BIO, marketingChannels: [{ id: 'c1' }], bankStatus: 'pending_review', missingItems: [item('iban', 'pending_review')], completionPercentage: 70 }));
		expect(c.bankReviewState()).toBe('قيد المراجعة');
		expect(navigateByUrl).toHaveBeenCalledWith(MARKETER_EDIT_PAGE);
	});
	it('100%: redirects to the profile page with a message, no wizard', () => {
		const { navigateByUrl } = mount(profile({ completionPercentage: 100 }));
		expect(navigateByUrl).toHaveBeenCalledWith(MARKETER_EDIT_PAGE);
		expect(TestBed.inject(UiNotificationService).toasts().length).toBe(1);
	});
	it('re-reading the profile after a saved step never moves the user back (only the first read decides the step)', () => {
		const { c } = mount(profile({ missingItems: [item('bio'), item('channel'), item('iban')], completionPercentage: 0 }));
		expect(c.currentStep()).toBe(2);
		c.setStep(4);
		c.loadProfile();                      // what saveBio/addChannel do after each save
		expect(c.currentStep()).toBe(4);
	});
});
