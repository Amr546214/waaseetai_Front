/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
vi.mock('socket.io-client', () => ({ default: () => fakeSocket, io: () => fakeSocket }));

import { Sidebar } from './sidebar/sidebar';
import { NavDashboard } from './nav-dashboard/nav-dashboard';
import { AuthStore } from '../../core/store/auth.store';
import { AccountService } from '../../core/services/account.service';
import { AccountType, UserRole } from '../../core/models/auth.model';

@Component({ selector: 'app-test-blank', template: '' })
class Blank {}

const CASES = [
	{ name: 'pure client', user: { accountType: AccountType.CLIENT_INDIVIDUAL, activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT] }, home: '/client-overview', area: '/client-overview' },
	{ name: 'provider acting as PROVIDER', user: { accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole: UserRole.PROVIDER, roles: [UserRole.PROVIDER, UserRole.CLIENT] }, home: '/provider-overview', area: '/provider-overview' },
	{ name: 'provider account acting as CLIENT', user: { accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole: UserRole.CLIENT, roles: [UserRole.PROVIDER, UserRole.CLIENT] }, home: '/client-overview', area: '/client-overview' },
	{ name: 'marketer', user: { accountType: AccountType.MARKETING_BROKER, activeRole: UserRole.AFFILIATE, roles: [UserRole.AFFILIATE, UserRole.CLIENT] }, home: '/marketer-overview', area: '/marketer-overview' },
	{ name: 'super admin', user: { accountType: AccountType.SUPER_ADMIN, activeRole: UserRole.SUPER_ADMIN, roles: [UserRole.SUPER_ADMIN] }, home: '/supper-admin-overview', area: '/supper-admin-overview' },
];

function configure(user: any) {
	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
	vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
	TestBed.configureTestingModule({
		imports: [Sidebar, NavDashboard],
		providers: [
			provideRouter([{ path: '**', component: Blank }]),
			{ provide: HttpClient, useValue: { get: () => of({ success: true, data: { summary: { profileSetupCompleted: true } } }), patch: () => of({ success: true }) } },
			{ provide: AuthStore, useValue: { currentUser: signal<any>({ firstName: 'ا', lastName: 'ب', ...user }), token: signal('t') } },
			{ provide: AccountService, useValue: { switchActiveRole: vi.fn() } },
		],
	});
}

describe('role-aware links (sidebar logo and top bar)', () => {
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	for (const c of CASES) {
		it(`${c.name}: the sidebar logo goes to ${c.home}, never to another role's area`, () => {
			configure(c.user);
			const f = TestBed.createComponent(Sidebar); f.detectChanges();
			const logo = (f.nativeElement as HTMLElement).querySelector('[data-testid="sidebar-logo"]') as HTMLAnchorElement;
			expect(logo.getAttribute('href')).toBe(c.home);
			expect(f.componentInstance.homeLink()).toBe(c.home);
		});

		it(`${c.name}: the top bar links (messages / profile / settings / add account) stay inside ${c.area}`, () => {
			configure(c.user);
			const f = TestBed.createComponent(NavDashboard); f.detectChanges();
			const links = f.componentInstance.links();
			for (const [k, v] of Object.entries(links)) expect(v.startsWith(c.area), `${c.name}.${k} = ${v}`).toBe(true);
			const el = f.nativeElement as HTMLElement;
			const messages = el.querySelector('[data-testid="topnav-messages"]') as HTMLAnchorElement;
			expect(messages.getAttribute('href')).toBe(links.messages);
			// every internal link rendered by the top bar belongs to this role's area (or is the public site)
			const hrefs = Array.from(el.querySelectorAll('a[href^="/"]')).map(a => a.getAttribute('href') as string).filter(h => h !== '/');
			const foreign = hrefs.filter(h => /^\/(client|provider|marketer|supper-admin)-overview/.test(h) && !h.startsWith(c.area));
			expect(foreign).toEqual([]);
		});
	}

	it('the marketer messages icon opens /marketer-overview/messages (not /client-overview/messages)', () => {
		configure(CASES[3].user);
		const f = TestBed.createComponent(NavDashboard); f.detectChanges();
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="topnav-messages"]')!.getAttribute('href')).toBe('/marketer-overview/messages');
	});
});

describe('static: no fixed role in shared navigation, tickets of the provider stay in the provider area', () => {
	const APP = join(__dirname, '../..');
	const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');

	it('the shared sidebar logo is not hard-coded to any role', () => {
		const html = read('sheards/dashboard/sidebar/sidebar.html');
		expect(html).toContain('[routerLink]="homeLink()"');
		expect(html).not.toMatch(/<a routerLink="\/(client|provider|marketer)-overview"[^>]*aria-label="وسيط AI"/);
	});

	it('the top bar and the site navbar have no "provider ? provider : client" ternaries left', () => {
		for (const f of ['sheards/dashboard/nav-dashboard/nav-dashboard.html', 'sheards/navbar/navbar.html']) {
			const html = read(f);
			expect(html, f).not.toMatch(/activeRole\(\) === UserRole\.PROVIDER \?/);
			expect(html, f).not.toContain("'/client-overview");
		}
	});

	it('provider ticket pages: back / cancel / related project never point to the client area, for individuals and companies alike', () => {
		for (const f of ['pages/dashboard/provider-overview/help/new-ticket/new-ticket.html', 'pages/dashboard/provider-overview/help/ticket-detail/ticket-detail.html']) {
			const html = read(f);
			expect(html, f).not.toContain('/client-overview');
			expect(html, f).not.toMatch(/isCompanyMode\(\) \?[^"]*\/(client|provider)-overview/);
			expect(html, f).toContain('routerLink="/provider-overview/help"');
		}
		expect(read('pages/dashboard/provider-overview/help/ticket-detail/ticket-detail.html')).toContain('routerLink="/provider-overview/projects/active"');
	});

	it('the route guards decide by the active role (resolveRoleStrict), not by the account type', () => {
		const src = read('core/guards/auth.guards.ts');
		expect(src).toContain('resolveRoleStrict(user) === UserRole.CLIENT');
		expect(src).toContain('resolveRoleStrict(user) === UserRole.PROVIDER');
		expect(src).toContain('resolveRoleStrict(user) === UserRole.AFFILIATE');
		expect(src).not.toMatch(/user\.accountType === AccountType\.(CLIENT_INDIVIDUAL|PROVIDER_INDIVIDUAL|MARKETING_BROKER)/);
	});
});
