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

// «التحكم بالموقع»: a section at the BOTTOM of the admin sidebar (just above the logout button), with the nine pages under it and real links.
describe('Sidebar: التحكم بالموقع', () => {
	const items = (accountType: string) => {
		TestBed.configureTestingModule({ imports: [Sidebar], providers: [provideRouter([]), { provide: HttpClient, useValue: { get: () => of({ success: true, data: {} }) } }, { provide: AuthStore, useValue: { currentUser: signal({ accountType } as any), token: signal('t') } }, { provide: ProviderAccessService, useValue: { load: () => of({}), latest: signal(null) } }] });
		const f = TestBed.createComponent(Sidebar); f.detectChanges();
		return (f.componentInstance as any).navItems() as any[];
	};
	afterEach(() => TestBed.resetTestingModule());

	it('a super admin sees the section last (before logout) with the nine pages and correct routes', () => {
		const nav = items('SUPER_ADMIN');
		const i = nav.findIndex(n => n.type === 'header' && n.label === 'التحكم بالموقع');
		expect(i).toBeGreaterThan(-1);
		expect(nav[i + 1].type).toBe('accordion');
		expect(nav[i + 1].label).toBe('التحكم بالموقع');
		expect(nav[i + 2].type).toBe('button'); // logout stays the last entry
		const children = nav[i + 1].children as any[];
		expect(children.map(c => c.label)).toEqual(['صحة الهوية', 'القيم والألوان', 'الأيقونات', 'المستويات والنقاط', 'القوالب', 'الخطوط', 'دليل الأنماط', 'المعاينة الشاملة', 'تصدير CSS']);
		expect(children.every(c => String(c.route).startsWith('/supper-admin-overview/site-control/'))).toBe(true);
	});

	it('PINS the current state (a permission decision is still pending): an ADMIN account gets the admin menu WITHOUT the link (link = SUPER_ADMIN only), while the ROUTE guard still admits ADMIN', () => {
		const adminNav = items('ADMIN');
		expect(adminNav.some(n => n.label === 'التحكم بالموقع')).toBe(false);
		expect(adminNav.some(n => n.route === '/supper-admin-overview')).toBe(true);
		TestBed.resetTestingModule();
		expect(isAdminUser({ accountType: 'ADMIN' })).toBe(true);
		expect(isAdminUser({ accountType: 'SUPER_ADMIN' })).toBe(true);
		expect(isAdminUser({ accountType: 'CLIENT_INDIVIDUAL' })).toBe(false);
	});

	it('no other role gets the section', () => {
		for (const t of ['CLIENT_INDIVIDUAL', 'PROVIDER_INDIVIDUAL', 'MARKETING_BROKER']) {
			expect(items(t).some(n => n.label === 'التحكم بالموقع')).toBe(false);
			TestBed.resetTestingModule();
		}
	});
});
