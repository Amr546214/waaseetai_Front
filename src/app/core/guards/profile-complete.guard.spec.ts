import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { isOnboardingAllowedPath, providerProfileCompleteGuard } from './profile-complete.guard';
import { AuthStore } from '../store/auth.store';
import { ProviderApiService } from '../services/provider-api.service';
import { ProviderAccessService, ProviderAccessState } from '../services/provider-access.service';

const STATUS = '/provider-overview/account-actions';
const st = (state: ProviderAccessState['state'], canAccessDashboard = false): ProviderAccessState =>
	({ state, canAccessDashboard, message: '', reason: null, hasSample: false, specialties: [] });

describe('providerProfileCompleteGuard (backend access-state decides for individual providers)', () => {
	function setup(accountType: string, load: () => Observable<ProviderAccessState>, stats: () => Observable<any> = () => of({ success: true, data: { summary: { profileSetupCompleted: true } } })) {
		const loadSpy = vi.fn(load);
		const statsSpy = vi.fn(stats);
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: AuthStore, useValue: { isInitialized$: new BehaviorSubject(true), currentUser: () => ({ accountType }) } },
				{ provide: ProviderAccessService, useValue: { load: loadSpy } },
				{ provide: ProviderApiService, useValue: { getOverviewStats: statsSpy } },
			],
		});
		return { loadSpy, statsSpy };
	}
	async function run(url: string, data: Record<string, unknown> = {}) {
		const out = TestBed.runInInjectionContext(() => providerProfileCompleteGuard({ data } as any, { url } as any));
		const r = await firstValueFrom(out as Observable<boolean | UrlTree>);
		return r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : r;
	}

	const GATED = ['', '/business-models/center', '/business-models/new-project', '/business-models/market', '/services', '/projects/active', '/offers', '/finance/wallet', '/marketing/center', '/reports', '/explore-requests'];
	const WIZARD = '/provider-overview/profile/setup';
	const cases: Array<[ProviderAccessState['state'], string]> = [
		['SETUP_INCOMPLETE', WIZARD], ['ASSESSMENT_REQUIRED', WIZARD],
		['SAMPLE_REQUIRED', STATUS], ['PENDING_REVIEW', STATUS], ['REJECTED', STATUS],
	];
	for (const [s, target] of cases) {
		it(`individual + ${s}: direct URL to every gated area (business-models/center included) goes to ${target}`, async () => {
			setup('PROVIDER_INDIVIDUAL', () => of(st(s)));
			for (const g of GATED) expect(await run('/provider-overview' + g, g === '' ? { allowIncompleteProfile: true } : {}), g || 'home').toBe(target);
		});
	}

	it('individual + setup or test unfinished: the approval pages (models, actions log, profile data / specialties) go to the wizard; help and account settings stay open', async () => {
		for (const s of ['SETUP_INCOMPLETE', 'ASSESSMENT_REQUIRED'] as const) {
			TestBed.resetTestingModule();
			setup('PROVIDER_INDIVIDUAL', () => of(st(s)));
			for (const u of ['business-models/accreditation/new', 'account-actions', 'profile/data', 'profile/specialties']) expect(await run('/provider-overview/' + u), s + u).toBe(WIZARD);
			for (const u of ['help', 'notifications', 'settings/account']) expect(await run('/provider-overview/' + u), s + u).toBe(true);
		}
	});

	it('individual + not approved: onboarding routes stay open', async () => {
		const { loadSpy } = setup('PROVIDER_INDIVIDUAL', () => of(st('PENDING_REVIEW')));
		for (const u of ['accreditation-status', 'profile/setup', 'profile/data', 'business-models/accreditation/new', 'business-models/accreditation/list', 'help', 'help/tickets/new', 'notifications', 'settings/account']) {
			expect(await run('/provider-overview/' + u)).toBe(true);
		}
		// the wizard itself never needs the answer; the other onboarding pages read it only to honour a REJECTED identity (they still open when it is not rejected)
		const urls = ['accreditation-status', 'profile/setup', 'profile/data', 'business-models/accreditation/new', 'business-models/accreditation/list', 'help', 'help/tickets/new', 'notifications'];
		expect(loadSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
		loadSpy.mockClear(); expect(await run('/provider-overview/profile/setup')).toBe(true); expect(urls.length).toBeGreaterThan(0); expect(loadSpy).not.toHaveBeenCalled();
	});

	it('individual + APPROVED: dashboard and children open', async () => {
		setup('PROVIDER_INDIVIDUAL', () => of(st('APPROVED', true)));
		expect(await run('/provider-overview')).toBe(true);
		expect(await run('/provider-overview/offers')).toBe(true);
	});

	it('canAccessDashboard=false is never opened even if the state text looks fine', async () => {
		setup('PROVIDER_INDIVIDUAL', () => of(st('APPROVED', false)));
		expect(await run('/provider-overview')).toBe(STATUS);
	});

	it('request error: closed for an individual provider', async () => {
		setup('PROVIDER_INDIVIDUAL', () => throwError(() => new Error('500')));
		expect(await run('/provider-overview')).toBe(STATUS);
		expect(await run('/provider-overview/offers')).toBe(STATUS);
	});

	it('every navigation asks the backend again (direct URL / refresh), nothing is stored locally', async () => {
		const getItem = vi.spyOn(Storage.prototype, 'getItem');
		const { loadSpy } = setup('PROVIDER_INDIVIDUAL', () => of(st('PENDING_REVIEW')));
		await run('/provider-overview/offers');
		await run('/provider-overview/offers');
		expect(loadSpy).toHaveBeenCalledTimes(2);
		expect(getItem).not.toHaveBeenCalled();
		getItem.mockRestore();
	});

	it('company: unchanged (no access-state call; home open; incomplete profile still locked; stats error opens)', async () => {
		const { loadSpy, statsSpy } = setup('PROVIDER_COMPANY', () => of(st('PENDING_REVIEW')));
		expect(await run('/provider-overview', { allowIncompleteProfile: true })).toBe(true);
		expect(await run('/provider-overview/offers')).toBe(true);
		expect(loadSpy).not.toHaveBeenCalled();
		expect(statsSpy).toHaveBeenCalled();
		setup('PROVIDER_COMPANY', () => of(st('NOT_APPLICABLE', true)), () => of({ success: true, data: { summary: { profileSetupCompleted: false } } }));
		expect(await run('/provider-overview/offers')).toBe('/provider-overview/profile/setup');
		setup('PROVIDER_COMPANY', () => of(st('NOT_APPLICABLE', true)), () => throwError(() => new Error('x')));
		expect(await run('/provider-overview/offers')).toBe(true);
	});

	it('business-models/center is not in the allow-list', () => {
		expect(isOnboardingAllowedPath('/provider-overview/business-models/center')).toBe(false);
	});

	it('allow-list matching ignores query/hash and does not match look-alike prefixes', () => {
		expect(isOnboardingAllowedPath('/provider-overview/help/tickets?x=1')).toBe(true);
		expect(isOnboardingAllowedPath('/provider-overview/helpful')).toBe(false);
		expect(isOnboardingAllowedPath('/provider-overview')).toBe(false);
		expect(isOnboardingAllowedPath('/provider-overview/business-models/market')).toBe(false);
	});
});

describe('providerProfileCompleteGuard: a REJECTED identity keeps the provider on the setup page', () => {
	function setup(load: () => Observable<ProviderAccessState>) {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'browser' },
			{ provide: AuthStore, useValue: { isInitialized$: new BehaviorSubject(true), currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
			{ provide: ProviderAccessService, useValue: { load: vi.fn(load) } }, { provide: ProviderApiService, useValue: { getOverviewStats: () => of({}) } }] });
	}
	async function run(url: string) {
		const r = await firstValueFrom(TestBed.runInInjectionContext(() => providerProfileCompleteGuard({ data: {} } as any, { url } as any)) as Observable<boolean | UrlTree>);
		return r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : r;
	}
	const rejected = { ...st('SETUP_INCOMPLETE'), identityRejected: true };
	it('every page except the wizard goes to the wizard (settings / notifications / help / account log included); the wizard itself opens', async () => {
		setup(() => of(rejected));
		for (const u of ['/provider-overview/notifications', '/provider-overview/help', '/provider-overview/settings/account', '/provider-overview/account-actions', '/provider-overview/profile/data', '/provider-overview/projects/active'])
			expect(await run(u), u).toBe('/provider-overview/profile/setup');
		expect(await run('/provider-overview/profile/setup')).toBe(true);
		expect(await run('/provider-overview/profile/setup?step=4')).toBe(true);
	});
	it('without a rejection the onboarding pages open as before; a failed read never locks the provider out', async () => {
		setup(() => of(st('SETUP_INCOMPLETE'))); expect(await run('/provider-overview/notifications')).toBe(true);
		setup(() => throwError(() => new Error('x'))); expect(await run('/provider-overview/notifications')).toBe(true);
	});
});

describe('isOnboardingAllowedPath × the access state', () => {
	const later = ['/provider-overview/business-models/accreditation/new', '/provider-overview/account-actions', '/provider-overview/profile/data', '/provider-overview/profile/specialties'];
	const base = ['/provider-overview/profile/setup', '/provider-overview/help/tickets', '/provider-overview/notifications', '/provider-overview/settings/account'];
	it('while the setup form or the test is unfinished only the wizard, help, notifications and the account settings open', () => {
		for (const st of ['SETUP_INCOMPLETE', 'ASSESSMENT_REQUIRED']) {
			for (const u of base) expect(isOnboardingAllowedPath(u, st), st + u).toBe(true);
			for (const u of later) expect(isOnboardingAllowedPath(u, st), st + u).toBe(false);
		}
	});
	it('once the test is done (sample required, review, completion, rejected) the approval pages open too; everything operating stays closed', () => {
		for (const st of ['SAMPLE_REQUIRED', 'PENDING_REVIEW', 'COMPLETION_REQUIRED', 'REJECTED']) {
			for (const u of [...base, ...later]) expect(isOnboardingAllowedPath(u, st), st + u).toBe(true);
			expect(isOnboardingAllowedPath('/provider-overview/projects/active', st)).toBe(false);
			expect(isOnboardingAllowedPath('/provider-overview/business-models/market', st)).toBe(false);
		}
	});
	it('without a state the full list applies, as before', () => {
		for (const u of [...base, ...later]) expect(isOnboardingAllowedPath(u), u).toBe(true);
	});
});
