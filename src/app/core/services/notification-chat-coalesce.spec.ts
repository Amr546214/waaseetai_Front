import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

// socket.io-client is mocked at the module boundary; every handler the engine registers is captured so the server's pushes can be replayed.
const handlers: Record<string, (d: any) => void> = {};
const fakeSocket = { connected: false, on: vi.fn((e: string, h: any) => { handlers[e] = h; }), emit: vi.fn(), disconnect: vi.fn() };
vi.mock('socket.io-client', () => ({ default: () => fakeSocket, io: () => fakeSocket }));

import { NotificationEngineService } from './notification-engine.service';
import { NotificationSoundService } from './notification-sound.service';
import { NotificationNavigator } from './notification-navigator.service';
import { AccountService } from './account.service';
import { UiNotificationService } from './ui-notification.service';
import { NotificationBell } from '../../sheards/notification-bell/notification-bell';
import { AuthStore } from '../store/auth.store';

const T0 = '2026-10-19T10:00:00.000Z', T1 = '2026-10-19T10:01:00.000Z', T2 = '2026-10-19T10:02:00.000Z';
const projectChat = (over: any = {}) => ({ id: 'n1', type: 'CHAT', category: 'PROJECTS', title: 'رسالة جديدة في المشروع', message: 'msg 1', isRead: false, createdAt: T0, actionUrl: '/provider-overview/projects/active/progress/k1?tab=messages', metadata: { conversationId: 'c1', contractId: 'k1', context: 'PROJECT', unreadCount: 1 }, ...over });
const generalChat = (over: any = {}) => ({ id: 'g1', type: 'CHAT', title: 'رسالة تفاوض جديدة', message: 'hello', isRead: false, createdAt: T0, actionUrl: '/provider-overview/messages?conversationId=c9', metadata: { conversationId: 'c9', unreadCount: 1 }, ...over });
const provider = { accountType: 'PROVIDER_INDIVIDUAL', activeRole: 'PROVIDER', roles: ['PROVIDER'] };

function engineSetup() {
	TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: NotificationSoundService, useValue: { playPopSound: () => undefined } }, { provide: HttpClient, useValue: { get: () => of({ success: true, data: [] }), patch: () => of({ success: true }) } }, { provide: AuthStore, useValue: { currentUser: signal(provider), token: signal('t') } }] });
	const engine = TestBed.inject(NotificationEngineService);
	engine.initSocket('u1');
	return engine;
}

describe('chat notification coalescing: engine counter + replace semantics', () => {
	beforeEach(() => { for (const k of Object.keys(handlers)) delete handlers[k]; });
	afterEach(() => TestBed.resetTestingModule());

	it('a new row counts once; a coalesced update of the SAME id replaces it and never moves the bell counter', () => {
		const engine = engineSetup();
		handlers['new_notification'](projectChat());
		expect(engine.unreadCount()).toBe(1);
		const seen: any[] = [];
		const orig = engine.realtimeUpdatedNotification.set.bind(engine.realtimeUpdatedNotification);
		engine.realtimeUpdatedNotification.set = (v: any) => { seen.push(v); orig(v); };
		handlers['notification_updated'](projectChat({ message: 'msg 2', createdAt: T1, metadata: { conversationId: 'c1', contractId: 'k1', context: 'PROJECT', unreadCount: 2 } }));
		handlers['notification_updated'](projectChat({ message: 'msg 3', createdAt: T2, metadata: { conversationId: 'c1', contractId: 'k1', context: 'PROJECT', unreadCount: 3 } }));
		expect(engine.unreadCount()).toBe(1);
		expect(seen.map(s => s.message)).toEqual(['msg 2', 'msg 3']);
		// a replay of an older / equal update (reconnect, double delivery) changes nothing
		handlers['notification_updated'](projectChat({ message: 'msg 2', createdAt: T1 }));
		expect(seen.length).toBe(2); expect(engine.unreadCount()).toBe(1);
	});
	it('an update for a row the client never held (missed while offline) is a new unread row: counted once', () => {
		const engine = engineSetup();
		handlers['notification_updated'](generalChat({ createdAt: T1 }));
		expect(engine.unreadCount()).toBe(1);
		handlers['notification_updated'](generalChat({ createdAt: T2 }));
		expect(engine.unreadCount()).toBe(1);
	});
	it('recovery after a reconnect replaces a held row that was updated while offline and sets the exact server counter', () => {
		const engine = engineSetup();
		handlers['new_notification'](projectChat());
		const get = vi.fn(() => of({ success: true, data: [projectChat({ message: 'msg 7', createdAt: T2, metadata: { conversationId: 'c1', context: 'PROJECT', unreadCount: 7 } })], unreadCount: 1 }));
		(TestBed.inject(HttpClient) as any).get = get;
		engine.recoverMissed();
		expect(engine.realtimeUpdatedNotification()?.message).toBe('msg 7');
		expect(engine.unreadCount()).toBe(1);
	});
});

describe('chat notification link correctness (project room vs general)', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('a PROJECT-room chat notification opens that project\'s messages tab for the provider and the client; a general one opens the conversation', () => {
		const engine = engineSetup();
		expect(engine.resolveNotificationTarget(projectChat(), '/provider-overview')).toBe('/provider-overview/projects/active/progress/k1?tab=messages');
		expect(engine.resolveNotificationTarget(projectChat({ actionUrl: '/client-overview/projects/p1?tab=messages' }), '/client-overview')).toBe('/client-overview/projects/p1?tab=messages');
		expect(engine.resolveNotificationTarget(generalChat(), '/provider-overview')).toBe('/provider-overview/messages?conversationId=c9');
		expect(engine.resolveNotificationTarget(generalChat({ actionUrl: undefined }), '/client-overview')).toBe('/client-overview/messages?conversationId=c9');
	});
	it('the link is identical before and after coalescing (same actionUrl in every update)', () => {
		const engine = engineSetup();
		const before = engine.mapToAppNotification(projectChat(), '/provider-overview').actionUrl;
		const after = engine.mapToAppNotification(projectChat({ message: 'msg 9', createdAt: T2, title: 'رسالة جديدة في المشروع (9)', metadata: { conversationId: 'c1', contractId: 'k1', context: 'PROJECT', unreadCount: 9 } }), '/provider-overview').actionUrl;
		expect(after).toBe(before);
	});
	it('a project link from another role\'s dashboard is not trusted as a destination (falls back to the conversation link)', () => {
		const engine = engineSetup();
		expect(engine.resolveNotificationTarget(projectChat({ actionUrl: '/marketer-overview/x?tab=messages' }), '/provider-overview')).toBe('/provider-overview/messages?conversationId=c1');
	});
});

describe('bell list + click after read and after coalescing', () => {
	afterEach(() => TestBed.resetTestingModule());

	function bellSetup(rows: any[]) {
		const patch = vi.fn(() => of({ success: true }));
		TestBed.configureTestingModule({ imports: [NotificationBell], providers: [
			provideRouter([]),
			{ provide: NotificationSoundService, useValue: { playPopSound: () => undefined } },
			{ provide: HttpClient, useValue: { get: () => of({ success: true, data: rows }), patch } },
			{ provide: AuthStore, useValue: { currentUser: signal(provider), token: signal('t') } },
			{ provide: AccountService, useValue: { switchActiveRole: vi.fn(() => of({})) } },
			{ provide: UiNotificationService, useValue: { info: vi.fn(), warning: vi.fn(), error: vi.fn(), success: vi.fn() } },
		] });
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		const fixture = TestBed.createComponent(NotificationBell);
		fixture.detectChanges();
		const engine = TestBed.inject(NotificationEngineService);
		return { fixture, component: fixture.componentInstance, engine, navigate, patch, nav: TestBed.inject(NotificationNavigator) };
	}

	it('a coalesced update replaces the row in the list (one row, latest text, moved to the top), the link is unchanged', () => {
		const { fixture, component, engine } = bellSetup([generalChat(), projectChat()]);
		component.toggle(); fixture.detectChanges();
		expect(component.notifications().length).toBe(2);
		engine.realtimeUpdatedNotification.set(projectChat({ message: 'msg 4', createdAt: T2, title: 'رسالة جديدة في المشروع (4)', metadata: { conversationId: 'c1', contractId: 'k1', context: 'PROJECT', unreadCount: 4 } }));
		fixture.detectChanges();
		const list = component.notifications();
		expect(list.length).toBe(2);
		expect(list[0].id).toBe('n1'); expect(list[0].message).toBe('msg 4'); expect(list[0].isUnread).toBe(true);
		expect(list[0].actionUrl).toBe('/provider-overview/projects/active/progress/k1?tab=messages');
	});

	it('clicking opens the right project tab after coalescing; clicking again (now read) still opens it; a NEW row after read opens the same place', async () => {
		const { fixture, component, engine, navigate, nav } = bellSetup([projectChat()]);
		component.toggle(); fixture.detectChanges();
		engine.realtimeUpdatedNotification.set(projectChat({ message: 'msg 2', createdAt: T1, metadata: { conversationId: 'c1', contractId: 'k1', context: 'PROJECT', unreadCount: 2 } }));
		fixture.detectChanges();
		const row = component.notifications()[0];
		expect(await nav.open(row)).toBe('navigated');
		expect(navigate).toHaveBeenLastCalledWith('/provider-overview/projects/active/progress/k1?tab=messages', { onSameUrlNavigation: 'reload' });
		expect(await nav.open({ ...row, isUnread: false })).toBe('navigated'); // second click, already read
		expect(navigate).toHaveBeenCalledTimes(2);
		// the next message after the read created a new row with a new id: same destination
		const fresh = engine.mapToAppNotification(projectChat({ id: 'n2', createdAt: T2 }), '/provider-overview');
		expect(await nav.open(fresh)).toBe('navigated');
		expect(navigate).toHaveBeenLastCalledWith('/provider-overview/projects/active/progress/k1?tab=messages', { onSameUrlNavigation: 'reload' });
	});

	it('a general conversation row opens that conversation after coalescing', async () => {
		const { fixture, component, engine, navigate, nav } = bellSetup([generalChat()]);
		component.toggle(); fixture.detectChanges();
		engine.realtimeUpdatedNotification.set(generalChat({ message: 'again', createdAt: T1, metadata: { conversationId: 'c9', unreadCount: 2 } }));
		fixture.detectChanges();
		await nav.open(component.notifications()[0]);
		expect(navigate).toHaveBeenLastCalledWith('/provider-overview/messages?conversationId=c9', { onSameUrlNavigation: 'reload' });
	});
});
