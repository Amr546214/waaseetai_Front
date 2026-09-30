import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { guestGuard } from './auth.guards';
import { AuthStore } from '../store/auth.store';
import { AccountType, UserRole } from '../models/auth.model';

// Regression coverage for the confirmed cross-role bug: an authenticated
// user of ANY role landing on a guest-only auth route (e.g. a stale
// "Change Password" link pointing at /auth/forget-password) used to be
// force-redirected to a hard-coded '/client-overview', even when they were
// a Provider, Marketer, or Admin. guestGuard must now send them to their
// own actual dashboard via the shared getDefaultDashboard() helper —
// never a second hard-coded route, and never `true` (which would weaken
// the guard's guest-only protection for these routes).
describe('guestGuard — role-aware redirect for already-authenticated users', () => {
	function setup(user: { accountType?: AccountType; activeRole?: UserRole } | null, platform = 'browser') {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{ provide: PLATFORM_ID, useValue: platform },
				{
					provide: AuthStore,
					useValue: {
						isInitialized$: new BehaviorSubject(true),
						isAuthenticated: signal(!!user),
						currentUser: signal(user),
					},
				},
			],
		});
	}

	function run() {
		const result = TestBed.runInInjectionContext(() => guestGuard({} as any, {} as RouterStateSnapshot));
		return firstValueFrom(result as Observable<boolean | UrlTree>);
	}

	async function resolvedUrl(): Promise<string> {
		const result = await run();
		expect(result instanceof UrlTree).toBe(true);
		return TestBed.inject(Router).serializeUrl(result as UrlTree);
	}

	it('lets an unauthenticated visitor through (real guest-only protection preserved)', async () => {
		setup(null);
		expect(await run()).toBe(true);
	});

	it('CLIENT: redirects to /client-overview, not a second hard-coded route by accident', async () => {
		setup({ accountType: AccountType.CLIENT_INDIVIDUAL, activeRole: UserRole.CLIENT });
		expect(await resolvedUrl()).toBe('/client-overview');
	});

	it('PROVIDER: redirects to /provider-overview — previously this was wrongly hard-coded to /client-overview', async () => {
		setup({ accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole: UserRole.PROVIDER });
		expect(await resolvedUrl()).toBe('/provider-overview');
	});

	it('PROVIDER_COMPANY: also redirects to /provider-overview', async () => {
		setup({ accountType: AccountType.PROVIDER_COMPANY, activeRole: UserRole.PROVIDER });
		expect(await resolvedUrl()).toBe('/provider-overview');
	});

	it('MARKETER (AFFILIATE): redirects to /marketer-overview — previously wrongly hard-coded to /client-overview', async () => {
		setup({ accountType: AccountType.MARKETING_BROKER, activeRole: UserRole.AFFILIATE });
		expect(await resolvedUrl()).toBe('/marketer-overview');
	});

	it('SUPER_ADMIN: redirects to /supper-admin-overview, not /client-overview', async () => {
		setup({ accountType: AccountType.SUPER_ADMIN, activeRole: UserRole.SUPER_ADMIN });
		expect(await resolvedUrl()).toBe('/supper-admin-overview');
	});

	it('SUPER_ADMIN identified only via accountType (no activeRole set) still redirects correctly', async () => {
		setup({ accountType: AccountType.SUPER_ADMIN });
		expect(await resolvedUrl()).toBe('/supper-admin-overview');
	});

	it('an authenticated user with no resolvable role/accountType falls back to the shared default (client-overview), never `true`', async () => {
		setup({});
		const result = await run();
		expect(result).not.toBe(true);
		expect(result instanceof UrlTree).toBe(true);
		expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/client-overview');
	});
});
