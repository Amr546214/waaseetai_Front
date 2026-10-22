import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
(globalThis as any).__socketIoModule = () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) });

import { Sidebar, NavItem } from './sidebar';
import { AuthStore } from '../../../core/store/auth.store';

function setup(user: any) {
	TestBed.configureTestingModule({
		imports: [Sidebar],
		providers: [
			provideRouter([]),
			{ provide: HttpClient, useValue: { get: () => of({ success: true, data: {} }) } },
			{ provide: AuthStore, useValue: { currentUser: signal<any>(user), token: signal('t') } },
		],
	});
	const f = TestBed.createComponent(Sidebar);
	f.detectChanges();
	const flat = () => (f.componentInstance.navItems() as NavItem[]).flatMap(i => [i, ...(i.children ?? [])]);
	return { routes: () => flat().map(i => i.route).filter(Boolean) as string[], title: () => f.componentInstance.sidebarTitle() };
}

describe('sidebar for an ADMIN account (not a super admin)', () => {
	afterEach(() => TestBed.resetTestingModule());
	const ADMIN = { accountType: 'ADMIN', activeRole: 'ADMIN', roles: ['ADMIN'] };

	it('shows the admin menu and title, never the client menu', () => {
		const { routes, title } = setup(ADMIN);
		expect(title()).toBe('لوحة الإدارة');
		expect(routes()).toContain('/supper-admin-overview/accreditations');
		expect(routes()).toContain('/supper-admin-overview/users');
		expect(routes().some(r => r.startsWith('/client-overview'))).toBe(false);
	});
	it('does not list the super-admin-only page', () => {
		expect(setup(ADMIN).routes()).not.toContain('/supper-admin-overview/super-admins');
	});
	it('a SUPER_ADMIN keeps the full menu including the super admin page', () => {
		const r = setup({ accountType: 'SUPER_ADMIN', activeRole: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] }).routes();
		expect(r).toContain('/supper-admin-overview/super-admins');
		expect(r).toContain('/supper-admin-overview/accreditations');
	});
	it('an admin account whose STORED active role is CLIENT still gets the admin menu (the account type decides, never the client shell)', () => {
		for (const accountType of ['ADMIN', 'SUPER_ADMIN']) {
			const { routes } = setup({ accountType, activeRole: 'CLIENT', roles: ['CLIENT'] });
			expect(routes().some(r => r.startsWith('/client-overview'))).toBe(false);
			expect(routes()).toContain('/supper-admin-overview/users');
			TestBed.resetTestingModule();
		}
	});
});
