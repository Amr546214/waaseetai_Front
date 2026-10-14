import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { Sidebar, NavItem } from './sidebar';
import { AuthStore } from '../../../core/store/auth.store';
import { isOnboardingAllowedPath } from '../../../core/guards/profile-complete.guard';
import { ProviderAccessService } from '../../../core/services/provider-access.service';

const getSpy = vi.fn((_url?: string) => of({ success: true, data: { summary: { profileSetupCompleted: true, setupTestCompleted: true } } }));

function setup(accountType: string, access: any) {
	getSpy.mockClear();
	TestBed.configureTestingModule({
		imports: [Sidebar],
		providers: [
			provideRouter([]),
			{ provide: HttpClient, useValue: { get: (url: string) => getSpy(url) } },
			{ provide: AuthStore, useValue: { currentUser: signal<any>({ accountType }), token: signal('t') } },
			{ provide: ProviderAccessService, useValue: { load: () => access, latest: signal(null) } },
		],
	});
	const fixture = TestBed.createComponent(Sidebar);
	fixture.detectChanges();
	return (fixture.componentInstance.navItems() as NavItem[]).flatMap(i => [i, ...(i.children ?? [])]);
}
const st = (state: string, can = false) => of({ state, canAccessDashboard: can, message: '', reason: null, hasSample: false, specialties: [] });
const STATUS = '/provider-overview/accreditation-status';

describe('provider sidebar while the account is not approved', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('pending: the status link is there, dashboard/offers/wallet/marketing are disabled with an honest reason, onboarding links stay enabled', () => {
		const items = setup('PROVIDER_INDIVIDUAL', st('PENDING_REVIEW'));
		const by = (r: string) => items.find(i => i.route === r)!;
		expect(by(STATUS).disabled).toBeFalsy();
		for (const r of ['/provider-overview', '/provider-overview/offers', '/provider-overview/finance/wallet', '/provider-overview/marketing/center', '/provider-overview/business-models/market']) {
			expect(by(r).disabled).toBe(true);
			expect(by(r).disabledReason).toBe('تفتح بعد اعتماد نموذج الاعتماد');
		}
		for (const r of ['/provider-overview/business-models/accreditation/new', '/provider-overview/profile/data', '/provider-overview/help', '/provider-overview/notifications', '/provider-overview/settings/account']) {
			expect(by(r).disabled).toBeFalsy();
		}
	});
	it('request error: stays restricted (closed)', () => {
		const items = setup('PROVIDER_INDIVIDUAL', throwError(() => new Error('x')));
		expect(items.find(i => i.route === '/provider-overview/offers')!.disabled).toBe(true);
	});
	it('approved: full menu, no status restriction', () => {
		const items = setup('PROVIDER_INDIVIDUAL', st('APPROVED', true));
		expect(items.find(i => i.route === '/provider-overview/offers')!.disabled).toBeFalsy();
		expect(items.find(i => i.route === STATUS)).toBeUndefined();
	});
	it('company: untouched, no access-state use', () => {
		const items = setup('PROVIDER_COMPANY', st('PENDING_REVIEW'));
		expect(items.find(i => i.route === '/provider-overview/offers')!.disabled).toBeFalsy();
	});

	const statsCalls = () => getSpy.mock.calls.filter(c => String(c[0]).includes('/provider/statistics')).length;

	it('does NOT call the gated /provider/statistics while not approved, on error, or for pending (individual)', () => {
		setup('PROVIDER_INDIVIDUAL', st('PENDING_REVIEW'));
		expect(statsCalls()).toBe(0);
		TestBed.resetTestingModule();
		setup('PROVIDER_INDIVIDUAL', throwError(() => new Error('x')));
		expect(statsCalls()).toBe(0);
	});
	it('calls /provider/statistics for an approved individual and for a company', () => {
		setup('PROVIDER_INDIVIDUAL', st('APPROVED', true));
		expect(statsCalls()).toBe(1);
		TestBed.resetTestingModule();
		setup('PROVIDER_COMPANY', st('NOT_APPLICABLE', true));
		expect(statsCalls()).toBe(1);
	});
	it('while pending, the disabled links are exactly the complement of the onboarding allow-list', () => {
		const items = setup('PROVIDER_INDIVIDUAL', st('PENDING_REVIEW')).filter(i => i.type === 'link' && i.route);
		for (const i of items) {
			if (i.route === STATUS) { expect(i.disabled).toBeFalsy(); continue; }
			expect(!!i.disabled, i.route).toBe(!isOnboardingAllowedPath(i.route!));
		}
	});
});
