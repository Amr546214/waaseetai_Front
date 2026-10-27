import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
(globalThis as any).__socketIoModule = () => ({ default: () => fakeSocket, io: () => fakeSocket });

import { Sidebar } from './sidebar';
import { AuthStore } from '../../../core/store/auth.store';
import { ProviderAccessService } from '../../../core/services/provider-access.service';
import { isAdminUser } from '../../../core/guards/auth.guards';
import { AdminAccessService } from '../../../core/services/admin-access.service';

// «التحكم بالموقع»: a section at the BOTTOM of the admin sidebar (just above the logout button), with the nine pages under it and real links.
describe('Sidebar: التحكم بالموقع', () => {
	// the menu follows what the SERVER says this account may do (admin access): a SUPER_ADMIN holds every permission, an ADMIN only those of its role
	const items = (accountType: string, perms: string[] = []) => {
		TestBed.configureTestingModule({ imports: [Sidebar], providers: [provideRouter([]), { provide: HttpClient, useValue: { get: () => of({ success: true, data: {} }) } }, { provide: AuthStore, useValue: { currentUser: signal({ accountType } as any), token: signal('t') } }, { provide: ProviderAccessService, useValue: { load: () => of({}), latest: signal(null) } }] });
		const acc = TestBed.inject(AdminAccessService);
		if (accountType === 'SUPER_ADMIN' || accountType === 'ADMIN') { acc.access.set({ userId: 'u', isSuperAdmin: accountType === 'SUPER_ADMIN', staffStatus: 'ACTIVE', roleName: 'r', permissions: perms, hasAnyPermission: true, state: accountType === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ACTIVE', displayRole: 'r' }); acc.status.set('ready'); }
		const f = TestBed.createComponent(Sidebar); f.detectChanges();
		return (f.componentInstance as any).navItems() as any[];
	};
	afterEach(() => TestBed.resetTestingModule());

	it('a super admin sees the section last (before logout) with «الهوية» first and the nine local pages, correct routes', () => {
		const nav = items('SUPER_ADMIN', ['site_control.manage']);
		const i = nav.findIndex(n => n.type === 'header' && n.label === 'التحكم بالموقع');
		expect(i).toBeGreaterThan(-1);
		expect(nav[i + 1].type).toBe('accordion');
		expect(nav[i + 1].label).toBe('التحكم بالموقع');
		expect(nav[i + 2].type).toBe('button'); // logout stays the last entry
		const children = nav[i + 1].children as any[];
		expect(children.map(c => c.label)).toEqual(['الهوية', 'صحة الهوية', 'القيم والألوان', 'مكتبة الأيقونات (محلية)', 'المستويات والنقاط', 'القوالب', 'الخطوط', 'دليل الأنماط', 'المعاينة الشاملة', 'تصدير CSS']);
		expect(children.every(c => String(c.route).startsWith('/supper-admin-overview/site-control/'))).toBe(true);
	});

	it('an ADMIN account sees the link only while its role (or a personal grant) holds site_control.manage; without it the section is absent, and the admin menu still opens', () => {
		const without = items('ADMIN', ['users.view']);
		expect(without.some(n => n.label === 'التحكم بالموقع')).toBe(false);
		expect(without.some(n => n.route === '/supper-admin-overview')).toBe(true);
		TestBed.resetTestingModule();
		expect(items('ADMIN', ['site_control.manage']).some(n => n.label === 'التحكم بالموقع')).toBe(true);
		TestBed.resetTestingModule();
		// the ROUTE guard of the account type is unchanged; the permission rule (site_control.manage) is enforced by the access guard on top of it
		expect(isAdminUser({ accountType: 'ADMIN' })).toBe(true);
		expect(isAdminUser({ accountType: 'SUPER_ADMIN' })).toBe(true);
		expect(isAdminUser({ accountType: 'CLIENT_INDIVIDUAL' })).toBe(false);
	});

	it('identity-only staff (site.view / site.manage, no site_control.manage) see ONLY «الهوية»; the local pages stay hidden from them', () => {
		for (const perm of ['site.view', 'site.manage']) {
			const nav = items('ADMIN', [perm]);
			const sec = nav.find(n => n.type === 'accordion' && n.label === 'التحكم بالموقع');
			expect(sec?.children.map((c: any) => c.label)).toEqual(['الهوية']);
			TestBed.resetTestingModule();
		}
		// a staff member holding neither has no section; the old permission keeps the nine local pages but not the identity link
		expect(items('ADMIN', ['users.view']).some(n => n.label === 'التحكم بالموقع')).toBe(false);
		TestBed.resetTestingModule();
		const legacy = items('ADMIN', ['site_control.manage']).find(n => n.label === 'التحكم بالموقع' && n.type === 'accordion');
		expect(legacy.children.map((c: any) => c.label)).not.toContain('الهوية');
	});

	it('no other role gets the section', () => {
		for (const t of ['CLIENT_INDIVIDUAL', 'PROVIDER_INDIVIDUAL', 'MARKETING_BROKER']) {
			expect(items(t).some(n => n.label === 'التحكم بالموقع')).toBe(false);
			TestBed.resetTestingModule();
		}
	});
});
