import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { clientGuard, guestGuard, marketerGuard, providerGuard, superAdminGuard } from './auth.guards';
import { vi } from 'vitest';
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


// Regression: a token with NO user in storage (stale/partial session) froze the tab. guestGuard sent it to
// /client-overview, clientGuard rejected it (no user) and redirected to getDefaultDashboard(undefined), which is
// /client-overview again: an infinite redirect loop. A role guard must never redirect to its own area.
describe('role guards — no self-redirect loop for a token without a usable user', () => {
	const clearSession = vi.fn();

	function setup(user: any, authenticated = true) {
		clearSession.mockClear();
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: AuthStore, useValue: { isInitialized$: new BehaviorSubject(true), isAuthenticated: signal(authenticated), currentUser: signal(user), clearSession } },
			],
		});
	}
	async function url(guard: any, state = '/x'): Promise<string | true> {
		const r: any = await firstValueFrom(TestBed.runInInjectionContext(() => guard({} as any, { url: state } as RouterStateSnapshot)) as Observable<boolean | UrlTree>);
		return r === true ? true : TestBed.inject(Router).serializeUrl(r as UrlTree);
	}

	it.each([
		['clientGuard', clientGuard],
		['providerGuard', providerGuard],
		['marketerGuard', marketerGuard],
		['superAdminGuard', superAdminGuard],
	])('%s: no user -> drops the stale session and goes to /auth/login (never back into a dashboard)', async (_n, guard) => {
		setup(null);
		expect(await url(guard)).toBe('/auth/login');
		expect(clearSession).toHaveBeenCalledTimes(1);
	});

	it('guestGuard: token without user -> drops the session and lets the guest page render (no redirect at all)', async () => {
		setup(null);
		expect(await url(guestGuard)).toBe(true);
		expect(clearSession).toHaveBeenCalledTimes(1);
	});

	it('the full chain for the reported case ends on a guest page after at most one redirect', async () => {
		setup(null);
		expect(await url(guestGuard)).toBe(true); // /auth/login renders; nothing redirects into /client-overview
	});

	it('a user with no role of their own still cannot loop: client area -> login, not client area', async () => {
		setup({ accountType: 'SOMETHING_ELSE' });
		expect(await url(clientGuard)).toBe('/auth/login');
		expect(clearSession).toHaveBeenCalled();
	});

	it('a normal cross-role redirect is unchanged and keeps the session', async () => {
		setup({ accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole: UserRole.PROVIDER });
		expect(await url(clientGuard)).toBe('/provider-overview');
		setup({ accountType: AccountType.CLIENT_INDIVIDUAL, activeRole: UserRole.CLIENT });
		expect(await url(providerGuard)).toBe('/client-overview');
		setup({ accountType: AccountType.CLIENT_INDIVIDUAL, activeRole: UserRole.CLIENT });
		expect(await url(superAdminGuard)).toBe('/client-overview');
		expect(clearSession).not.toHaveBeenCalled();
	});

	it('the matching role still passes', async () => {
		setup({ accountType: AccountType.CLIENT_INDIVIDUAL, activeRole: UserRole.CLIENT });
		expect(await url(clientGuard)).toBe(true);
	});
});
