import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { Sidebar, NavItem } from './sidebar';
import { AuthStore } from '../../../core/store/auth.store';

// Individual provider sidebar: "استكمال البيانات" stays until the setup form AND the classification test are done.
function setup(accountType: string, summary: any) {
	TestBed.configureTestingModule({
		imports: [Sidebar],
		providers: [
			provideRouter([]),
			{ provide: HttpClient, useValue: { get: () => of({ success: true, data: { summary } }) } },
			{ provide: AuthStore, useValue: { currentUser: signal<any>({ accountType }), token: signal('t') } },
		],
	});
	const fixture = TestBed.createComponent(Sidebar);
	fixture.detectChanges();
	return () => (fixture.componentInstance.navItems() as NavItem[]).flatMap(i => [i, ...(i.children ?? [])]).map(i => i.route);
}
const SETUP = '/provider-overview/profile/setup';

describe('provider sidebar: استكمال البيانات', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('setup not finished: the link is there', () => {
		expect(setup('PROVIDER_INDIVIDUAL', { profileSetupCompleted: false, setupTestCompleted: false })()).toContain(SETUP);
	});
	it('form done but the test is not: the link stays (a step is left)', () => {
		expect(setup('PROVIDER_INDIVIDUAL', { profileSetupCompleted: true, setupTestCompleted: false })()).toContain(SETUP);
	});
	it('form AND test done: the link is gone, the profile edit link stays', () => {
		const routes = setup('PROVIDER_INDIVIDUAL', { profileSetupCompleted: true, setupTestCompleted: true })();
		expect(routes).not.toContain(SETUP);
		expect(routes).toContain('/provider-overview/profile/data');
	});
	it('a company provider is not touched by this rule', () => {
		expect(setup('PROVIDER_COMPANY', { profileSetupCompleted: true, setupTestCompleted: true })()).toContain(SETUP);
	});
});
