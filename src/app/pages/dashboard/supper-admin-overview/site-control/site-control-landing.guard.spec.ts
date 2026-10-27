import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, afterEach } from 'vitest';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { SITE_CONTROL_PAGES, firstAllowedSiteControlPage, siteControlLandingGuard } from './site-control-landing.guard';
import { SUPPER_ADMIN_ROUTES } from '../supper-admin.routes';

// The section link (`/site-control`) opens the FIRST page the account may open, per permission combination.
describe('«التحكم بالموقع» landing', () => {
	afterEach(() => TestBed.resetTestingModule());
	const land = async (acct: 'SUPER_ADMIN' | 'ADMIN', perms: string[]) => {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: HttpClient, useValue: { get: () => of({ success: true, data: { userId: 'u', isSuperAdmin: acct === 'SUPER_ADMIN', staffStatus: 'ACTIVE', roleName: 'r', permissions: perms, hasAnyPermission: perms.length > 0, state: acct === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ACTIVE', displayRole: 'r' } }) } }] });
		const res = await TestBed.runInInjectionContext(() => siteControlLandingGuard({} as never, { url: '/supper-admin-overview/site-control' } as never));
		return res instanceof UrlTree ? TestBed.inject(Router).serializeUrl(res) : String(res);
	};
	const ID = '/supper-admin-overview/site-control/identity';
	it('SUPER_ADMIN, site.manage, site.view, legacy only, old+new: all land on an allowed page (identity; the legacy holder reads it)', async () => {
		expect(await land('SUPER_ADMIN', [])).toBe(ID);
		expect(await land('ADMIN', ['site.manage'])).toBe(ID);
		expect(await land('ADMIN', ['site.view'])).toBe(ID);
		expect(await land('ADMIN', ['site_control.manage'])).toBe(ID);
		expect(await land('ADMIN', ['site_control.manage', 'site.manage'])).toBe(ID);
	});
	it('a staff member with none of the three permissions is sent to «no access», never into the section', async () => {
		expect(await land('ADMIN', ['users.view'])).toContain('/supper-admin-overview/no-access');
		expect(await land('ADMIN', ['users.view'])).toContain('reason=denied');
	});
	it('the helper picks the first page of the section order that the rule predicate admits (a local page when identity is not allowed)', () => {
		expect(firstAllowedSiteControlPage(() => true)).toBe('identity');
		expect(firstAllowedSiteControlPage(r => !!r.all?.includes('site_control.manage'))).toBe('health');
		expect(firstAllowedSiteControlPage(() => false)).toBeNull();
		expect(SITE_CONTROL_PAGES[0]).toBe('identity');
	});
	it('the route table: the empty child is the landing guard (not a fixed redirect) and keeps the access guard of the section', () => {
		const section = SUPPER_ADMIN_ROUTES.find(r => r.path === 'site-control')!;
		const empty = section.children!.find(c => c.path === '')!;
		expect(empty.redirectTo).toBeUndefined();
		expect(empty.canActivate!.length).toBe(2);
		expect(empty.canActivate![0]).toBe(siteControlLandingGuard);
		expect(section.children!.map(c => c.path)).toEqual(['', ...SITE_CONTROL_PAGES]);
	});
});
