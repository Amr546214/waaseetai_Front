import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
vi.mock('socket.io-client', () => ({ default: () => fakeSocket, io: () => fakeSocket }));

import { NotificationNavigator } from './notification-navigator.service';
import { NotificationEngineService } from './notification-engine.service';
import { AccountService } from './account.service';
import { UiNotificationService } from './ui-notification.service';
import { AuthStore } from '../store/auth.store';

function setup(user: any, over: { markRead?: any; navigate?: any; switchRole?: any } = {}) {
	const markRead = over.markRead ?? vi.fn(() => of({ success: true }));
	const navigate = over.navigate ?? vi.fn(async () => true);
	const switchRole = over.switchRole ?? vi.fn(() => of({ success: true }));
	const ui = { info: vi.fn(), warning: vi.fn(), error: vi.fn(), success: vi.fn() };
	TestBed.configureTestingModule({ providers: [
		{ provide: Router, useValue: { navigateByUrl: navigate } },
		{ provide: AuthStore, useValue: { currentUser: signal(user) } },
		{ provide: AccountService, useValue: { switchActiveRole: switchRole } },
		{ provide: NotificationEngineService, useValue: { markNotificationAsRead: markRead } },
		{ provide: UiNotificationService, useValue: ui },
	] });
	return { nav: TestBed.inject(NotificationNavigator), markRead, navigate, switchRole, ui };
}
const client = { accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT', roles: ['CLIENT'] };
const both = { accountType: 'PROVIDER_INDIVIDUAL', activeRole: 'CLIENT', roles: ['CLIENT', 'PROVIDER'] };

describe('NotificationNavigator (click behaviour)', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('unread: opens the destination AND marks read; the read update never gates navigation', async () => {
		const s = setup(client);
		const onMarkedRead = vi.fn();
		expect(await s.nav.open({ id: 'n1', isUnread: true, actionUrl: '/client-overview/projects/p1' }, { onMarkedRead })).toBe('navigated');
		expect(s.markRead).toHaveBeenCalledWith('n1'); expect(onMarkedRead).toHaveBeenCalled();
		expect(s.navigate).toHaveBeenCalledWith('/client-overview/projects/p1', { onSameUrlNavigation: 'reload' });
	});
	it('already read: no read call, still opens', async () => {
		const s = setup(client);
		expect(await s.nav.open({ id: 'n1', isUnread: false, actionUrl: '/client-overview/projects/p1' })).toBe('navigated');
		expect(s.markRead).not.toHaveBeenCalled(); expect(s.navigate).toHaveBeenCalledTimes(1);
	});
	it('mark-read FAILS: navigation still happens and the row simply stays unread', async () => {
		const s = setup(client, { markRead: vi.fn(() => throwError(() => new Error('500'))) });
		const onMarkedRead = vi.fn();
		expect(await s.nav.open({ id: 'n1', isUnread: true, actionUrl: '/client-overview/projects/p1' }, { onMarkedRead })).toBe('navigated');
		expect(onMarkedRead).not.toHaveBeenCalled(); expect(s.navigate).toHaveBeenCalled();
	});
	it('the same notification clicked twice opens twice (same URL re-applied, no dedupe of clicks)', async () => {
		const s = setup(client);
		const nt = { id: 'n1', isUnread: false, actionUrl: '/client-overview/projects/p1?tab=messages' };
		await s.nav.open(nt); await s.nav.open(nt);
		expect(s.navigate).toHaveBeenCalledTimes(2);
		expect(s.navigate.mock.calls[1][1]).toEqual({ onSameUrlNavigation: 'reload' });
	});
	it('no destination: an honest message, no navigation', async () => {
		const s = setup(client);
		expect(await s.nav.open({ id: 'n1', isUnread: false, actionUrl: null })).toBe('no-destination');
		expect(s.ui.info).toHaveBeenCalled(); expect(s.navigate).not.toHaveBeenCalled();
	});
	it('a destination the router refuses (guard) or fails on shows a reason', async () => {
		const refused = setup(client, { navigate: vi.fn(async () => false) });
		expect(await refused.nav.open({ id: 'n', isUnread: false, actionUrl: '/client-overview/projects/gone' })).toBe('blocked');
		expect(refused.ui.warning).toHaveBeenCalled();
		TestBed.resetTestingModule();
		const failed = setup(client, { navigate: vi.fn(async () => { throw new Error('x'); }) });
		expect(await failed.nav.open({ id: 'n', isUnread: false, actionUrl: '/client-overview/projects/gone' })).toBe('failed');
		expect(failed.ui.error).toHaveBeenCalled();
	});
	it('another role\'s area the account does NOT own: refused with a reason, no switch call, no navigation', async () => {
		const s = setup(client);
		expect(await s.nav.open({ id: 'n', isUnread: false, actionUrl: '/provider-overview/offers' })).toBe('role-unavailable');
		expect(s.switchRole).not.toHaveBeenCalled(); expect(s.navigate).not.toHaveBeenCalled(); expect(s.ui.warning).toHaveBeenCalled();
	});
	it('another role\'s area the account owns: says so, calls the real switch, then opens', async () => {
		const s = setup(both);
		expect(await s.nav.open({ id: 'n', isUnread: false, actionUrl: '/provider-overview/offers' })).toBe('role-switched');
		expect(s.ui.info).toHaveBeenCalled(); expect(s.switchRole).toHaveBeenCalledWith('PROVIDER');
		expect(s.navigate).toHaveBeenCalledWith('/provider-overview/offers', { onSameUrlNavigation: 'reload' });
	});
	it('a failed role switch opens nothing and says why; the admin area is never reachable by a switch', async () => {
		const s = setup(both, { switchRole: vi.fn(() => throwError(() => ({ error: { message: 'مرفوض' } }))) });
		expect(await s.nav.open({ id: 'n', isUnread: false, actionUrl: '/provider-overview/offers' })).toBe('failed');
		expect(s.navigate).not.toHaveBeenCalled(); expect(s.ui.error).toHaveBeenCalledWith('مرفوض');
		TestBed.resetTestingModule();
		const admin = setup(both);
		expect(await admin.nav.open({ id: 'n', isUnread: false, actionUrl: '/supper-admin-overview/disputes/1' })).toBe('role-unavailable');
	});
});
