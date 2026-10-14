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
import { ProviderAccessService } from '../../../core/services/provider-access.service';

function setup(accountType: string, access: any) {
	TestBed.configureTestingModule({
		imports: [Sidebar],
		providers: [
			provideRouter([]),
			{ provide: HttpClient, useValue: { get: () => of({ success: true, data: { summary: { profileSetupCompleted: true, setupTestCompleted: true } } }) } },
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
});
