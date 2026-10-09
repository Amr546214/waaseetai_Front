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
import { MarketerProfileService } from '../../../core/services/marketer-profile.service';

const SETUP = '/marketer-overview/profile-setup';
const item = (key: string, status = 'missing') => ({ key, status });
function setup(profileData: any | 'error') {
	TestBed.configureTestingModule({
		imports: [Sidebar],
		providers: [
			provideRouter([]),
			{ provide: HttpClient, useValue: { get: (url: string) => (/marketer\/profile$/.test(url) ? (profileData === 'error' ? of({ success: false }) : of({ success: true, data: profileData })) : of({ success: true, data: { summary: {} } })) } },
			{ provide: AuthStore, useValue: { currentUser: signal<any>({ accountType: 'MARKETING_BROKER', activeRole: 'AFFILIATE', roles: ['AFFILIATE'] }), token: signal('t') } },
		],
	});
	const f = TestBed.createComponent(Sidebar);
	f.detectChanges();
	return { routes: () => (f.componentInstance.navItems() as NavItem[]).flatMap(i => [i, ...(i.children ?? [])]).map(i => i.route), svc: TestBed.inject(MarketerProfileService) };
}

describe('marketer sidebar: استكمال البيانات', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('something still to collect (channel + bank missing): the link is there', () => {
		expect(setup({ completionPercentage: 40, missingItems: [item('channel'), item('payout')] }).routes()).toContain(SETUP);
	});
	it('100%: the link is gone, the profile link stays', () => {
		const r = setup({ completionPercentage: 100, missingItems: [] }).routes();
		expect(r).not.toContain(SETUP);
		expect(r).toContain('/marketer-overview/profile/data');
	});
	it('only a bank request under review is left: no link (pending is not missing)', () => {
		expect(setup({ completionPercentage: 70, missingItems: [item('payout', 'pending_review')] }).routes()).not.toContain(SETUP);
	});
	it('profile not readable (unknown): the link stays', () => {
		expect(setup('error').routes()).toContain(SETUP);
	});
	it('it follows the profile any page reads (e.g. after the last wizard step)', () => {
		const { routes, svc } = setup({ completionPercentage: 40, missingItems: [item('channel')] });
		expect(routes()).toContain(SETUP);
		svc.profileSnapshot.set({ completionPercentage: 100, missingItems: [] } as any);
		expect(routes()).not.toContain(SETUP);
	});
});
