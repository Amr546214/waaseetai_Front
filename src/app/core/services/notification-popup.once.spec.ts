import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
(globalThis as any).__socketIoModule = () => ({ default: () => fakeSocket, io: () => fakeSocket });

import { NotificationEngineService } from './notification-engine.service';
import { NotificationPopupLedger, POPUP_LEDGER_MAX } from './notification-popup-ledger.service';

const n = (id: string, at = '2026-10-16T10:00:00.000Z') => ({ id, title: 't' + id, message: 'm', createdAt: at, isRead: false, actionUrl: '/client-overview/notifications' });

describe('notification popup: once per user, never reads', () => {
	let engine: NotificationEngineService; let http: HttpTestingController; let ledger: NotificationPopupLedger;
	const setUser = (id: string | null) => { (engine as any).joinedUserId = id; };
	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		engine = TestBed.inject(NotificationEngineService); http = TestBed.inject(HttpTestingController); ledger = TestBed.inject(NotificationPopupLedger);
		setUser('u1');
	});
	afterEach(() => { vi.useRealTimers(); http.verify(); TestBed.resetTestingModule(); });

	it('(a) one popup per id across duplicate events, a new engine (page refresh) and a reconnect', () => {
		engine.popup(n('a')); expect(engine.latestNotification()?.id).toBe('a');
		engine.closeToast(); engine.latestNotification.set(null);
		engine.popup(n('a')); // duplicated event
		expect(engine.showToast()).toBe(false);
		// refresh: a brand-new service instance with an empty in-memory state but the same browser storage
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		const fresh = TestBed.inject(NotificationEngineService); (fresh as any).joinedUserId = 'u1';
		fresh.popup(n('a')); expect(fresh.showToast()).toBe(false);
		fresh.popup(n('b')); expect(fresh.latestNotification()?.id).toBe('b');
		http = TestBed.inject(HttpTestingController);
	});

	it('(a) a reconnect recovery that returns an already-announced id does not pop it again, but a genuinely new one pops', () => {
		engine.recoverMissed(); // first recovery of the page: backlog only
		http.expectOne(r => r.url.endsWith('/notifications')).flush({ success: true, data: [n('old1'), n('old2')], unreadCount: 2 });
		expect(engine.showToast()).toBe(false);
		engine.popup(n('live')); engine.closeToast();
		engine.recoverMissed(); // reconnect; the server repeats the row
		http.expectOne(r => r.url.endsWith('/notifications')).flush({ success: true, data: [n('live')], unreadCount: 3 });
		expect(engine.showToast()).toBe(false);
		engine.recoverMissed();
		http.expectOne(r => r.url.endsWith('/notifications')).flush({ success: true, data: [n('missed', '2026-10-16T11:00:00.000Z')], unreadCount: 4 });
		expect(engine.latestNotification()?.id).toBe('missed');
	});

	it('(b) shown, expired and closed popups never call a read endpoint and leave the counter alone', () => {
		vi.useFakeTimers();
		engine.unreadCount.set(3);
		engine.popup(n('x'));
		expect(engine.showToast()).toBe(true);
		engine.closeToast(); expect(engine.showToast()).toBe(false);
		engine.popup(n('y')); vi.advanceTimersByTime(7100); expect(engine.showToast()).toBe(false);
		http.expectNone(r => r.url.includes('/read'));
		expect(engine.unreadCount()).toBe(3);
		expect(engine.realtimeReadNotification()).toBeNull();
	});

	it('(c) loading the old unread list (first recovery, a list read) shows no popup at all, and marks them handled', () => {
		engine.recoverMissed();
		http.expectOne(r => r.url.endsWith('/notifications')).flush({ success: true, data: [n('o1'), n('o2'), n('o3')], unreadCount: 3 });
		expect(engine.showToast()).toBe(false);
		expect(engine.unreadCount()).toBe(3);
		engine.fetchNotifications().subscribe();
		http.expectOne(r => r.url.endsWith('/notifications')).flush({ success: true, data: [n('o4')] });
		expect(engine.showToast()).toBe(false);
		// even if one of those ids is pushed live later (replay), it is not announced
		engine.popup(n('o1')); expect(engine.showToast()).toBe(false);
	});

	it('(d) account isolation: another user has its own list; switching clears the previous account\'s popup', () => {
		engine.popup(n('a')); expect(engine.showToast()).toBe(true);
		engine.disconnect(); setUser('u2');
		expect(engine.showToast()).toBe(false); expect(engine.latestNotification()).toBeNull();
		engine.popup(n('a')); // same id, different user: its own first time
		expect(engine.latestNotification()?.id).toBe('a');
		engine.closeToast();
		setUser('u1'); engine.popup(n('a')); expect(engine.showToast()).toBe(false); // u1 already had it
		expect(localStorage.getItem('ws.notif.popped.v1.u1')).toBe('["a"]');
		expect(localStorage.getItem('ws.notif.popped.v1.u2')).toBe('["a"]');
	});

	it('a coalesced update is a new event once, never twice; role switch (same user) keeps the list', () => {
		engine.popup(n('c', '2026-10-16T10:00:00.000Z')); engine.closeToast();
		engine.popup(n('c', '2026-10-16T10:05:00.000Z'), true); expect(engine.showToast()).toBe(true); engine.closeToast();
		engine.popup(n('c', '2026-10-16T10:05:00.000Z'), true); expect(engine.showToast()).toBe(false);
	});

	it('a hidden tab does not use up the popup; the visible one shows it once', () => {
		const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
		engine.popup(n('h')); expect(engine.showToast()).toBe(false); expect(ledger.has('u1', 'h')).toBe(false);
		spy.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange'));
		expect(engine.latestNotification()?.id).toBe('h'); expect(ledger.has('u1', 'h')).toBe(true);
		spy.mockRestore();
	});

	it('another tab claiming first (shared storage) means this tab does not pop; the ledger is bounded', () => {
		localStorage.setItem('ws.notif.popped.v1.u1', JSON.stringify(['t1']));
		engine.popup(n('t1')); expect(engine.showToast()).toBe(false);
		for (let i = 0; i < POPUP_LEDGER_MAX + 20; i++) ledger.claim('u9', 'k' + i);
		expect(JSON.parse(localStorage.getItem('ws.notif.popped.v1.u9')!).length).toBe(POPUP_LEDGER_MAX);
		expect(ledger.has('u9', 'k0')).toBe(false);
	});

	it('id-less notifications (local guard hints) still show', () => {
		engine.popup({ title: 'x', message: 'y' }); expect(engine.showToast()).toBe(true);
	});

	it('onPopupMarkedRead lowers the counter (floor 0) and tells the lists', () => {
		engine.unreadCount.set(1); engine.onPopupMarkedRead('z'); engine.onPopupMarkedRead('z');
		expect(engine.unreadCount()).toBe(0); expect(engine.realtimeReadNotification()).toBe('z');
	});
});
