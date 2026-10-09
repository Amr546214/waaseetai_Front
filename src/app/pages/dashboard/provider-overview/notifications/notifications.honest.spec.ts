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
const unwrap = (v: unknown) => (v as any)?.changingThisBreaksApplicationSecurity ?? String(v);

describe('provider notifications: honest banner/counters/CTA/mark-all', () => {
	let fixture: ComponentFixture<Notifications>;
	let c: Notifications;
	let patch: ReturnType<typeof vi.fn>;
	let nav: ReturnType<typeof vi.spyOn>;

	async function mount(data: any, patchImpl?: () => any) {
		patch = vi.fn(patchImpl ?? (() => of({ success: true })));
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [Notifications],
			providers: [provideRouter([]), { provide: HttpClient, useValue: { get: () => data instanceof Error ? throwError(() => data) : of({ success: true, data }), patch } }],
		}).compileComponents();
		fixture = TestBed.createComponent(Notifications);
		c = fixture.componentInstance;
		nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('no false "automatic ranking" AI banner and no hard-coded notification in the page', () => {
		const html = readFileSync(join(__dirname, 'notifications.html'), 'utf8');
		expect(html).not.toContain('ترتيب تلقائي');
		expect(html).not.toContain('تُرتَّب إشعاراتك تلقائياً');
	});

	it('empty API: empty state, 0 unread, no AI chip', async () => {
		const el = await mount([]);
		expect(el.textContent).toContain('لا توجد إشعارات');
		expect(el.textContent).toContain('لا توجد إشعارات غير مقروءة');
		expect(Array.from(el.querySelectorAll('.filter-chip')).map(b => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['الكل0', 'عروض0', 'مشاريع0', 'مالية0']);
	});

	it('counters come from the data (type decides the bucket for a generic category)', async () => {
		await mount([
			raw({ id: 'a', type: 'OFFER_ACCEPTED', category: 'ALL', metadata: { offerId: 'o1' } }),
			raw({ id: 'b', type: 'PROJECT_MATCH', category: 'PROJECTS', isRead: true, metadata: { clientRequestId: 'r1' } }),
			raw({ id: 'c', type: 'FINANCIAL', category: 'FINANCIAL' }),
		]);
		expect(c.unreadCount()).toBe(2);
		expect(c.filterCount('offers')).toBe(1);
		expect(c.filterCount('projects')).toBe(1);
		expect(c.filterCount('finance')).toBe(1);
		expect(c.filterCount('ai')).toBe(0);
	});

	it('mark all as read: success calls read-all and zeroes the counters; failure fakes nothing', async () => {
		const el = await mount([raw({ id: 'a' }), raw({ id: 'b' })]);
		(el.querySelector('[data-testid=mark-all-read]') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(String(patch.mock.calls[0][0])).toContain('/notifications/read-all');
		expect(c.unreadCount()).toBe(0);

		TestBed.resetTestingModule();
		const el2 = await mount([raw({ id: 'a' }), raw({ id: 'b' })], () => throwError(() => new Error('500')));
		(el2.querySelector('[data-testid=mark-all-read]') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(c.unreadCount()).toBe(2);
		expect(c.notifications().every(n => n.isUnread)).toBe(true);
		expect(c.toastMessage()).toContain('تعذر');
	});

	it('a CTA shows only with a resolved target; a notification without one does not navigate', async () => {
		const el = await mount([
			raw({ id: 'a', type: 'OFFER_ACCEPTED', actionText: 'وقّع العقد', metadata: { offerId: 'o1' } }),
			raw({ id: 'b', type: 'SOMETHING_NEW', actionText: 'اذهب', isRead: true }),
		]);
		expect(Array.from(el.querySelectorAll('[data-testid=nt-cta]')).map(x => x.textContent?.trim())).toEqual(['وقّع العقد']);
		c.onNotificationClick(c.notifications().find(n => n.id === 'b')!);
		expect(nav).not.toHaveBeenCalled();
		c.onNotificationClick(c.notifications().find(n => n.id === 'a')!);
		expect(nav).toHaveBeenCalledWith('/provider-overview/offers/o1/sign-contract');
	});

	it('company mode: "needs action" requires a real target, not just an action label', async () => {
		await mount([
			raw({ id: 'a', type: 'OFFER_ACCEPTED', actionText: 'وقّع العقد', metadata: { offerId: 'o1' } }),
			raw({ id: 'b', type: 'SOMETHING_NEW', actionText: 'اذهب' }),
		]);
		c.setCoTab('action');
		expect(c.coFilteredNotifications().map(n => n.id)).toEqual(['a']);
		expect(c.coTabCounts().action).toBe(1);
	});

	it('the AI filter/icon appear only for a real AI notification', async () => {
		const el = await mount([raw({ id: 'a', type: 'NEW_PROPOSAL', category: 'OFFERS' })]);
		expect(el.textContent).not.toContain('ذكاء AI');
		TestBed.resetTestingModule();
		const el2 = await mount([raw({ id: 'z', type: 'RECOMMENDATION', category: 'AI' })]);
		expect(el2.textContent).toContain('ذكاء AI');
		expect(unwrap(c.notifications()[0].svgIcon)).toContain('r="1.5"');
	});

	it('a notification whose stored URL belongs to another role\'s dashboard (multi-role account) has no destination and does not navigate', async () => {
		await mount([raw({ id: 'm', type: 'GENERAL', actionUrl: '/marketer-overview/profile/requests', isRead: true })]);
		const nt = c.notifications()[0];
		expect(nt.actionUrl).toBeUndefined();
		c.onNotificationClick(nt);
		expect(nav).not.toHaveBeenCalled();
	});
});
