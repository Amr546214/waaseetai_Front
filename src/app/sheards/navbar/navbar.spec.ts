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
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { Navbar } from './navbar';
import { AuthStore } from '../../core/store/auth.store';
import { AccountService } from '../../core/services/account.service';
import { UserRole } from '../../core/models/auth.model';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

function setup(user: any) {
	const getSpy = vi.fn<(...args: any[]) => any>(() => of({ success: true, data: [] }));
	const switchActiveRoleSpy = vi.fn<(...args: any[]) => any>();
	const fakeAuthStore = {
		currentUser: signal<any>(user),
		token: signal('fake-token'),
		isAuthenticated: signal(true),
	};
	const fakeAccountService = { switchActiveRole: (...args: any[]) => switchActiveRoleSpy(...args) };

	// ThemeService and CartService (also injected here) read localStorage
	// (+ window.matchMedia for ThemeService) synchronously in their
	// constructors.
	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
	vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));

	TestBed.configureTestingModule({
		imports: [Navbar],
		providers: [
			provideRouter([{ path: '**', component: BlankTestComponent }]),
			{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } },
			{ provide: AuthStore, useValue: fakeAuthStore },
			{ provide: AccountService, useValue: fakeAccountService },
		],
	});

	const fixture: ComponentFixture<Navbar> = TestBed.createComponent(Navbar);
	const component = fixture.componentInstance;
	const router = TestBed.inject(Router);
	const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

	return { fixture, component, switchActiveRoleSpy, navigateByUrlSpy };
}

describe('Navbar — account-dropdown active-row click', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('should create', () => {
		const { fixture } = setup({ firstName: 'Amr', lastName: 'Okasha', accountType: 'CLIENT_INDIVIDUAL', activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT] });
		fixture.detectChanges();
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('clicking the CURRENTLY ACTIVE client row navigates to the client dashboard and never calls the role-switch API', () => {
		const { fixture, component, switchActiveRoleSpy, navigateByUrlSpy } = setup({
			firstName: 'Amr', lastName: 'Okasha', accountType: 'CLIENT_INDIVIDUAL', activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT, UserRole.PROVIDER]
		});
		fixture.detectChanges();

		component.switchRole(UserRole.CLIENT);

		expect(navigateByUrlSpy).toHaveBeenCalledWith('/client-overview');
		expect(switchActiveRoleSpy).not.toHaveBeenCalled();
	});

	it('clicking the CURRENTLY ACTIVE marketer row navigates to the marketer dashboard and never calls the role-switch API (role-driven, not CLIENT-hardcoded)', () => {
		const { fixture, component, switchActiveRoleSpy, navigateByUrlSpy } = setup({
			firstName: 'Amr', lastName: 'Okasha', accountType: 'MARKETING_BROKER', activeRole: UserRole.AFFILIATE, roles: [UserRole.CLIENT, UserRole.AFFILIATE]
		});
		fixture.detectChanges();

		component.switchRole(UserRole.AFFILIATE);

		expect(navigateByUrlSpy).toHaveBeenCalledWith('/marketer-overview');
		expect(switchActiveRoleSpy).not.toHaveBeenCalled();
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
