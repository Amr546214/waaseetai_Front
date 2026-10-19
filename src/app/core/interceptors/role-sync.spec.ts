import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from '../store/auth.store';
import { UiNotificationService } from '../services/ui-notification.service';
import { AccountType, UserRole } from '../models/auth.model';
import { redirectTargetAfterRoleChange, roleAreaOfUrl, serverRoleFromMismatch } from '../routing/role-routes';

// H1: a tab that still believes PROVIDER while the server's active role is CLIENT (switched in another tab/device).
const mismatch = (activeRole: string | null, extra: object = {}) => ({ success: false, message: 'x', code: 'ROLE_MISMATCH', requiredRoles: ['PROVIDER'], activeRole, canSwitch: true, ...extra });

describe('role-routes helpers (H1)', () => {
	it('serverRoleFromMismatch accepts ONLY a 403 ROLE_MISMATCH with a valid role', () => {
		expect(serverRoleFromMismatch(403, mismatch('CLIENT'))).toBe(UserRole.CLIENT);
		expect(serverRoleFromMismatch(403, { message: 'forbidden' })).toBeNull();
		expect(serverRoleFromMismatch(403, { code: 'OTHER', activeRole: 'CLIENT' })).toBeNull();
		expect(serverRoleFromMismatch(401, mismatch('CLIENT'))).toBeNull();
		expect(serverRoleFromMismatch(403, mismatch('HACKER'))).toBeNull();
		expect(serverRoleFromMismatch(403, mismatch(null))).toBeNull();
		expect(serverRoleFromMismatch(403, 'text')).toBeNull();
	});
	it('redirect target: only when the URL is inside ANOTHER role area', () => {
		expect(roleAreaOfUrl('/provider-overview/account-actions?x=1')).toBe(UserRole.PROVIDER);
		expect(roleAreaOfUrl('/provider-overviewX')).toBeNull();
		expect(redirectTargetAfterRoleChange('/provider-overview', UserRole.CLIENT)).toBe('/client-overview');
		expect(redirectTargetAfterRoleChange('/client-overview/x', UserRole.CLIENT)).toBeNull();
		expect(redirectTargetAfterRoleChange('/marketplace', UserRole.CLIENT)).toBeNull();
	});
});

describe('role sync — stale PROVIDER tab vs server CLIENT (H1)', () => {
	let http: HttpClient;
	let ctl: HttpTestingController;
	let store: AuthStore;
	let router: Router;
	let nav: ReturnType<typeof vi.fn>;
	const info = vi.fn();
	const user: any = { id: 'u1', accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole: UserRole.PROVIDER, roles: [UserRole.PROVIDER, UserRole.CLIENT] };

	beforeEach(() => {
		localStorage.clear();
		info.mockClear();
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				provideHttpClient(withInterceptors([authInterceptor])),
				provideHttpClientTesting(),
				{ provide: UiNotificationService, useValue: { info, showBanner: vi.fn(), error: vi.fn() } },
			],
		});
		store = TestBed.inject(AuthStore);
		store.authenticate('tok', { ...user });
		router = TestBed.inject(Router);
		nav = vi.fn().mockResolvedValue(true);
		vi.spyOn(router, 'navigateByUrl').mockImplementation(nav as any);
		vi.spyOn(router, 'url', 'get').mockReturnValue('/provider-overview/account-actions');
		http = TestBed.inject(HttpClient);
		ctl = TestBed.inject(HttpTestingController);
	});

	const fail = (url: string, body: any, status = 403) => {
		http.get(url).subscribe({ error: () => {} });
		ctl.expectOne(url).flush(body, { status, statusText: 'x' });
	};

	it('a ROLE_MISMATCH 403 adopts the server role in session + storage + menu state and leaves the provider area', () => {
		fail('/api/provider/access-state', mismatch('CLIENT'));
		expect(store.actingRole()).toBe(UserRole.CLIENT);
		expect(JSON.parse(localStorage.getItem('waseet_user')!).activeRole).toBe('CLIENT');
		expect(nav).toHaveBeenCalledWith('/client-overview');
		expect(info).toHaveBeenCalledTimes(1);
	});

	it('several parallel mismatches reconcile once (no repeated redirects / toasts)', () => {
		http.get('/api/a').subscribe({ error: () => {} });
		http.get('/api/b').subscribe({ error: () => {} });
		ctl.expectOne('/api/a').flush(mismatch('CLIENT'), { status: 403, statusText: 'x' });
		ctl.expectOne('/api/b').flush(mismatch('CLIENT'), { status: 403, statusText: 'x' });
		expect(nav).toHaveBeenCalledTimes(1);
		expect(info).toHaveBeenCalledTimes(1);
	});

	it('a mismatch whose server role equals the local role changes nothing (no loop)', () => {
		fail('/api/x', mismatch('PROVIDER'));
		expect(store.actingRole()).toBe(UserRole.PROVIDER);
		expect(nav).not.toHaveBeenCalled();
	});

	it('K-5: the local role was already adopted earlier but the tab is still in the other role area -> a mismatch still moves it (no toast, no repeat)', () => {
		store.updateUser({ activeRole: UserRole.CLIENT });
		fail('/api/provider/finance/wallet', mismatch('CLIENT'));
		expect(nav).toHaveBeenCalledWith('/client-overview');
		expect(info).not.toHaveBeenCalled();
	});

	it('a plain 403 (no such role / permissions / gate) is NOT a role mismatch: nothing is switched', () => {
		fail('/api/y', { success: false, message: 'ليس لديك صلاحية' });
		fail('/api/z', { success: false, message: 'x', code: 'SOMETHING_ELSE', activeRole: 'CLIENT' });
		expect(store.actingRole()).toBe(UserRole.PROVIDER);
		expect(nav).not.toHaveBeenCalled();
	});

	it('canSwitch=false (the user does not hold the role) still adopts the server role but never calls the switch API', () => {
		fail('/api/p', mismatch('CLIENT', { canSwitch: false }));
		expect(store.actingRole()).toBe(UserRole.CLIENT);
		ctl.expectNone('/api/user/switch-active-role');
	});

	it('cross-tab: a storage event with another activeRole updates this tab and leaves the wrong area; an identical value does nothing', () => {
		const next = { ...user, activeRole: UserRole.CLIENT };
		localStorage.setItem('waseet_user', JSON.stringify(next));
		window.dispatchEvent(new StorageEvent('storage', { key: 'waseet_user', newValue: JSON.stringify(next) }));
		expect(store.actingRole()).toBe(UserRole.CLIENT);
		expect(nav).toHaveBeenCalledWith('/client-overview');
		nav.mockClear();
		window.dispatchEvent(new StorageEvent('storage', { key: 'waseet_user', newValue: JSON.stringify(next) }));
		window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated', newValue: 'x' }));
		expect(nav).not.toHaveBeenCalled();
	});

	it('cross-tab: a removed user (logout elsewhere) is not half-applied', () => {
		localStorage.removeItem('waseet_user');
		window.dispatchEvent(new StorageEvent('storage', { key: 'waseet_user', newValue: null }));
		expect(store.actingRole()).toBe(UserRole.PROVIDER);
	});
});
