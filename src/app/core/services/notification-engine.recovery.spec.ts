import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
(globalThis as any).__socketIoModule = () => ({ default: () => fakeSocket, io: () => fakeSocket });

import { NotificationEngineService } from './notification-engine.service';

const n = (id: string, at: string) => ({ id, title: id, message: 'm', createdAt: at, isRead: false });

describe('NotificationEngineService: reconnect recovery + de-duplication', () => {
	let engine: NotificationEngineService; let http: HttpTestingController;
	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		engine = TestBed.inject(NotificationEngineService); http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => { http.verify(); TestBed.resetTestingModule(); });

	it('registerArrival: a second arrival of the same id is a duplicate', () => {
		expect(engine.registerArrival(n('a', '2026-10-15T10:00:00.000Z'))).toBe(true);
		expect(engine.registerArrival(n('a', '2026-10-15T10:00:00.000Z'))).toBe(false);
		expect(engine.registerArrival({ title: 'no id' } as any)).toBe(true);
	});
	it('recovery asks for unread (+ since = the newest held) and announces only what is new; the counter becomes the server total', () => {
		engine.registerArrival(n('old', '2026-10-15T10:00:00.000Z'));
		const shown: string[] = [];
		const orig = engine.realtimeNewNotification.set.bind(engine.realtimeNewNotification);
		engine.realtimeNewNotification.set = (v: any) => { shown.push(v.id); orig(v); };
		engine.recoverMissed();
		const req = http.expectOne(r => r.url.endsWith('/notifications'));
		expect(req.request.params.get('unreadOnly')).toBe('true'); expect(req.request.params.get('since')).toBe('2026-10-15T10:00:00.000Z');
		// the server answers newest-first and repeats the held tie row
		req.flush({ success: true, data: [n('b', '2026-10-15T10:05:00.000Z'), n('a', '2026-10-15T10:02:00.000Z'), n('old', '2026-10-15T10:00:00.000Z')], unreadCount: 7 });
		expect(shown).toEqual(['a', 'b']);
		expect(engine.unreadCount()).toBe(7);
		// a second recovery with the same payload (flapping connection) shows nothing again
		shown.length = 0; engine.recoverMissed();
		http.expectOne(r => r.url.endsWith('/notifications')).flush({ success: true, data: [n('b', '2026-10-15T10:05:00.000Z')], unreadCount: 7 });
		expect(shown).toEqual([]);
	});
	it('a failed recovery changes nothing', () => {
		engine.unreadCount.set(3); engine.recoverMissed();
		http.expectOne(r => r.url.endsWith('/notifications')).flush('x', { status: 500, statusText: 'err' });
		expect(engine.unreadCount()).toBe(3);
	});
	it('a list read marks its rows as held, so a later push of the same id is not counted again', () => {
		engine.fetchNotifications().subscribe();
		http.expectOne(r => r.url.endsWith('/notifications')).flush({ success: true, data: [n('x', '2026-10-15T09:00:00.000Z')] });
		expect(engine.registerArrival(n('x', '2026-10-15T09:00:00.000Z'))).toBe(false);
	});
});
