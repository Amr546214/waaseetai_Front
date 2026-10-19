import { TestBed } from '@angular/core/testing';
import { Component, OnInit, inject } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NavigationCancel, NavigationCancellationCode, NavigationStart, Router, RouterOutlet, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { authGuard, clientGuard, marketerGuard, providerGuard } from './auth.guards';
import { serverActiveRoleGuard, SERVER_ROLE_CHECK_TIMEOUT_MS } from './server-active-role.guard';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthStore } from '../store/auth.store';
import { UiNotificationService } from '../services/ui-notification.service';
import { AccountType, UserRole } from '../models/auth.model';

// N3: the pre-activation guard composed with the REAL AuthStore (role follow / redirect note), the real role guards and the real interceptor.
let withdrawCreated = 0;
@Component({ standalone: true, template: '<i>client</i>' }) class ClientHome {}
@Component({ standalone: true, template: '<i>dead</i>' }) class Dead {}
@Component({ standalone: true, template: '<i>withdraw</i>' }) class Withdraw implements OnInit { private http = inject(HttpClient); constructor() { withdrawCreated++; } ngOnInit() { this.http.get('/api/marketer-overview/wallet').subscribe({ error: () => {} }); } }
@Component({ standalone: true, imports: [RouterOutlet], template: '<router-outlet />' }) class Shell {}
const routes: Routes = [
	{ path: 'client-overview', canActivate: [authGuard, clientGuard, serverActiveRoleGuard], runGuardsAndResolvers: 'always', component: Shell, children: [{ path: '', component: ClientHome }] },
	{ path: 'marketer-overview', canActivate: [authGuard, marketerGuard, serverActiveRoleGuard], runGuardsAndResolvers: 'always', component: Shell, children: [{ path: '', component: Dead }, { path: 'withdraw', component: Withdraw }, { path: '**', component: Dead }] },
	{ path: 'provider-overview', canActivate: [authGuard, providerGuard, serverActiveRoleGuard], runGuardsAndResolvers: 'always', component: Shell, children: [{ path: '', component: Dead }] },
];
const accountsUrl = (r: { url: string }) => r.url.endsWith('/user/available-account-types');
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('server role guard + AuthStore follow/redirect do not fight (N3)', () => {
	let store: AuthStore, router: Router, ctl: HttpTestingController, h: RouterTestingHarness, starts: string[], cancelled = 0;
	beforeEach(async () => {
		withdrawCreated = 0; localStorage.clear(); document.cookie = 'waseet_user=; Max-Age=0; path=/'; document.cookie = 'waseet_token=; Max-Age=0; path=/';
		TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
			{ provide: SERVER_ROLE_CHECK_TIMEOUT_MS, useValue: 500 },
			{ provide: UiNotificationService, useValue: { info: vi.fn(), showBanner: vi.fn(), error: vi.fn() } }] });
		store = TestBed.inject(AuthStore); router = TestBed.inject(Router); ctl = TestBed.inject(HttpTestingController);
		store.authenticate('tok', { id: 'u1', accountType: AccountType.MARKETING_BROKER, activeRole: UserRole.AFFILIATE, roles: [UserRole.AFFILIATE, UserRole.CLIENT] } as any);
		h = await RouterTestingHarness.create();
		const first = h.navigateByUrl('/marketer-overview/summary');
		await vi.waitFor(() => ctl.expectOne(accountsUrl).flush({ success: true, data: { activeRole: 'AFFILIATE' } }));
		await first;
		starts = []; cancelled = 0; router.events.subscribe(e => { if (e instanceof NavigationStart) starts.push(e.url); if (e instanceof NavigationCancel && e.code !== NavigationCancellationCode.Redirect) cancelled++; });
	});
	afterEach(() => TestBed.resetTestingModule());

	it('stale tab: the click ends on the client dashboard, the withdraw page never exists, one redirect (no duplicate navigation), the note is not stuck', async () => {
		const next = h.navigateByUrl('/marketer-overview/withdraw');
		await vi.waitFor(() => ctl.expectOne(accountsUrl).flush({ success: true, data: { activeRole: 'CLIENT' } }));
		for (let i = 0; i < 6; i++) { await wait(50); ctl.match(accountsUrl).filter(r => !r.cancelled).forEach(r => r.flush({ success: true, data: { activeRole: 'CLIENT' } })); }
		await next; await wait(600);
		expect(router.url).toBe('/client-overview');
		expect(withdrawCreated).toBe(0);
		expect(starts.filter(u => u === '/client-overview').length).toBeLessThanOrEqual(1);
		expect(starts.length).toBeLessThanOrEqual(2);
		expect(cancelled).toBe(0);
		expect(store.roleRedirect()).toBeNull();
		expect(store.actingRole()).toBe(UserRole.CLIENT);
		ctl.expectNone(r => r.url.includes('switch-active-role'));
	});

	it('read fails open while the server really is CLIENT: the withdraw page opens, its ROLE_MISMATCH 403 still reconciles (the older protection), note not stuck', async () => {
		const next = h.navigateByUrl('/marketer-overview/withdraw');
		await vi.waitFor(() => ctl.expectOne(accountsUrl).flush({}, { status: 429, statusText: 'x' }));
		await next;
		expect(withdrawCreated).toBe(1);
		ctl.expectOne('/api/marketer-overview/wallet').flush({ success: false, code: 'ROLE_MISMATCH', requiredRoles: ['AFFILIATE'], activeRole: 'CLIENT', canSwitch: true }, { status: 403, statusText: 'x' });
		await vi.waitFor(() => ctl.expectOne(accountsUrl).flush({ success: true, data: { activeRole: 'CLIENT' } }));
		await wait(700);
		expect(router.url).toBe('/client-overview');
		expect(store.roleRedirect()).toBeNull();
	});
});
