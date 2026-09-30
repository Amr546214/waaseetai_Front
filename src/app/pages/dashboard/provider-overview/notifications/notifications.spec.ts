import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

// Notifications bugfix: NotificationEngineService (injected by this
// component) eagerly opens a socket.io connection in its constructor, so
// socket.io-client is mocked at the module boundary — same pattern used by
// anti-cheat.service.spec.ts / specialties.spec.ts elsewhere in this repo.
const fakeSocket = {
	connected: false,
	on: vi.fn(),
	emit: vi.fn(),
	disconnect: vi.fn(),
};
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { Notifications } from './notifications';

// svgIcon is a pre-trusted SafeHtml block (see buildIconHtml() in
// NotificationEngineService), not a plain string — unwrap it via this
// documented, test-only escape hatch before asserting on its content.
function unwrapSafeHtml(value: unknown): string {
	return (value as any)?.changingThisBreaksApplicationSecurity ?? String(value);
}

function rawNotification(overrides: any = {}) {
	return {
		id: 'n1',
		title: 'عنوان',
		message: 'رسالة',
		type: 'GENERAL',
		category: 'PROJECTS',
		isRead: false,
		createdAt: new Date().toISOString(),
		...overrides
	};
}

describe('Notifications (provider)', () => {
	let component: Notifications;
	let fixture: ComponentFixture<Notifications>;
	let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
	let patchSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
	let navigateByUrlSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(async () => {
		getSpy = vi.fn(() => of({ success: false }));
		patchSpy = vi.fn(() => of({ success: true }));

		vi.stubGlobal('localStorage', {
			getItem: () => null,
			setItem: () => {},
			clear: () => {},
		});

		await TestBed.configureTestingModule({
			imports: [Notifications],
			providers: [
				// The template's breadcrumb <a routerLink="..."> needs a real
				// Router/ActivatedRoute from the router's own DI tree —
				// provideRouter([]) supplies that. A plain useValue stub for the
				// Router token breaks RouterLink (it reads real router-internal
				// state), so instead the real Router's navigateByUrl is spied on
				// below, after the component is created.
				provideRouter([]),
				{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), patch: (...args: any[]) => patchSpy(...args) } },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(Notifications);
		component = fixture.componentInstance;
		navigateByUrlSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('never renders a literal "undefined" for any mapped notification field', () => {
		getSpy.mockReturnValue(of({ success: true, data: [rawNotification()] }));
		fixture.detectChanges();

		const list = component.notifications();
		expect(list.length).toBe(1);
		expect(list[0].time).not.toContain('undefined');
		expect(list[0].dateCategory).not.toContain('undefined');
		expect(unwrapSafeHtml(list[0].svgIcon)).not.toContain('undefined');
	});

	it('a MODEL_APPROVED notification with serviceId metadata navigates to the exact published-model detail page', () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n8', type: 'MODEL_APPROVED', category: 'AI', metadata: { serviceId: 'svc-4' }, isRead: true })]
		}));
		fixture.detectChanges();

		const nt = component.notifications()[0];
		expect(nt.actionUrl).toBe('/provider-overview/business-models/market/svc-4');

		component.onNotificationClick(nt);
		expect(navigateByUrlSpy).toHaveBeenCalledWith('/provider-overview/business-models/market/svc-4');
	});

	it('an old MODEL_APPROVED notification with no metadata falls back to the generic center page', () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n9', type: 'MODEL_APPROVED', category: 'AI', actionUrl: '/provider-overview/business-models/center', isRead: true })]
		}));
		fixture.detectChanges();

		const nt = component.notifications()[0];
		expect(nt.actionUrl).toBe('/provider-overview/business-models/center');
	});

	it('a notification click with a valid resolved target navigates via navigateByUrl', () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n2', type: 'OFFER_ACCEPTED', metadata: { offerId: 'offer-9' }, isRead: true })]
		}));
		fixture.detectChanges();

		const nt = component.notifications()[0];
		expect(nt.actionUrl).toBe('/provider-overview/offers/offer-9/sign-contract');

		component.onNotificationClick(nt);

		expect(navigateByUrlSpy).toHaveBeenCalledWith('/provider-overview/offers/offer-9/sign-contract');
	});

	it('a notification with no valid target never navigates on click', () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n3', type: 'CHAT', metadata: {}, isRead: true })]
		}));
		fixture.detectChanges();

		const nt = component.notifications()[0];
		expect(nt.actionUrl).toBeUndefined();

		component.onNotificationClick(nt);

		expect(navigateByUrlSpy).not.toHaveBeenCalled();
	});

	it('clicking an unread notification marks it as read via the API and updates local state', () => {
		getSpy.mockReturnValue(of({ success: true, data: [rawNotification({ id: 'n4', isRead: false })] }));
		fixture.detectChanges();

		const nt = component.notifications()[0];
		expect(nt.isUnread).toBe(true);

		component.onNotificationClick(nt);

		expect(patchSpy).toHaveBeenCalledWith(expect.stringContaining('/notifications/n4/read'), {});
		expect(component.notifications()[0].isUnread).toBe(false);
	});

	it('markAllRead marks every notification as read and resets the unread counter', () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n5', isRead: false }), rawNotification({ id: 'n6', isRead: false })]
		}));
		fixture.detectChanges();
		expect(component.unreadCount()).toBe(2);

		component.markAllRead();

		expect(patchSpy).toHaveBeenCalledWith(expect.stringContaining('/notifications/read-all'), {});
		expect(component.unreadCount()).toBe(0);
		expect(component.notifications().every(n => !n.isUnread)).toBe(true);
	});

	it('an unknown/unsupported notification type fails safely (no CTA, no crash, no navigation)', () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n7', type: 'SOME_FUTURE_TYPE_NOT_YET_SUPPORTED', isRead: true })]
		}));
		expect(() => fixture.detectChanges()).not.toThrow();

		const nt = component.notifications()[0];
		expect(nt.actionUrl).toBeUndefined();

		expect(() => component.onNotificationClick(nt)).not.toThrow();
		expect(navigateByUrlSpy).not.toHaveBeenCalled();
	});
});
