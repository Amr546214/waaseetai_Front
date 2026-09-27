import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

// Notifications bugfix: NotificationEngineService's constructor eagerly opens
// a socket.io connection, so socket.io-client is mocked at the module
// boundary (same pattern as anti-cheat.service.spec.ts) — mapToAppNotification
// and resolveNotificationTarget are pure and don't need a real socket at all.
const fakeSocket = {
	connected: false,
	on: vi.fn(),
	emit: vi.fn(),
	disconnect: vi.fn(),
};
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { NotificationEngineService } from './notification-engine.service';

describe('NotificationEngineService — mapToAppNotification (undefined-field fix)', () => {
	let service: NotificationEngineService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(NotificationEngineService);
	});

	it('never leaves time/dateCategory/icon fields undefined, even for a bare raw payload', () => {
		const mapped = service.mapToAppNotification({ id: '1', title: 'عنوان', message: 'رسالة' });

		expect(mapped.time).toBeTruthy();
		expect(typeof mapped.time).toBe('string');
		expect(mapped.dateCategory).toBeTruthy();
		expect(mapped.iconBgClass).toBeTruthy();
		expect(mapped.iconColorClass).toBeTruthy();
		expect(mapped.svgIcon).toBeTruthy();
		expect(mapped.time).not.toContain('undefined');
		expect(mapped.svgIcon).not.toContain('undefined');
	});

	it('derives isUnread from isRead when the raw payload only carries isRead (real backend DTO shape)', () => {
		const mapped = service.mapToAppNotification({ id: '1', title: 't', message: 'm', isRead: false });
		expect(mapped.isUnread).toBe(true);

		const mappedRead = service.mapToAppNotification({ id: '2', title: 't', message: 'm', isRead: true });
		expect(mappedRead.isUnread).toBe(false);
	});

	it('normalizes the backend uppercase category enum to the frontend lowercase union', () => {
		expect(service.mapToAppNotification({ id: '1', title: 't', message: 'm', category: 'PROJECTS' }).category).toBe('projects');
		expect(service.mapToAppNotification({ id: '2', title: 't', message: 'm', category: 'FINANCIAL' }).category).toBe('finance');
		expect(service.mapToAppNotification({ id: '3', title: 't', message: 'm', category: 'OFFERS' }).category).toBe('offers');
		expect(service.mapToAppNotification({ id: '4', title: 't', message: 'm', category: 'AI' }).category).toBe('ai');
		expect(service.mapToAppNotification({ id: '5', title: 't', message: 'm', category: 'ALL' }).category).toBe('security');
		expect(service.mapToAppNotification({ id: '6', title: 't', message: 'm' }).category).toBe('security');
	});

	it('picks the icon by type first, regardless of category (a CHAT notification always looks like a message)', () => {
		const chat = service.mapToAppNotification({ id: '1', title: 't', message: 'm', type: 'CHAT', category: 'ALL' });
		const other = service.mapToAppNotification({ id: '2', title: 't', message: 'm', type: 'SOME_UNKNOWN_TYPE', category: 'FINANCIAL' });
		expect(chat.svgIcon).not.toBe(other.svgIcon);
		expect(chat.iconColorClass).toContain('#2BD4C7');
	});

	it('falls back to the category icon, then the generic bell icon, for an unrecognized type', () => {
		const byCategory = service.mapToAppNotification({ id: '1', title: 't', message: 'm', type: 'SOME_UNKNOWN_TYPE', category: 'FINANCIAL' });
		expect(byCategory.iconColorClass).toContain('#FFB400');

		const generic = service.mapToAppNotification({ id: '2', title: 't', message: 'm', type: 'SOME_UNKNOWN_TYPE' });
		expect(generic.svgIcon).toContain('M18 8A6 6 0');
	});
});

describe('NotificationEngineService — resolveNotificationTarget (safe navigation)', () => {
	let service: NotificationEngineService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(NotificationEngineService);
	});

	it('resolves a CHAT notification with conversationId metadata to the real messages route', () => {
		const target = service.resolveNotificationTarget({ type: 'CHAT', metadata: { conversationId: 'conv-1' } });
		expect(target).toBe('/provider-overview/messages?conversationId=conv-1');
	});

	it('resolves a PROJECT_MATCH notification with clientRequestId metadata to the real apply route', () => {
		const target = service.resolveNotificationTarget({ type: 'PROJECT_MATCH', metadata: { clientRequestId: 'req-1' } });
		expect(target).toBe('/provider-overview/explore-requests/req-1/apply');
	});

	it('resolves an OFFER_ACCEPTED notification with offerId metadata to the real sign-contract route', () => {
		const target = service.resolveNotificationTarget({ type: 'OFFER_ACCEPTED', metadata: { offerId: 'offer-1' } });
		expect(target).toBe('/provider-overview/offers/offer-1/sign-contract');
	});

	it('resolves a STAGE_REVIEW / PROJECT_COMPLETION_REWARD notification with projectId metadata to the real progress route', () => {
		expect(service.resolveNotificationTarget({ type: 'STAGE_REVIEW', metadata: { projectId: 'proj-1' } }))
			.toBe('/provider-overview/projects/active/progress/proj-1');
		expect(service.resolveNotificationTarget({ type: 'PROJECT_COMPLETION_REWARD', metadata: { projectId: 'proj-1' } }))
			.toBe('/provider-overview/projects/active/progress/proj-1');
	});

	it('never fabricates a route when a known type is missing its required metadata', () => {
		expect(service.resolveNotificationTarget({ type: 'CHAT', metadata: {} })).toBeNull();
		expect(service.resolveNotificationTarget({ type: 'PROJECT_MATCH', metadata: null })).toBeNull();
		expect(service.resolveNotificationTarget({ type: 'OFFER_ACCEPTED' })).toBeNull();
		expect(service.resolveNotificationTarget({ type: 'STAGE_REVIEW', metadata: {} })).toBeNull();
	});

	it('an unknown type with a raw actionUrl outside the current dashboard is rejected, never followed', () => {
		// This is the exact historical bug: a stored actionUrl of "/dashboard/..."
		// (no such top-level route exists) must never be navigated to.
		const target = service.resolveNotificationTarget({ type: 'GENERAL', actionUrl: '/dashboard/messages?conversationId=x' });
		expect(target).toBeNull();
	});

	it('an unknown type with a valid provider-overview actionUrl is trusted as-is', () => {
		const target = service.resolveNotificationTarget({ type: 'MODEL_APPROVED', actionUrl: '/provider-overview/business-models/center' });
		expect(target).toBe('/provider-overview/business-models/center');
	});

	it('a notification with no actionUrl at all resolves to null (no CTA, no navigation)', () => {
		expect(service.resolveNotificationTarget({ type: 'GENERAL' })).toBeNull();
	});
});
