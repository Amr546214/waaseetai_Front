import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes as appRoutes } from '../../app.routes';
import { authGuard, clientGuard, marketerGuard, providerGuard } from './auth.guards';
import { AuthStore } from '../store/auth.store';
import { AccountType, UserRole } from '../models/auth.model';

// K-5: a tab whose local role is stale (or was updated by an earlier mismatch) must not keep opening pages of the OTHER role's area by in-app (SPA) navigation.
@Component({ standalone: true, template: 'x' }) class Dummy {}

describe('role areas re-check the acting role on every in-app navigation (K-5)', () => {
	it('the real marketer / client / provider areas re-run their guards on every navigation under them', () => {
		for (const path of ['marketer-overview', 'client-overview', 'provider-overview']) {
			const r = appRoutes.find(x => x.path === path)!;
			expect(r.runGuardsAndResolvers, path).toBe('always');
		}
	});

	// Same shape as the real areas (parent with the role guards + `always`, children below).
	const routes: Routes = [
		{ path: 'client-overview', canActivate: [authGuard, clientGuard], runGuardsAndResolvers: 'always', component: Dummy, children: [{ path: '', component: Dummy }, { path: 'x', component: Dummy }] },
		{ path: 'marketer-overview', canActivate: [authGuard, marketerGuard], runGuardsAndResolvers: 'always', component: Dummy, children: [{ path: '', component: Dummy }, { path: 'withdraw', component: Dummy }] },
		{ path: 'provider-overview', canActivate: [authGuard, providerGuard], runGuardsAndResolvers: 'always', component: Dummy, children: [{ path: '', component: Dummy }, { path: 'finance/withdraw', component: Dummy }] },
	];
	const asUser = (store: AuthStore, role: UserRole, accountType: AccountType) =>
		store.authenticate('tok', { id: 'u1', accountType, activeRole: role, roles: [role, UserRole.CLIENT] } as any);

	beforeEach(() => { localStorage.clear(); document.cookie = 'waseet_user=; Max-Age=0; path=/'; document.cookie = 'waseet_token=; Max-Age=0; path=/'; TestBed.configureTestingModule({ providers: [provideRouter(routes)] }); });

	it('marketer area: the local role became CLIENT while the tab stayed in the area -> the next in-app click lands on the client dashboard', async () => {
		const store = TestBed.inject(AuthStore);
		asUser(store, UserRole.AFFILIATE, AccountType.MARKETING_BROKER);
		const h = await RouterTestingHarness.create();
		await h.navigateByUrl('/marketer-overview');
		expect(TestBed.inject(Router).url).toBe('/marketer-overview');
		store.updateUser({ activeRole: UserRole.CLIENT });
		await h.navigateByUrl('/marketer-overview/withdraw');
		expect(TestBed.inject(Router).url).toBe('/client-overview');
	});

	it('provider area: same, provider -> client', async () => {
		const store = TestBed.inject(AuthStore);
		asUser(store, UserRole.PROVIDER, AccountType.PROVIDER_INDIVIDUAL);
		const h = await RouterTestingHarness.create();
		await h.navigateByUrl('/provider-overview');
		store.updateUser({ activeRole: UserRole.CLIENT });
		await h.navigateByUrl('/provider-overview/finance/withdraw');
		expect(TestBed.inject(Router).url).toBe('/client-overview');
	});

	it('a genuine holder of the role keeps navigating inside its area (no redirect, no loop)', async () => {
		const store = TestBed.inject(AuthStore);
		asUser(store, UserRole.AFFILIATE, AccountType.MARKETING_BROKER);
		const h = await RouterTestingHarness.create();
		await h.navigateByUrl('/marketer-overview');
		await h.navigateByUrl('/marketer-overview/withdraw');
		expect(TestBed.inject(Router).url).toBe('/marketer-overview/withdraw');
	});

	it('client area: acting as marketer -> an in-app click inside the client area lands on the marketer dashboard', async () => {
		const store = TestBed.inject(AuthStore);
		asUser(store, UserRole.CLIENT, AccountType.CLIENT_INDIVIDUAL);
		const h = await RouterTestingHarness.create();
		await h.navigateByUrl('/client-overview');
		store.updateUser({ activeRole: UserRole.AFFILIATE });
		await h.navigateByUrl('/client-overview/x');
		expect(TestBed.inject(Router).url).toBe('/marketer-overview');
	});
});
