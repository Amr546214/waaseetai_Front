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

// "استكمال البيانات" in the client sidebar: shown while the profile is incomplete, gone at 100% (individual clients; companies untouched).
function setup(accountType: string, profileCompletionPercent?: number) {
	const user = signal<any>({ accountType, profileCompletionPercent });
	TestBed.configureTestingModule({
		imports: [Sidebar],
		providers: [
			provideRouter([]),
			{ provide: HttpClient, useValue: { get: () => of({ success: true, data: { summary: {} } }) } },
			{ provide: AuthStore, useValue: { currentUser: user, token: signal('t') } },
		],
	});
	const c = TestBed.createComponent(Sidebar).componentInstance;
	const routes = () => (c.navItems() as NavItem[]).flatMap(i => [i, ...(i.children ?? [])]).map(i => i.route);
	return { c, user, routes };
}
const SETUP = '/client-overview/profile-setup';

describe('client sidebar: استكمال البيانات follows the completion', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('incomplete (60%): the link is there', () => {
		expect(setup('CLIENT_INDIVIDUAL', 60).routes()).toContain(SETUP);
	});
	it('completion not known yet: the link is there', () => {
		expect(setup('CLIENT_INDIVIDUAL', undefined).routes()).toContain(SETUP);
	});
	it('100%: the link is gone, the edit page link stays', () => {
		const r = setup('CLIENT_INDIVIDUAL', 100).routes();
		expect(r).not.toContain(SETUP);
		expect(r).toContain('/client-overview/profile/edit');
	});
	it('it reacts when the completion reaches 100 after a save', () => {
		const { user, routes } = setup('CLIENT_INDIVIDUAL', 60);
		expect(routes()).toContain(SETUP);
		user.set({ accountType: 'CLIENT_INDIVIDUAL', profileCompletionPercent: 100 });
		expect(routes()).not.toContain(SETUP);
	});
	it('a company client is not touched by this rule', () => {
		expect(setup('CLIENT_COMPANY', 100).routes()).toContain(SETUP);
	});
});

// the sidebar follows the onboarding gate: locked items + the status badge in the place of «استكمال البيانات»
import { ClientOnboardingStateService } from '../../../core/services/client-onboarding-state.service';
describe('client sidebar: onboarding lock and status badge', () => {
	afterEach(() => TestBed.resetTestingModule());
	function gated(percent: number, canAdvance: boolean, kycStatus: string) {
		const user = signal<any>({ accountType: 'CLIENT_INDIVIDUAL', profileCompletionPercent: percent });
		TestBed.configureTestingModule({
			imports: [Sidebar],
			providers: [
				provideRouter([]),
				{ provide: HttpClient, useValue: { get: (u: string) => of({ success: true, data: u.endsWith('/identity') ? { canAdvance } : { completionPercentage: percent, kycStatus, summary: {} } }) } },
				{ provide: AuthStore, useValue: { currentUser: user, token: signal('t') } },
			],
		});
		const c = TestBed.createComponent(Sidebar).componentInstance;
		TestBed.inject(ClientOnboardingStateService).load(true).subscribe();
		const all = () => (c.navItems() as NavItem[]).flatMap(i => [i, ...(i.children ?? [])]);
		return { all };
	}
	it('unfinished: «استكمال البيانات» stays and the other pages are disabled', () => {
		const { all } = gated(35, false, 'PENDING');
		expect(all().map(i => i.route)).toContain(SETUP);
		const other = all().find(i => i.route === '/client-overview/profile/edit');
		expect(other?.disabled).toBe(true);
	});
	it('finished, waiting for the administration: the badge replaces «استكمال البيانات»', () => {
		const { all } = gated(100, true, 'PENDING');
		expect(all().map(i => i.route)).not.toContain(SETUP);
		expect(all().some(i => i.label === 'بانتظار اعتماد الإدارة')).toBe(true);
		expect(all().find(i => i.route === '/client-overview/profile/edit')?.disabled).toBeFalsy();
	});
	it('approved: «الهوية معتمدة»', () => {
		const { all } = gated(100, true, 'VERIFIED');
		expect(all().some(i => i.label === 'الهوية معتمدة')).toBe(true);
	});
});
