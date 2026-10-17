import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { providerProfileCompleteGuard } from './profile-complete.guard';
import { AuthStore } from '../store/auth.store';
import { ProviderApiService } from '../services/provider-api.service';
import { ProviderAccessService } from '../services/provider-access.service';

@Component({ standalone: true, template: '' }) class Blank {}

const WIZARD = '/provider-overview/profile/setup';
const STATUS = '/provider-overview/account-actions';
const AREAS = ['', '/business-models/center', '/business-models/new-project', '/services', '/projects/active', '/offers', '/finance/wallet', '/marketing/center'];

describe('provider area: client-side navigation goes through the guard too', () => {
	function setup(state: string, can = false) {
		const load = vi.fn(() => of({ state, canAccessDashboard: can, message: '', reason: null, hasSample: false, specialties: [] }));
		TestBed.configureTestingModule({
			providers: [
				provideRouter([{
					path: 'provider-overview', canActivateChild: [providerProfileCompleteGuard], runGuardsAndResolvers: 'always',
					children: [
						{ path: '', component: Blank }, { path: 'account-actions', component: Blank }, { path: 'profile/setup', component: Blank },
						{ path: 'business-models/center', component: Blank }, { path: 'business-models/new-project', component: Blank }, { path: 'services', component: Blank },
						{ path: 'projects/active', component: Blank }, { path: 'offers', component: Blank }, { path: 'finance/wallet', component: Blank }, { path: 'marketing/center', component: Blank },
					],
				}]),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: AuthStore, useValue: { isInitialized$: new BehaviorSubject(true), currentUser: signal({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
				{ provide: ProviderAccessService, useValue: { load } },
				{ provide: ProviderApiService, useValue: { getOverviewStats: () => of({}) } },
			],
		});
		return { load, router: TestBed.inject(Router) };
	}
	afterEach(() => TestBed.resetTestingModule());

	const table: Array<[string, string]> = [['SETUP_INCOMPLETE', WIZARD], ['ASSESSMENT_REQUIRED', WIZARD], ['SAMPLE_REQUIRED', STATUS], ['PENDING_REVIEW', STATUS], ['REJECTED', STATUS]];
	for (const [state, target] of table) {
		it(`${state}: direct URL and in-app navigation to every gated area end on ${target}`, async () => {
			const { router } = setup(state);
			await router.navigateByUrl(target); // the shell the user is already on
			for (const a of AREAS) {
				await router.navigateByUrl('/provider-overview' + a);
				expect(router.url, a || 'home').toBe(target);
			}
		});
	}
	it('APPROVED: every area opens, and each navigation re-reads the state', async () => {
		const { router, load } = setup('APPROVED', true);
		for (const a of AREAS) {
			await router.navigateByUrl('/provider-overview' + a);
			expect(router.url).toBe('/provider-overview' + a);
		}
		expect(load).toHaveBeenCalledTimes(AREAS.length);
	});
});
