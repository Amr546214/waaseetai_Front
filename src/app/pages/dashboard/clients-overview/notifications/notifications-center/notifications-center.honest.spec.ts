/// <reference types="node" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { NotificationsCenter } from './notifications-center';

const raw = (o: any = {}) => ({ id: 'n1', title: 'عنوان', message: 'رسالة', type: 'GENERAL', category: 'ALL', isRead: false, createdAt: new Date().toISOString(), ...o });

describe('client notifications page: real data only, honest counters/CTA/AI', () => {
	let fixture: ComponentFixture<NotificationsCenter>;
	let c: NotificationsCenter;
	let get: ReturnType<typeof vi.fn>;
	let patch: ReturnType<typeof vi.fn>;
	let navigate: ReturnType<typeof vi.fn>;

	async function mount(data: any, patchImpl?: () => any) {
		get = vi.fn(() => data instanceof Error ? throwError(() => data) : of({ success: true, data }));
		patch = vi.fn(patchImpl ?? (() => of({ success: true })));
		navigate = vi.fn();
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [NotificationsCenter],
			providers: [{ provide: HttpClient, useValue: { get, patch } }, { provide: Router, useValue: { navigateByUrl: navigate, navigate: vi.fn() } }],
		}).compileComponents();
		fixture = TestBed.createComponent(NotificationsCenter);
		c = fixture.componentInstance;
		fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('no notification is hard-coded in the template or the component', () => {
		const dir = __dirname;
		const src = readFileSync(join(dir, 'notifications-center.ts'), 'utf8') + readFileSync(join(dir, 'notifications-center.html'), 'utf8');
		for (const fake of ['عرض جديد على طلبك', 'عرض العرض', 'بانتظار اعتمادك', 'مراجعة التسليم', 'توصية من الذكاء', 'وسيط، ترتيب تلقائي']) expect(src).not.toContain(fake);
		expect(readFileSync(join(dir, 'notifications-center.html'), 'utf8')).not.toContain('ترتيب تلقائي');
	});

	it('an empty API shows the empty state, 0 counters and no AI chip', async () => {
		const el = await mount([]);
		expect(el.textContent).toContain('لا توجد إشعارات');
		expect(el.textContent).toContain('لا توجد إشعارات غير مقروءة');
		expect(Array.from(el.querySelectorAll('.filter-chip')).map(b => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['الكل0', 'عروض0', 'مشاريع0', 'مالية0']);
	});

	it('an API failure shows the error state with retry, never invented items', async () => {
		const el = await mount(new Error('boom'));
		expect(el.textContent).toContain('تعذر تحميل الإشعارات');
		expect(c.notifications()).toEqual([]);
	});

	it('counters come from the data: unread label and per-filter counts (type decides the bucket when the backend category is generic)', async () => {
		const el = await mount([
			raw({ id: 'a', type: 'NEW_PROPOSAL', category: 'ALL', metadata: { requestId: 'r1' } }),
			raw({ id: 'b', type: 'STAGE_DELIVERY', category: 'PROJECTS', isRead: true, metadata: { projectId: 'p', stageId: 's' } }),
			raw({ id: 'c', type: 'FINANCIAL', category: 'FINANCIAL' }),
			raw({ id: 'd', type: 'CHAT', category: 'ALL', metadata: { conversationId: 'x' } }),
		]);
		expect(c.unreadCount()).toBe(3);
		expect(el.textContent).toContain('3 إشعارات غير مقروءة');
		expect(c.filterCount('all')).toBe(4);
		expect(c.filterCount('offers')).toBe(1);
		expect(c.filterCount('projects')).toBe(1);
		expect(c.filterCount('finance')).toBe(1);
		expect(c.filterCount('ai')).toBe(0);
		c.setFilter('offers'); fixture.detectChanges();
		expect(c.filteredNotifications().map(n => n.id)).toEqual(['a']);
	});

	it('mark all as read calls the endpoint and zeroes the counters; on failure nothing is faked', async () => {
		const el = await mount([raw({ id: 'a' }), raw({ id: 'b' })]);
		(el.querySelector('[data-testid=mark-all-read]') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(patch).toHaveBeenCalledTimes(1);
		expect(String(patch.mock.calls[0][0])).toContain('/notifications/read-all');
		expect(c.unreadCount()).toBe(0);
		expect(el.textContent).toContain('لا توجد إشعارات غير مقروءة');

		TestBed.resetTestingModule();
		const el2 = await mount([raw({ id: 'a' }), raw({ id: 'b' })], () => throwError(() => new Error('500')));
		(el2.querySelector('[data-testid=mark-all-read]') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(c.unreadCount()).toBe(2);
		expect(c.toastMessage()).toContain('تعذر');
	});

	it('the mark-all button is disabled when nothing is unread', async () => {
		const el = await mount([raw({ id: 'a', isRead: true })]);
		expect((el.querySelector('[data-testid=mark-all-read]') as HTMLButtonElement).disabled).toBe(true);
	});

	it('a CTA text shows only with a resolved target; a notification without a target has no CTA and no navigation', async () => {
		const el = await mount([
			raw({ id: 'a', type: 'NEW_PROPOSAL', actionText: 'عرض العروض', metadata: { requestId: 'r1' } }),
			raw({ id: 'b', type: 'SOMETHING_NEW', actionText: 'اذهب', isRead: true }),
		]);
		const ctas = Array.from(el.querySelectorAll('[data-testid=nt-cta]')).map(x => x.textContent?.trim());
		expect(ctas).toEqual(['عرض العروض']);
		const nt = c.notifications().find(n => n.id === 'b')!;
		c.onNotificationClick(nt);
		expect(navigate).not.toHaveBeenCalled();
	});

	it('clicking an unread notification marks it read through the API and then navigates to its real route', async () => {
		await mount([raw({ id: 'a', type: 'NEW_PROPOSAL', metadata: { requestId: 'r1' } })]);
		c.onNotificationClick(c.notifications()[0]);
		expect(String(patch.mock.calls[0][0])).toContain('/notifications/a/read');
		expect(c.unreadCount()).toBe(0);
		expect(navigate).toHaveBeenCalledWith('/client-overview/my-requests/r1');
	});

	it('the AI filter and AI-styled icon appear only for a real AI notification', async () => {
		const el = await mount([raw({ id: 'a', type: 'NEW_PROPOSAL', category: 'OFFERS' })]);
		expect(el.textContent).not.toContain('ذكاء AI');
		expect(unwrap(c.notifications()[0].svgIcon)).not.toContain('r="1.5"');
		TestBed.resetTestingModule();
		const el2 = await mount([raw({ id: 'z', type: 'RECOMMENDATION', category: 'AI', title: 'توصية' })]);
		expect(el2.textContent).toContain('ذكاء AI');
		expect(c.filterCount('ai')).toBe(1);
		expect(unwrap(c.notifications()[0].svgIcon)).toContain('r="1.5"');
	});
});

function unwrap(v: unknown): string { return (v as any)?.changingThisBreaksApplicationSecurity ?? String(v); }
