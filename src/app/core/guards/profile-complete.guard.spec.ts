import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { isOnboardingAllowedPath, providerProfileCompleteGuard } from './profile-complete.guard';
import { AuthStore } from '../store/auth.store';
import { ProviderApiService } from '../services/provider-api.service';
import { ProviderAccessService, ProviderAccessState } from '../services/provider-access.service';

const STATUS = '/provider-overview/accreditation-status';
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

	for (const s of ['SETUP_INCOMPLETE', 'SAMPLE_REQUIRED', 'PENDING_REVIEW', 'REJECTED'] as const) {
		it(`individual + ${s}: dashboard home and offers go to the status page`, async () => {
			setup('PROVIDER_INDIVIDUAL', () => of(st(s)));
			expect(await run('/provider-overview', { allowIncompleteProfile: true })).toBe(STATUS);
			expect(await run('/provider-overview/offers')).toBe(STATUS);
			expect(await run('/provider-overview/finance/wallet')).toBe(STATUS);
		});
	}

	it('individual + not approved: onboarding routes stay open', async () => {
		const { loadSpy } = setup('PROVIDER_INDIVIDUAL', () => of(st('PENDING_REVIEW')));
		for (const u of ['accreditation-status', 'profile/setup', 'profile/data', 'business-models/accreditation/new', 'business-models/accreditation/list', 'help', 'help/tickets/new', 'notifications', 'settings/account']) {
			expect(await run('/provider-overview/' + u)).toBe(true);
		}
		expect(loadSpy).not.toHaveBeenCalled();
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

	it('allow-list matching ignores query/hash and does not match look-alike prefixes', () => {
		expect(isOnboardingAllowedPath('/provider-overview/help/tickets?x=1')).toBe(true);
		expect(isOnboardingAllowedPath('/provider-overview/helpful')).toBe(false);
		expect(isOnboardingAllowedPath('/provider-overview')).toBe(false);
		expect(isOnboardingAllowedPath('/provider-overview/business-models/market')).toBe(false);
	});
});
