/// <reference types="node" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { Notifications } from './notifications';

const raw = (o: any = {}) => ({ id: 'n1', title: 'عنوان', message: 'رسالة', type: 'GENERAL', category: 'ALL', isRead: false, createdAt: new Date().toISOString(), ...o });

describe('marketer notifications: honest banner/groups/CTA/mark-all', () => {
	let fixture: ComponentFixture<Notifications>;
	let c: Notifications;
	let patch: ReturnType<typeof vi.fn>;
	let nav: ReturnType<typeof vi.spyOn>;

	async function mount(data: any, patchImpl?: () => any) {
		patch = vi.fn(patchImpl ?? (() => of({ success: true })));
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [Notifications],
			providers: [provideRouter([]), { provide: HttpClient, useValue: { get: (url: string) => /\/notifications/.test(String(url)) ? (data instanceof Error ? throwError(() => data) : of({ success: true, data })) : of({ success: false }), patch } }],
		}).compileComponents();
		fixture = TestBed.createComponent(Notifications);
		c = fixture.componentInstance;
		nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('no AI "recommendations" banner (nothing analyses the marketer\'s channels here)', () => {
		const html = readFileSync(join(__dirname, 'notifications.html'), 'utf8');
		expect(html).not.toContain('ai-disclosure');
		expect(html).not.toContain('توصيات آلية');
		expect(html).not.toContain('نحلّل أداء قنواتك');
	});

	it('empty API: empty state, 0 unread, only real groups (no AI chip)', async () => {
		const el = await mount([]);
		expect(el.textContent).toContain('لا توجد إشعارات');
		expect(el.textContent).toContain('لا توجد إشعارات غير مقروءة');
		expect(c.filters().map(f => f.id)).toEqual(['all', 'finance', 'general']);
	});

	it('groups come from the real category/type: PROJECTS is not AI, nothing falls under a fake "offers"', async () => {
		await mount([
			raw({ id: 'a', type: 'STAGE_DELIVERY', category: 'PROJECTS' }),
			raw({ id: 'b', type: 'FINANCIAL', category: 'FINANCIAL' }),
			raw({ id: 'c', type: 'GENERAL', category: 'ALL' }),
			raw({ id: 'd', type: 'CHAT', category: 'ALL', metadata: { conversationId: 'x' } }),
		]);
		expect(c.filterCount('all')).toBe(4);
		expect(c.filterCount('finance')).toBe(1);
		expect(c.filterCount('general')).toBe(3);
		expect(c.filterCount('ai')).toBe(0);
		expect(c.notifications().find(n => n.id === 'a')!.filterGroup).toBe('general');
	});

	it('AI chip and AI icon only for a real AI notification', async () => {
		const el = await mount([raw({ id: 'a' })]);
		expect(el.textContent).not.toContain('ذكاء AI');
		expect(c.notifications()[0].svgIcon).not.toContain('r="1.5"');
		TestBed.resetTestingModule();
		const el2 = await mount([raw({ id: 'z', category: 'AI' })]);
		expect(el2.textContent).toContain('ذكاء AI');
		expect(c.notifications()[0].svgIcon).toContain('r="1.5"');
	});

	it('mark all as read: success calls read-all; failure keeps the state and shows an error', async () => {
		const el = await mount([raw({ id: 'a' }), raw({ id: 'b' })]);
		(el.querySelector('[data-testid=mark-all-read]') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(String(patch.mock.calls[0][0])).toContain('/notifications/read-all');
		expect(c.unreadCount()).toBe(0);

		TestBed.resetTestingModule();
		const el2 = await mount([raw({ id: 'a' }), raw({ id: 'b' })], () => throwError(() => new Error('500')));
		(el2.querySelector('[data-testid=mark-all-read]') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(c.unreadCount()).toBe(2);
		expect(c.toastMessage()).toContain('تعذر');
	});

	it('CTA only with a real marketer target; foreign or missing URLs neither show a CTA nor navigate', async () => {
		const el = await mount([
			raw({ id: 'a', type: 'GENERAL', actionUrl: '/marketer-overview/profile', actionText: 'افتح الملف' }),
			raw({ id: 'b', type: 'GENERAL', actionUrl: '/provider-overview/offers', actionText: 'غريب', isRead: true }),
			raw({ id: 'c', type: 'GENERAL', actionText: 'بلا رابط', isRead: true }),
			raw({ id: 'd', type: 'CHAT', metadata: { conversationId: 'cv1' }, isRead: true }),
		]);
		expect(Array.from(el.querySelectorAll('[data-testid=nt-cta]')).map(x => x.textContent?.replace(/[»\s]+/g, ' ').trim())).toEqual(['افتح الملف']);
		c.onNotificationClick(c.notifications().find(n => n.id === 'b')!);
		c.onNotificationClick(c.notifications().find(n => n.id === 'c')!);
		expect(nav).not.toHaveBeenCalled();
		c.onNotificationClick(c.notifications().find(n => n.id === 'd')!);
		expect(nav).toHaveBeenCalledWith('/marketer-overview/messages?conversationId=cv1');
	});
});
