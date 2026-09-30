import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

// NotificationEngineService (injected by this component) eagerly opens a
// socket.io connection in its constructor, so socket.io-client is mocked at
// the module boundary — same pattern used by notification-engine.service.spec.ts
// and the provider notifications.spec.ts.
const fakeSocket = {
	connected: false,
	on: vi.fn(),
	emit: vi.fn(),
	disconnect: vi.fn(),
};
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { NotificationsCenter } from './notifications-center';

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

describe('NotificationsCenter', () => {
	let component: NotificationsCenter;
	let fixture: ComponentFixture<NotificationsCenter>;
	let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
	let navigateByUrlSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

	beforeEach(async () => {
		getSpy = vi.fn(() => of({ success: false }));
		navigateByUrlSpy = vi.fn();

		// AuthStore (injected by NotificationEngineService, and awaited directly
		// by this component's ngOnInit via authStore.isInitialized$) reads
		// localStorage synchronously during construction.
		vi.stubGlobal('localStorage', {
			getItem: () => null,
			setItem: () => {},
			clear: () => {},
		});

		await TestBed.configureTestingModule({
			imports: [NotificationsCenter],
			providers: [
				{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), patch: () => of({ success: true }) } },
				{ provide: Router, useValue: { navigateByUrl: navigateByUrlSpy, navigate: vi.fn() } },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(NotificationsCenter);
		component = fixture.componentInstance;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('never renders a literal "undefined" for any mapped notification field, and normalizes a stale FINANCIAL actionUrl', async () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({
				id: 'n2',
				type: 'FINANCIAL',
				category: 'FINANCIAL',
				// The historical bug: rows created before the backend fix stored
				// this non-existent path.
				actionUrl: '/dashboard/clients-overview/finance/wallet',
			})]
		}));
		fixture.detectChanges();
		await fixture.whenStable();

		const list = component.notifications();
		expect(list.length).toBe(1);
		expect(list[0].time).not.toContain('undefined');
		expect(list[0].dateCategory).not.toContain('undefined');
		expect(unwrapSafeHtml(list[0].svgIcon)).not.toContain('undefined');
		expect(list[0].iconBgClass).toBeTruthy();
		expect(list[0].iconColorClass).toBeTruthy();

		// The real client route, recomputed by resolveNotificationTarget(raw,
		// '/client-overview') — never the stale stored value.
		expect(list[0].actionUrl).toBe('/client-overview/finance/wallet');
	});

	it('a CHAT notification resolves and navigates to this dashboard\'s own messages route', async () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n3', type: 'CHAT', metadata: { conversationId: 'conv-9' }, isRead: true })]
		}));
		fixture.detectChanges();
		await fixture.whenStable();

		const nt = component.notifications()[0];
		expect(nt.actionUrl).toBe('/client-overview/messages?conversationId=conv-9');

		component.onNotificationClick(nt);
		expect(navigateByUrlSpy).toHaveBeenCalledWith('/client-overview/messages?conversationId=conv-9');
	});

	it('a NEW_PROPOSAL notification with requestId metadata navigates to the exact request details page', async () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n4', type: 'NEW_PROPOSAL', metadata: { requestId: 'proj-1', offerId: 'offer-1' }, isRead: true })]
		}));
		fixture.detectChanges();
		await fixture.whenStable();

		const nt = component.notifications()[0];
		expect(nt.actionUrl).toBe('/client-overview/my-requests/proj-1');

		component.onNotificationClick(nt);
		expect(navigateByUrlSpy).toHaveBeenCalledWith('/client-overview/my-requests/proj-1');
	});

	it('an old NEW_PROPOSAL notification with no metadata still navigates via its real stored actionUrl', async () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n4b', type: 'NEW_PROPOSAL', actionUrl: '/client-overview/my-requests/proj-1', isRead: true })]
		}));
		fixture.detectChanges();
		await fixture.whenStable();

		const nt = component.notifications()[0];
		expect(nt.actionUrl).toBe('/client-overview/my-requests/proj-1');

		component.onNotificationClick(nt);
		expect(navigateByUrlSpy).toHaveBeenCalledWith('/client-overview/my-requests/proj-1');
	});

	it('a STAGE_DELIVERY notification with projectId + stageId metadata navigates to the exact stage delivery-review page', async () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n6', type: 'STAGE_DELIVERY', category: 'PROJECTS', metadata: { projectId: 'proj-7', stageId: 'stage-2' }, isRead: true })]
		}));
		fixture.detectChanges();
		await fixture.whenStable();

		const nt = component.notifications()[0];
		expect(nt.actionUrl).toBe('/client-overview/projects/proj-7/delivery-review/stage-2');

		component.onNotificationClick(nt);
		expect(navigateByUrlSpy).toHaveBeenCalledWith('/client-overview/projects/proj-7/delivery-review/stage-2');
	});

	it('an unknown/unsupported notification type fails safely (no CTA, no crash, no navigation)', async () => {
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n5', type: 'SOME_FUTURE_TYPE_NOT_YET_SUPPORTED', isRead: true })]
		}));
		expect(() => fixture.detectChanges()).not.toThrow();
		await fixture.whenStable();

		const nt = component.notifications()[0];
		expect(nt.actionUrl).toBeUndefined();

		expect(() => component.onNotificationClick(nt)).not.toThrow();
		expect(navigateByUrlSpy).not.toHaveBeenCalled();
	});
});
