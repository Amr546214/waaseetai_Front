import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { AdminAccessService, AdminAccess } from './admin-access.service';
import { adminAccessGuard } from '../guards/admin-access.guard';
import { adminAccessInterceptor } from '../interceptors/admin-access.interceptor';
import { ruleForPath } from '../config/admin-access-rules';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const access = (over: Partial<AdminAccess> = {}): AdminAccess => ({ userId: 'u1', isSuperAdmin: false, staffStatus: 'ACTIVE', roleName: 'مشرف دعم', permissions: ['support.review'], hasAnyPermission: true, state: 'ACTIVE', displayRole: 'مشرف دعم', ...over });
const URL = () => `${environment.url_api}/admin/team/access/me`;

describe('admin access (what the SERVER says this admin account may do)', () => {
	let http: HttpTestingController; let svc: AdminAccessService;
	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(withInterceptors([adminAccessInterceptor])), provideHttpClientTesting()] });
		http = TestBed.inject(HttpTestingController); svc = TestBed.inject(AdminAccessService);
	});
	const load = async (a: AdminAccess) => { const p = svc.ensure(); http.expectOne(URL()).flush({ success: true, data: a }); await p; };

	it('nothing is allowed until the server answered, except the account\'s own pages; a failed read is an error state, never "allowed"', async () => {
		expect(svc.allows({ all: ['users.view'] })).toBe(false); expect(svc.allows({ member: true })).toBe(false); expect(svc.allows({ self: true })).toBe(true);
		const p = svc.ensure(); http.expectOne(URL()).flush({}, { status: 500, statusText: 'x' }); await p;
		expect(svc.status()).toBe('error'); expect(svc.allows({ member: true })).toBe(false); expect(svc.can('users.view')).toBe(false);
	});
	it('a member holds exactly the permissions of the role; the owner holds all; a team member without any permission is not a "member"', async () => {
		await load(access());
		expect(svc.can('support.review')).toBe(true); expect(svc.can('users.view')).toBe(false); expect(svc.allows({ member: true })).toBe(true);
		expect(svc.allows({ superAdmin: true })).toBe(false); expect(svc.allows({ anyOf: ['users.view', 'support.review'] })).toBe(true); expect(svc.allows({ all: ['support.review', 'users.view'] })).toBe(false);
		svc.reset(); await load(access({ permissions: [], hasAnyPermission: false, state: 'NO_PERMISSIONS' }));
		expect(svc.allows({ member: true })).toBe(false);
		svc.reset(); await load(access({ isSuperAdmin: true, permissions: [], state: 'SUPER_ADMIN', displayRole: 'Super Admin' }));
		expect(svc.can('payouts.send')).toBe(true); expect(svc.allows({ superAdmin: true })).toBe(true);
	});
	it('every route has a rule: money / settings / roles / performance are never "member" pages', () => {
		expect(ruleForPath('/supper-admin-overview/withdrawals')).toEqual({ all: ['withdrawals.review'] });
		expect(ruleForPath('/supper-admin-overview/withdrawals/abc')).toEqual({ all: ['withdrawals.review'] });
		expect(ruleForPath('/supper-admin-overview/roles')).toEqual({ superAdmin: true });
		expect(ruleForPath('/supper-admin-overview/super-admins')).toEqual({ superAdmin: true });
		expect(ruleForPath('/supper-admin-overview/team-performance')).toEqual({ all: ['performance.view'] });
		expect(ruleForPath('/supper-admin-overview/system-settings')).toEqual({ all: ['settings.manage'] });
		expect(ruleForPath('/supper-admin-overview/sub-finance/invoices-out')).toEqual({ all: ['finance.read'] });
		expect(ruleForPath('/supper-admin-overview/my-account')).toEqual({ self: true });
		expect(ruleForPath('/supper-admin-overview')).toEqual({ member: true });
	});
	it('a direct link to a page the account may not open lands on the clear no-access page; an unreadable state fails closed', async () => {
		const router = TestBed.inject(Router);
		const run = (rule: any) => TestBed.runInInjectionContext(() => adminAccessGuard({ data: { access: rule } } as any, { url: '/supper-admin-overview/withdrawals' } as any)) as Promise<any>;
		const p1 = run({ all: ['withdrawals.review'] }); http.expectOne(URL()).flush({ success: true, data: access() });
		const r1 = await p1; expect(router.serializeUrl(r1)).toContain('/supper-admin-overview/no-access?reason=denied');
		const r2 = await run({ all: ['support.review'] }); expect(r2).toBe(true);
		svc.reset(); const p3 = run({ member: true }); http.expectOne(URL()).flush({}, { status: 503, statusText: 'x' });
		expect(router.serializeUrl(await p3)).toContain('reason=unavailable');
		svc.reset(); const p4 = run({ member: true }); http.expectOne(URL()).flush({ success: true, data: access({ staffStatus: 'SUSPENDED', permissions: [], state: 'SUSPENDED' }) });
		expect(router.serializeUrl(await p4)).toContain('reason=SUSPENDED');
	});
	it('a permission refusal from an /admin/ endpoint makes the app read its permissions again (a revoked permission shows on the screen too)', async () => {
		await load(access({ permissions: ['users.view'] }));
		const client = TestBed.inject(HttpClient); let status = 0;
		client.get(`${environment.url_api}/admin/users`).subscribe({ error: e => (status = e.status) });
		http.expectOne(`${environment.url_api}/admin/users`).flush({ code: 'ADMIN_PERMISSION_DENIED', message: 'x' }, { status: 403, statusText: 'Forbidden' });
		expect(status).toBe(403);
		http.expectOne(URL()).flush({ success: true, data: access({ permissions: [], hasAnyPermission: false, state: 'NO_PERMISSIONS' }) });
		await Promise.resolve(); expect(svc.can('users.view')).toBe(false);
		// an ordinary 403 (any other code) does not trigger a re-read
		client.get(`${environment.url_api}/admin/other`).subscribe({ error: () => undefined });
		http.expectOne(`${environment.url_api}/admin/other`).flush({ code: 'SOMETHING' }, { status: 403, statusText: 'Forbidden' });
		http.expectNone(URL());
	});

	it('operations records: the LIST pages are owner-only, one record opens for any member (the server decides which, by the case held)', () => {
		for (const list of ['projects', 'contracts', 'requests', 'offers']) {
			expect(ruleForPath(`/supper-admin-overview/${list}`)).toEqual({ superAdmin: true });
			expect(ruleForPath(`/supper-admin-overview/${list}/abc`)).toEqual({ member: true });
		}
	});
	it('a page that is open when access is withdrawn is left at once (open page, new permissions); an unreadable state also leaves it', async () => {
		const router = TestBed.inject(Router);
		await load(access({ permissions: ['support.review'] }));
		await router.navigateByUrl('/supper-admin-overview/support', { skipLocationChange: true }).catch(() => undefined);
		Object.defineProperty(router, 'url', { get: () => '/supper-admin-overview/support', configurable: true });
		const nav: string[] = []; (router as any).navigateByUrl = (u: string) => { nav.push(u); return Promise.resolve(true); };
		// still allowed -> stays
		let p = svc.refresh(); http.expectOne(URL()).flush({ success: true, data: access({ permissions: ['support.review'] }) }); await p; expect(nav).toEqual([]);
		// support.review withdrawn while the page is open -> leaves to the no-access page
		p = svc.refresh(); http.expectOne(URL()).flush({ success: true, data: access({ permissions: ['users.view'] }) }); await p;
		expect(nav).toEqual(['/supper-admin-overview/no-access?reason=denied']);
		// the state cannot be read -> also leaves (never "allowed")
		nav.length = 0; p = svc.refresh(); http.expectOne(URL()).flush({}, { status: 500, statusText: 'x' }); await p;
		expect(nav).toEqual(['/supper-admin-overview/no-access?reason=unavailable']);
	});
});
