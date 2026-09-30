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

// svgIcon is a pre-trusted SafeHtml block (see buildIconHtml()), not a plain
// string — Angular's Safe* wrappers deliberately stringify to a security
// warning rather than their real markup, so assertions on the actual <svg>
// content must unwrap it via this documented, test-only escape hatch first.
function unwrapSafeHtml(value: unknown): string {
	return (value as any)?.changingThisBreaksApplicationSecurity ?? String(value);
}

describe('NotificationEngineService — mapToAppNotification (undefined-field fix)', () => {
	let service: NotificationEngineService;

	beforeEach(() => {
		// AuthStore (injected by NotificationEngineService) reads localStorage
		// synchronously during construction — same stub as notifications.spec.ts.
		vi.stubGlobal('localStorage', {
			getItem: () => null,
			setItem: () => {},
			clear: () => {},
		});
		TestBed.configureTestingModule({});
		service = TestBed.inject(NotificationEngineService);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
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
		expect(unwrapSafeHtml(mapped.svgIcon)).not.toContain('undefined');
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
		expect(unwrapSafeHtml(generic.svgIcon)).toContain('M18 8A6 6 0');
	});
});

describe('NotificationEngineService — resolveNotificationTarget (safe navigation)', () => {
	let service: NotificationEngineService;

	beforeEach(() => {
		// AuthStore (injected by NotificationEngineService) reads localStorage
		// synchronously during construction — same stub as notifications.spec.ts.
		vi.stubGlobal('localStorage', {
			getItem: () => null,
			setItem: () => {},
			clear: () => {},
		});
		TestBed.configureTestingModule({});
		service = TestBed.inject(NotificationEngineService);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
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
		expect(service.resolveNotificationTarget({ type: 'STAGE_REVIEW', metadata: {} })).toBeNull();
		// PROJECT_MATCH / OFFER_ACCEPTED without metadata now fall back to their
		// real list pages instead — see the PROJECT_MATCH describe block below.
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

	it('resolves a CHAT notification against the current viewer\'s own dashboard, not always provider', () => {
		const providerTarget = service.resolveNotificationTarget({ type: 'CHAT', metadata: { conversationId: 'conv-1' } }, '/provider-overview');
		expect(providerTarget).toBe('/provider-overview/messages?conversationId=conv-1');

		const clientTarget = service.resolveNotificationTarget({ type: 'CHAT', metadata: { conversationId: 'conv-1' } }, '/client-overview');
		expect(clientTarget).toBe('/client-overview/messages?conversationId=conv-1');
	});

	it('resolves a FINANCIAL notification to the current dashboard\'s real wallet route, ignoring any stale stored actionUrl', () => {
		// Historical bug: rows created before the backend fix stored the
		// non-existent "/dashboard/clients-overview/finance/wallet" path.
		// resolveNotificationTarget must recompute the real route instead of
		// trusting that stored value, normalizing every already-stored row.
		const staleRaw = { type: 'FINANCIAL', actionUrl: '/dashboard/clients-overview/finance/wallet' };
		expect(service.resolveNotificationTarget(staleRaw, '/client-overview')).toBe('/client-overview/finance/wallet');
		expect(service.resolveNotificationTarget(staleRaw, '/provider-overview')).toBe('/provider-overview/finance/wallet');
	});

	it('resolves a FINANCIAL notification with transactionId metadata to the exact transaction detail page', () => {
		const target = service.resolveNotificationTarget(
			{ type: 'FINANCIAL', metadata: { transactionId: 'txn-1' } },
			'/client-overview'
		);
		expect(target).toBe('/client-overview/finance/transactions/txn-1');
	});

	it('resolves a STAGE_DELIVERY notification with projectId + stageId metadata to the exact stage delivery-review route', () => {
		const target = service.resolveNotificationTarget({
			type: 'STAGE_DELIVERY',
			metadata: { projectId: 'proj-2', stageId: 'stage-9' }
		});
		expect(target).toBe('/client-overview/projects/proj-2/delivery-review/stage-9');
	});

	it('an old STAGE_DELIVERY notification missing stageId metadata falls back to its real stored actionUrl', () => {
		const target = service.resolveNotificationTarget({
			type: 'STAGE_DELIVERY',
			actionUrl: '/client-overview/projects/proj-2',
			metadata: { projectId: 'proj-2' } // no stageId — an older row
		});
		expect(target).toBe('/client-overview/projects/proj-2');
	});

	it('resolves a NEW_PROPOSAL notification with requestId metadata to the exact request details page', () => {
		const target = service.resolveNotificationTarget({
			type: 'NEW_PROPOSAL',
			metadata: { requestId: 'req-5', offerId: 'offer-5' }
		});
		expect(target).toBe('/client-overview/my-requests/req-5');
	});

	it('an old NEW_PROPOSAL notification with no metadata at all falls back to its real stored actionUrl', () => {
		const target = service.resolveNotificationTarget({
			type: 'NEW_PROPOSAL',
			actionUrl: '/client-overview/my-requests/req-5'
		});
		expect(target).toBe('/client-overview/my-requests/req-5');
	});

	it('resolves a MODEL_APPROVED notification with serviceId metadata to the exact published-model detail page', () => {
		const target = service.resolveNotificationTarget({
			type: 'MODEL_APPROVED',
			metadata: { serviceId: 'svc-3' }
		});
		expect(target).toBe('/provider-overview/business-models/market/svc-3');
	});

	it('resolves a GENERAL notification to a valid marketer-overview actionUrl (widened allowlist)', () => {
		// The one real GENERAL producer (admin approving/rejecting a marketer's
		// profile-change request) stores a /marketer-overview/... actionUrl —
		// this must be trusted, not silently dropped as an unrecognized prefix.
		const target = service.resolveNotificationTarget(
			{ type: 'GENERAL', actionUrl: '/marketer-overview/profile/requests' },
			'/marketer-overview'
		);
		expect(target).toBe('/marketer-overview/profile/requests');
	});

	it('rejects a javascript: pseudo-protocol actionUrl outright', () => {
		const target = service.resolveNotificationTarget({ type: 'GENERAL', actionUrl: 'javascript:alert(1)' });
		expect(target).toBeNull();
	});

	it('rejects an absolute external URL actionUrl outright', () => {
		const target = service.resolveNotificationTarget({ type: 'GENERAL', actionUrl: 'https://evil.example.com/phish' });
		expect(target).toBeNull();
	});
});

describe('NotificationEngineService — PROJECT_MATCH / OFFER_ACCEPTED deep links (incl. historical rows)', () => {
	let service: NotificationEngineService;

	beforeEach(() => {
		vi.stubGlobal('localStorage', {
			getItem: () => null,
			setItem: () => {},
			clear: () => {},
		});
		TestBed.configureTestingModule({});
		service = TestBed.inject(NotificationEngineService);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('a current PROJECT_MATCH row (metadata.clientRequestId) opens the exact Marketplace opportunity + offer form', () => {
		const target = service.resolveNotificationTarget({
			type: 'PROJECT_MATCH',
			actionUrl: '/provider-overview/explore-requests/3f2a9c1e-0b7d-4a51-9f0e-8c2d1b6a7e44/apply',
			metadata: { clientRequestId: '3f2a9c1e-0b7d-4a51-9f0e-8c2d1b6a7e44' }
		});
		expect(target).toBe('/provider-overview/explore-requests/3f2a9c1e-0b7d-4a51-9f0e-8c2d1b6a7e44/apply');
	});

	it('a historical PROJECT_MATCH row (no metadata, legacy /provider-overview/projects/<id> actionUrl) maps to that exact opportunity', () => {
		const target = service.resolveNotificationTarget({
			type: 'PROJECT_MATCH',
			actionUrl: '/provider-overview/projects/3f2a9c1e-0b7d-4a51-9f0e-8c2d1b6a7e44',
			metadata: null
		});
		expect(target).toBe('/provider-overview/explore-requests/3f2a9c1e-0b7d-4a51-9f0e-8c2d1b6a7e44/apply');
	});

	it('a PROJECT_MATCH row with no metadata and no usable actionUrl falls back to the Marketplace list, never null', () => {
		expect(service.resolveNotificationTarget({ type: 'PROJECT_MATCH' })).toBe('/provider-overview/explore-requests');
		expect(service.resolveNotificationTarget({ type: 'PROJECT_MATCH', metadata: {} })).toBe('/provider-overview/explore-requests');
		expect(service.resolveNotificationTarget({ type: 'PROJECT_MATCH', actionUrl: '/dashboard/x' })).toBe('/provider-overview/explore-requests');
		expect(service.resolveNotificationTarget({ type: 'PROJECT_MATCH', actionUrl: 'https://evil.example.com/p' })).toBe('/provider-overview/explore-requests');
		// Real sibling routes are never mistaken for an opportunity id.
		expect(service.resolveNotificationTarget({ type: 'PROJECT_MATCH', actionUrl: '/provider-overview/projects/active' })).toBe('/provider-overview/explore-requests');
		// Unsafe id characters in metadata are never interpolated into a route.
		expect(service.resolveNotificationTarget({ type: 'PROJECT_MATCH', metadata: { clientRequestId: '../offers' } })).toBe('/provider-overview/explore-requests');
	});

	it('mapToAppNotification exposes the same resolved URL for the card and its action text', () => {
		const mapped = service.mapToAppNotification({
			id: 'n1', title: 'فرصة مشروع جديدة', message: 'm', type: 'PROJECT_MATCH', category: 'PROJECTS',
			actionText: 'عرض التفاصيل وتقديم عرض', actionUrl: '/provider-overview/projects/req-9'
		});
		expect(mapped.actionText).toBe('عرض التفاصيل وتقديم عرض');
		expect(mapped.actionUrl).toBe('/provider-overview/explore-requests/req-9/apply');
	});

	it('a historical OFFER_ACCEPTED row without offerId falls back to the provider offers list', () => {
		expect(service.resolveNotificationTarget({ type: 'OFFER_ACCEPTED' })).toBe('/provider-overview/offers');
		expect(service.resolveNotificationTarget({
			type: 'OFFER_ACCEPTED',
			actionUrl: '/provider-overview/projects/req-1/contract'
		})).toBe('/provider-overview/offers');
	});
});
