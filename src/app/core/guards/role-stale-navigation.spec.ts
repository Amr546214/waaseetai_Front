import { TestBed } from '@angular/core/testing';
import { Component, OnInit, inject } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NavigationStart, Router, RouterOutlet, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { authGuard, clientGuard, marketerGuard, providerGuard } from './auth.guards';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthStore } from '../store/auth.store';
import { UiNotificationService } from '../services/ui-notification.service';
import { AccountType, UserRole } from '../models/auth.model';

// N1 (K-5c): a stale tab sitting on a dead marketer URL (the 404 view), server role CLIENT, user clicks a sidebar link -> the marketer page opens, its calls answer
// ROLE_MISMATCH -> the tab must END on the client dashboard (path + content), whatever happened to the first redirect attempt.
@Component({ standalone: true, template: '<i data-testid="client-home">client</i>' }) class ClientHome {}
@Component({ standalone: true, template: '<i data-testid="notfound">404</i>' }) class NotFound {}
@Component({ standalone: true, template: '<i data-testid="withdraw">withdraw</i>' })
class Withdraw implements OnInit { private http = inject(HttpClient); ngOnInit() { this.http.get('/api/marketer-overview/wallet').subscribe({ error: () => {} }); } }
@Component({ standalone: true, template: '<i data-testid="provider-sub">provider</i>' })
class ProviderSub implements OnInit { private http = inject(HttpClient); ngOnInit() { this.http.get('/api/provider/finance/wallet').subscribe({ error: () => {} }); } }
@Component({ standalone: true, imports: [RouterOutlet], template: '<router-outlet />' }) class Shell {}

const routes: Routes = [
	{ path: 'client-overview', canActivate: [authGuard, clientGuard], runGuardsAndResolvers: 'always', component: Shell, children: [{ path: '', component: ClientHome }] },
	{ path: 'marketer-overview', canActivate: [authGuard, marketerGuard], runGuardsAndResolvers: 'always', component: Shell, children: [{ path: '', component: NotFound }, { path: 'withdraw', component: Withdraw }, { path: '**', component: NotFound }] },
	{ path: 'provider-overview', canActivate: [authGuard, providerGuard], runGuardsAndResolvers: 'always', component: Shell, children: [{ path: '', component: NotFound }, { path: 'finance/withdraw', component: ProviderSub }] },
];
const mismatch = (required: string, active: string, extra: object = {}) => ({ success: false, message: 'x', code: 'ROLE_MISMATCH', requiredRoles: [required], activeRole: active, canSwitch: true, ...extra });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('stale role tab ends on the corrected role dashboard (N1)', () => {
	let store: AuthStore, router: Router, ctl: HttpTestingController, h: RouterTestingHarness, starts: number;
	const info = vi.fn();

	async function boot(role: UserRole, accountType: AccountType, roles: UserRole[], startUrl: string) {
		localStorage.clear(); document.cookie = 'waseet_user=; Max-Age=0; path=/'; document.cookie = 'waseet_token=; Max-Age=0; path=/';
		TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), { provide: UiNotificationService, useValue: { info, showBanner: vi.fn(), error: vi.fn() } }] });
		store = TestBed.inject(AuthStore); router = TestBed.inject(Router); ctl = TestBed.inject(HttpTestingController);
		store.authenticate('tok', { id: 'u1', accountType, activeRole: role, roles } as any);
		h = await RouterTestingHarness.create();
		await h.navigateByUrl(startUrl);
		starts = 0; router.events.subscribe(e => { if (e instanceof NavigationStart) starts++; });
	}
	const outlet = () => (h.routeNativeElement as HTMLElement).innerHTML;
	const answer = (url: string, body: any, status = 403) => ctl.match(r => r.url === url).forEach(r => r.flush(body, { status, statusText: 'x' }));
	beforeEach(() => info.mockClear());
	afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

	it('(a) dead marketer URL -> click withdraw -> 403 ROLE_MISMATCH -> ends on /client-overview with client content, no withdraw component', async () => {
		await boot(UserRole.AFFILIATE, AccountType.MARKETING_BROKER, [UserRole.AFFILIATE, UserRole.CLIENT], '/marketer-overview/summary');
		expect(outlet()).toContain('notfound');
		await h.navigateByUrl('/marketer-overview/withdraw');
		answer('/api/marketer-overview/wallet', mismatch('AFFILIATE', 'CLIENT'));
		await wait(100); h.detectChanges();
		expect(router.url).toBe('/client-overview');
		expect(outlet()).toContain('client-home');
		expect(outlet()).not.toContain('withdraw');
		expect(store.actingRole()).toBe(UserRole.CLIENT);
	});

	it('(a2) the SAME, but the first redirect attempt is lost (refused / superseded): the tab still ends on /client-overview', async () => {
		await boot(UserRole.AFFILIATE, AccountType.MARKETING_BROKER, [UserRole.AFFILIATE, UserRole.CLIENT], '/marketer-overview/summary');
		await h.navigateByUrl('/marketer-overview/withdraw');
		const real = router.navigateByUrl.bind(router);
		let lost = 0;
		vi.spyOn(router, 'navigateByUrl').mockImplementation(((url: any, extras: any) => { if (lost++ === 0) return Promise.resolve(false); return real(url, extras); }) as any);
		answer('/api/marketer-overview/wallet', mismatch('AFFILIATE', 'CLIENT'));
		await wait(1200); h.detectChanges();
		expect(router.url).toBe('/client-overview');
		expect(outlet()).toContain('client-home');
		expect(outlet()).not.toContain('withdraw');
	});

	it('(a3) even if every in-app redirect is lost, one capped hard redirect is requested (never a loop)', async () => {
		await boot(UserRole.AFFILIATE, AccountType.MARKETING_BROKER, [UserRole.AFFILIATE, UserRole.CLIENT], '/marketer-overview/withdraw');
		vi.spyOn(router, 'navigateByUrl').mockImplementation((() => Promise.resolve(false)) as any);
		const hard = vi.spyOn(store as any, 'hardRedirect').mockImplementation(() => {});
		answer('/api/marketer-overview/wallet', mismatch('AFFILIATE', 'CLIENT'));
		await wait(2500);
		expect(hard).toHaveBeenCalledTimes(1);
		expect(hard).toHaveBeenCalledWith('/client-overview');
	});

	it('(i) while the redirect is still loading (slow lazy chunks) the store says which dashboard is coming, and clears it once the tab is in the right area', async () => {
		await boot(UserRole.AFFILIATE, AccountType.MARKETING_BROKER, [UserRole.AFFILIATE, UserRole.CLIENT], '/marketer-overview/summary');
		await h.navigateByUrl('/marketer-overview/withdraw');
		const real = router.navigateByUrl.bind(router);
		let release!: () => void;
		vi.spyOn(router, 'navigateByUrl').mockImplementation(((url: any, extras: any) => new Promise(res => { release = () => res(real(url, extras)); })) as any);
		answer('/api/marketer-overview/wallet', mismatch('AFFILIATE', 'CLIENT'));
		expect(router.url).toBe('/marketer-overview/withdraw');
		expect(store.roleRedirect()).toBe(UserRole.CLIENT);
		release(); await wait(150);
		expect(router.url).toBe('/client-overview');
		expect(store.roleRedirect()).toBeNull();
	});

	it('(i2) the marker never sticks: when every redirect attempt is lost it is cleared after the cap', async () => {
		await boot(UserRole.AFFILIATE, AccountType.MARKETING_BROKER, [UserRole.AFFILIATE, UserRole.CLIENT], '/marketer-overview/withdraw');
		vi.spyOn(router, 'navigateByUrl').mockImplementation((() => Promise.resolve(false)) as any);
		vi.spyOn(store as any, 'hardRedirect').mockImplementation(() => {});
		answer('/api/marketer-overview/wallet', mismatch('AFFILIATE', 'CLIENT'));
		await wait(3500);
		expect(store.roleRedirect()).toBeNull();
	});

	it('(h) the acting role changes while the tab sits on the other role page (no 403 needed) -> it leaves that page', async () => {
		await boot(UserRole.AFFILIATE, AccountType.MARKETING_BROKER, [UserRole.AFFILIATE, UserRole.CLIENT], '/marketer-overview/withdraw');
		store.updateUser({ activeRole: UserRole.CLIENT });
		await wait(100); h.detectChanges();
		expect(router.url).toBe('/client-overview');
		expect(outlet()).toContain('client-home');
	});

	it('(b) a genuine marketer on a marketer page stays and loads (no redirect, no role change)', async () => {
		await boot(UserRole.AFFILIATE, AccountType.MARKETING_BROKER, [UserRole.AFFILIATE, UserRole.CLIENT], '/marketer-overview/summary');
		await h.navigateByUrl('/marketer-overview/withdraw');
		answer('/api/marketer-overview/wallet', { success: true, data: {} }, 200);
		await wait(800);
		expect(router.url).toBe('/marketer-overview/withdraw');
		expect(outlet()).toContain('withdraw');
		expect(store.actingRole()).toBe(UserRole.AFFILIATE);
		expect(starts).toBe(1);
	});

	it('(c) a tab whose local role is already right is untouched, even by a mismatch that names the same role', async () => {
		await boot(UserRole.CLIENT, AccountType.MARKETING_BROKER, [UserRole.AFFILIATE, UserRole.CLIENT], '/client-overview');
		const http = TestBed.inject(HttpClient);
		http.get('/api/anything').subscribe({ error: () => {} });
		answer('/api/anything', mismatch('CLIENT', 'CLIENT'));
		await wait(800);
		expect(router.url).toBe('/client-overview');
		expect(starts).toBe(0);
	});

	it('(d) provider direction: stale PROVIDER on a provider sub-page, server CLIENT -> /client-overview with client content', async () => {
		await boot(UserRole.PROVIDER, AccountType.PROVIDER_INDIVIDUAL, [UserRole.PROVIDER, UserRole.CLIENT], '/provider-overview');
		await h.navigateByUrl('/provider-overview/finance/withdraw');
		answer('/api/provider/finance/wallet', mismatch('PROVIDER', 'CLIENT'));
		await wait(100); h.detectChanges();
		expect(router.url).toBe('/client-overview');
		expect(outlet()).toContain('client-home');
		expect(outlet()).not.toContain('provider-sub');
	});

	it('(e)(f) no loop (<= 3 navigations) and the reconcile never calls the switch API', async () => {
		await boot(UserRole.AFFILIATE, AccountType.MARKETING_BROKER, [UserRole.AFFILIATE, UserRole.CLIENT], '/marketer-overview/summary');
		await h.navigateByUrl('/marketer-overview/withdraw');
		answer('/api/marketer-overview/wallet', mismatch('AFFILIATE', 'CLIENT'));
		await wait(1500);
		expect(starts).toBeLessThanOrEqual(3);
		ctl.expectNone(r => r.url.includes('switch-active-role'));
		expect(router.url).toBe('/client-overview');
	});

	it('(g) a plain 403 (a real denial: the user does not hold the role) is never reconciled: no switch, no redirect, role unchanged', async () => {
		await boot(UserRole.CLIENT, AccountType.CLIENT_INDIVIDUAL, [UserRole.CLIENT], '/client-overview');
		TestBed.inject(HttpClient).get('/api/marketer-overview/wallet').subscribe({ error: () => {} });
		answer('/api/marketer-overview/wallet', { success: false, message: 'ليس لديك صلاحية' });
		await wait(800);
		expect(store.actingRole()).toBe(UserRole.CLIENT);
		expect(router.url).toBe('/client-overview');
		expect(starts).toBe(0);
		ctl.expectNone(r => r.url.includes('switch-active-role'));
	});

	it('(g2) a user who does not hold the marketer role cannot open its area by URL (guard denial stays)', async () => {
		await boot(UserRole.CLIENT, AccountType.CLIENT_INDIVIDUAL, [UserRole.CLIENT], '/client-overview');
		await h.navigateByUrl('/marketer-overview/withdraw');
		await wait(200);
		expect(router.url).toBe('/client-overview');
		expect(store.actingRole()).toBe(UserRole.CLIENT);
	});
});
