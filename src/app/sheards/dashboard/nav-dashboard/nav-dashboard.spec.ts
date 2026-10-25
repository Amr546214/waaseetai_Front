import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

// NotificationEngineService (injected transitively via the NotificationBell
// child component) eagerly opens a socket.io connection in its constructor —
// mocked at the module boundary, same pattern used by every other
// notification-related spec file in this codebase.
const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
(globalThis as any).__socketIoModule = () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) });

import { NavDashboard } from './nav-dashboard';
import { AuthStore } from '../../../core/store/auth.store';
import { AccountService } from '../../../core/services/account.service';
import { UserRole } from '../../../core/models/auth.model';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

function setup(user: any) {
	const getSpy = vi.fn<(...args: any[]) => any>(() => of({ success: true, data: [] }));
	const switchActiveRoleSpy = vi.fn<(...args: any[]) => any>();
	const fakeAuthStore = { currentUser: signal<any>(user), token: signal('fake-token') };
	const fakeAccountService = { switchActiveRole: (...args: any[]) => switchActiveRoleSpy(...args) };

	// ThemeService (also injected by NavDashboard) reads localStorage +
	// window.matchMedia synchronously in its constructor.
	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
	vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));

	TestBed.configureTestingModule({
		imports: [NavDashboard],
		providers: [
			provideRouter([{ path: '**', component: BlankTestComponent }]),
			{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } },
			{ provide: AuthStore, useValue: fakeAuthStore },
			{ provide: AccountService, useValue: fakeAccountService },
		],
	});

	const fixture: ComponentFixture<NavDashboard> = TestBed.createComponent(NavDashboard);
	const component = fixture.componentInstance;
	const router = TestBed.inject(Router);
	const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

	return { fixture, component, switchActiveRoleSpy, navigateByUrlSpy };
}

describe('NavDashboard — account-dropdown active-row click', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('should create', () => {
		const { fixture } = setup({ firstName: 'Amr', lastName: 'Okasha', accountType: 'CLIENT_INDIVIDUAL', activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT] });
		fixture.detectChanges();
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('clicking the CURRENTLY ACTIVE client row re-syncs with the server (idempotent role-switch API) and then navigates to the client dashboard', () => {
		const { fixture, component, switchActiveRoleSpy, navigateByUrlSpy } = setup({
			firstName: 'Amr', lastName: 'Okasha', accountType: 'CLIENT_INDIVIDUAL', activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT, UserRole.PROVIDER]
		});
		fixture.detectChanges();

		switchActiveRoleSpy.mockReturnValue(of({ success: true }));
		component.switchRole(UserRole.CLIENT);

		expect(switchActiveRoleSpy).toHaveBeenCalledWith(UserRole.CLIENT);
		expect(navigateByUrlSpy).toHaveBeenCalledWith('/client-overview');

	});

	it('clicking the CURRENTLY ACTIVE provider row re-syncs with the server (idempotent role-switch API) and then navigates to the provider dashboard (role-driven, not CLIENT-hardcoded)', () => {
		const { fixture, component, switchActiveRoleSpy, navigateByUrlSpy } = setup({
			firstName: 'Amr', lastName: 'Okasha', accountType: 'PROVIDER_INDIVIDUAL', activeRole: UserRole.PROVIDER, roles: [UserRole.CLIENT, UserRole.PROVIDER]
		});
		fixture.detectChanges();

		switchActiveRoleSpy.mockReturnValue(of({ success: true }));
		component.switchRole(UserRole.PROVIDER);

		expect(switchActiveRoleSpy).toHaveBeenCalledWith(UserRole.PROVIDER);
		expect(navigateByUrlSpy).toHaveBeenCalledWith('/provider-overview');

	});

	it('clicking a DIFFERENT (non-active) role row still triggers the existing switch-role API call, unchanged', () => {
		const { fixture, component, switchActiveRoleSpy } = setup({
			firstName: 'Amr', lastName: 'Okasha', accountType: 'CLIENT_INDIVIDUAL', activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT, UserRole.PROVIDER]
		});
		fixture.detectChanges();
		switchActiveRoleSpy.mockReturnValue(of({ success: true }));

		component.switchRole(UserRole.PROVIDER);

		expect(switchActiveRoleSpy).toHaveBeenCalledWith(UserRole.PROVIDER);
	});
});

describe('NavDashboard — admin accounts', () => {
	afterEach(() => vi.unstubAllGlobals());
	const adminCases: Array<[string, any, string]> = [
		['SUPER_ADMIN stored as CLIENT', { firstName: 'Amr', lastName: 'Okasha', accountType: 'SUPER_ADMIN', activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT] }, 'حساب إداري'],
		['ADMIN stored as CLIENT with a client role too', { firstName: 'Ola', lastName: 'Admin', accountType: 'ADMIN', activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT, UserRole.ADMIN] }, 'حساب إداري'],
		['ADMIN stored as ADMIN', { firstName: 'Ola', lastName: 'Admin', accountType: 'ADMIN', activeRole: UserRole.ADMIN, roles: [UserRole.ADMIN] }, 'حساب إداري'],
	];
	for (const [name, user, label] of adminCases) {
		it(`${name}: shows «${label}» (never «طالب الخدمة»), a direct link to the admin panel, and NO role list / switch`, () => {
			const { fixture, component, switchActiveRoleSpy } = setup(user);
			fixture.detectChanges();
			component.isUserDropdownOpen.set(true);
			fixture.detectChanges();
			const el = fixture.nativeElement as HTMLElement;
			expect(el.querySelector('[data-testid="topnav-role-label"]')!.textContent!.trim()).toBe(label);
			expect(el.textContent).not.toContain('طالب الخدمة');
			expect(el.querySelector('[data-testid="topnav-admin-home"]')!.getAttribute('href')).toBe('/supper-admin-overview');
			expect(el.querySelector('#udrop-dash-sub')).toBeNull();
			expect(el.querySelector('[data-testid="topnav-add-account"]')).toBeNull();
			expect(switchActiveRoleSpy).not.toHaveBeenCalled();
		});
	}

	it('an admin account shows its REAL administrative role from the server (the owner, or the team role), never a generic «مدير/مشرف النظام» that suggests authority', async () => {
		const { fixture, component } = setup({ firstName: 'Amr', lastName: 'O', accountType: 'SUPER_ADMIN', activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT] });
		const { AdminAccessService } = await import('../../../core/services/admin-access.service');
		const acc = TestBed.inject(AdminAccessService);
		acc.access.set({ userId: 'u', isSuperAdmin: true, staffStatus: null, roleName: 'المالك', permissions: [], hasAnyPermission: true, state: 'SUPER_ADMIN', displayRole: 'Super Admin' }); acc.status.set('ready');
		fixture.detectChanges(); component.isUserDropdownOpen.set(true); fixture.detectChanges();
		expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="topnav-role-label"]')!.textContent!.trim()).toBe('Super Admin');
	});

	it('the role switch stays for client / provider / marketer accounts', () => {
		const { fixture, component } = setup({ firstName: 'A', lastName: 'B', accountType: 'CLIENT_INDIVIDUAL', activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT, UserRole.PROVIDER] });
		fixture.detectChanges();
		component.isUserDropdownOpen.set(true); component.isDashSubMenuOpen.set(true);
		fixture.detectChanges();
		const el = fixture.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="topnav-admin-home"]')).toBeNull();
		expect(el.querySelectorAll('.udrop-dash-item').length).toBe(2);
	});
});
