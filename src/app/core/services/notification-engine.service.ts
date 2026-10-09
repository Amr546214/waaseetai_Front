import { Injectable, signal, inject, effect, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { NotificationSoundService } from './notification-sound.service';
import { AuthStore } from '../store/auth.store';
import { UiNotificationService } from './ui-notification.service';
import { ACCOUNT_NOT_ACTIVE_CODE, accountBlockedText } from './account-state';

// The real, existing dashboard roots this app has — every notification
// destination must resolve to one of these (see resolveNotificationTarget()/
// isSafeInternalUrl()). Never invented: each is a real top-level route
// section already registered for its account type.
export type NotificationBasePath = '/provider-overview' | '/client-overview' | '/marketer-overview';

export interface NotificationEvent {
	id?: string;
	title: string;
	message: string;
	type?: string;
	category?: string;
	actionUrl?: string;
	actionText?: string;
	createdAt?: string | Date;
	metadata?: any;
	time?: string;
	dateCategory?: 'اليوم' | 'أمس' | 'أقدم';
	iconColorClass?: string;
	iconBgClass?: string;
	svgIcon?: string;
}

// Batch (notifications bugfix): the shape a raw backend/socket notification
// payload is normalized into before being shown in any notification list.
// Every field here is always populated with a sensible value — never
// `undefined` — so no view ever needs to guard against a missing field.
export interface AppNotification {
	id: string;
	category: 'offers' | 'projects' | 'finance' | 'ai' | 'security';
	type?: string;
	title: string;
	time: string;
	message: string;
	isUnread: boolean;
	actionText?: string;
	// Already resolved to a real, navigable in-app route (or omitted when no
	// safe destination exists) — see resolveNotificationTarget(). Never the
	// raw, unvalidated backend actionUrl.
	actionUrl?: string;
	dateCategory: 'اليوم' | 'أمس' | 'أقدم';
	metadata?: Record<string, unknown> | null;
	// Styling hints
	iconColorClass: string;
	iconBgClass: string;
	// A ready-to-render, pre-trusted <svg>...</svg> block (see buildIconHtml()
	// below) — NOT raw markup. Angular's default [innerHTML] sanitizer strips
	// <svg>/<path>/<circle> elements from a plain string (they are not on its
	// safe-elements allowlist), so binding a raw string here would silently
	// render an empty icon box. Every view should bind this directly, e.g.
	// [innerHTML]="nt.svgIcon", with no further string concatenation.
	svgIcon: SafeHtml;
}

interface IconStyle {
	bg: string;
	color: string;
	svg: string;
}

@Injectable({
	providedIn: 'root'
})
export class NotificationEngineService implements OnDestroy {
	private http = inject(HttpClient);
	private soundService = inject(NotificationSoundService);
	private platformId = inject(PLATFORM_ID);
	private isBrowser = isPlatformBrowser(this.platformId);
	private authStore = inject(AuthStore);
	private ui = inject(UiNotificationService);
	private sanitizer = inject(DomSanitizer);
	private iconHtmlCache = new Map<string, SafeHtml>();
	private socket: Socket | null = null;
	// The user ID the socket is currently (or should be) joined as. Distinct
	// from `undefined` (no effect run yet) so the very first effect run is
	// never mistaken for a no-op when the user is genuinely anonymous (`null`).
	// Comparing against this — rather than reacting to every `currentUser()`
	// emission — is what stops an unrelated profile-field update (same user,
	// new object reference) from tearing down and recreating the socket.
	private joinedUserId: string | null | undefined = undefined;

	// Backend enum (NotificationCategory: ALL/OFFERS/PROJECTS/FINANCIAL/AI) ->
	// the frontend's own category union. ALL/unrecognized falls back to the
	// generic "security" bucket already used elsewhere as the catch-all.
	private static readonly CATEGORY_MAP: Record<string, AppNotification['category']> = {
		OFFERS: 'offers',
		PROJECTS: 'projects',
		FINANCIAL: 'finance',
		AI: 'ai',
	};

	// Icons reused verbatim from the existing dashboard sidebar icon set
	// (sheards/dashboard/sidebar/sidebar.ts) and this page's own AI banner —
	// no new icon dependency introduced.
	private static readonly ICON_MESSAGE: IconStyle = {
		bg: 'bg-[rgba(43,212,199,.12)]', color: 'text-[#2BD4C7]',
		svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
	};
	private static readonly ICON_PROJECT: IconStyle = {
		bg: 'bg-[rgba(43,127,255,.12)]', color: 'text-[#2B7FFF]',
		svg: '<path d="M3 11h18v11H3zM7 11V7a5 5 0 0 1 10 0v4"/>'
	};
	private static readonly ICON_OFFER: IconStyle = {
		bg: 'bg-[rgba(43,127,255,.12)]', color: 'text-[#2B7FFF]',
		svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/>'
	};
	private static readonly ICON_FINANCE: IconStyle = {
		bg: 'bg-[rgba(255,180,0,.12)]', color: 'text-[#FFB400]',
		svg: '<path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 14a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>'
	};
	private static readonly ICON_AI: IconStyle = {
		bg: 'bg-[rgba(123,47,190,.16)]', color: 'text-[#7B2FBE]',
		svg: '<circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/><path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/>'
	};
	private static readonly ICON_GENERAL: IconStyle = {
		bg: 'bg-[rgba(160,178,209,.12)]', color: 'text-[var(--txt-3)]',
		svg: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>'
	};

	// type is the primary icon signal (e.g. a CHAT notification should always
	// look like a message regardless of its category); category is only a
	// fallback for types this map doesn't know about.
	// The single source of truth for "what icon does this notification show" —
	// shared by the notification bell dropdown and every full notifications
	// page (provider + client) via mapToAppNotification() below, so none of
	// them can drift out of sync with each other. Every `type` literal here
	// is one actually produced by a real `notification.create`/`createMany`
	// call in the backend (grepped exhaustively) — GENERAL is the untyped
	// default for the two admin-decision notifications that pass no type.
	private static readonly ICON_BY_TYPE: Record<string, IconStyle> = {
		CHAT: NotificationEngineService.ICON_MESSAGE,
		PROJECT_MATCH: NotificationEngineService.ICON_PROJECT,
		STAGE_REVIEW: NotificationEngineService.ICON_PROJECT,
		STAGE_DELIVERY: NotificationEngineService.ICON_PROJECT,
		PROJECT_COMPLETION_REWARD: NotificationEngineService.ICON_PROJECT,
		OFFER_ACCEPTED: NotificationEngineService.ICON_OFFER,
		NEW_PROPOSAL: NotificationEngineService.ICON_OFFER,
		MODEL_APPROVED: NotificationEngineService.ICON_AI,
		FINANCIAL: NotificationEngineService.ICON_FINANCE,
		GENERAL: NotificationEngineService.ICON_GENERAL,
	};

	// Rows created without a category (the backend defaults it to ALL, e.g. NEW_PROPOSAL, CHAT) would otherwise fall in the catch-all bucket and
	// never count in the offers/projects/finance filters. The type is the real signal, so it decides the filter bucket when the category is generic.
	private static readonly CATEGORY_BY_TYPE: Record<string, AppNotification['category']> = {
		NEW_PROPOSAL: 'offers', OFFER_ACCEPTED: 'offers',
		PROJECT_MATCH: 'projects', STAGE_REVIEW: 'projects', STAGE_DELIVERY: 'projects', PROJECT_COMPLETION_REWARD: 'projects',
		FINANCIAL: 'finance',
	};

	private static readonly ICON_BY_CATEGORY: Record<AppNotification['category'], IconStyle> = {
		offers: NotificationEngineService.ICON_OFFER,
		projects: NotificationEngineService.ICON_PROJECT,
		finance: NotificationEngineService.ICON_FINANCE,
		ai: NotificationEngineService.ICON_AI,
		security: NotificationEngineService.ICON_GENERAL,
	};

	private static readonly SAFE_BASE_PATHS: NotificationBasePath[] = ['/provider-overview', '/client-overview', '/marketer-overview'];

	unreadCount = signal<number>(0);
	latestNotification = signal<NotificationEvent | null>(null);
	latestModelStatusUpdate = signal<any | null>(null);
	showToast = signal<boolean>(false);

	// Real-time event emitters for UI reactivity
	realtimeNewNotification = signal<any | null>(null);
	realtimeReadNotification = signal<string | null>(null);
	realtimeReadAll = signal<boolean>(false);

	private toastTimer: any = null;

	constructor() {
		// Socket.IO is browser-only real-time transport: creating it during SSR
		// would open a real outbound connection from the Node render process on
		// every server-rendered request (this service is `providedIn: 'root'`,
		// so SSR's per-request injector instantiates it — and reconstructs it —
		// on every request), leaking a connection per render with no owner left
		// to close it.
		if (this.isBrowser) {
			// Follows AuthStore.currentUser() for the socket's entire lifecycle —
			// not just at startup — so login, logout, and an account switch are
			// all handled the same way. AuthStore hydrates its signals
			// synchronously from cookies/localStorage before this constructor
			// runs, so a persisted session is already visible on the very first
			// run; an anonymous session simply stays disconnected until a real
			// login populates currentUser().
			effect(() => {
				const user = this.authStore.currentUser();
				const userId = user?.id ?? null;
				if (userId === this.joinedUserId) return;

				// Always start from a clean socket on any identity change
				// (login, logout, or switching to a different account) — the
				// backend has no "leave user room" event, so the only
				// guaranteed way to stop the previous user's room membership
				// is to fully disconnect rather than reuse the connection.
				this.disconnect();
				this.joinedUserId = userId;

				if (userId) {
					this.initSocket(userId);
				}
			});
		}
	}

	initSocket(userId: string): void {
		if (!this.isBrowser || this.socket) return;

		this.socket = io(environment.socketUrl, {
			withCredentials: true,
			reconnection: true,
			// Matches the same auth.token handshake pattern already used by
			// ChatService/AntiCheatService/etc.: the backend's connection
			// handler (waseetai-backend/src/socket.ts) verifies this JWT and
			// auto-joins `user_<id>`/`project_owner_<id>` on every connect —
			// including every automatic reconnect, since socket.io-client
			// resends the current `auth` value on each attempt.
			auth: { token: this.authStore.token() },
		});

		console.log('🔌 NotificationEngine connected to WebSocket');

		// The backend's own auto-join already covers this on every connect,
		// but explicitly re-asserting room membership here matches the
		// established pattern in ChatService and is a harmless no-op when the
		// backend already joined the room from the handshake token.
		this.socket.on('connect', () => {
			if (this.joinedUserId) {
				this.socket?.emit('join_user_room', this.joinedUserId);
			}
		});

		const handleNewNotification = (notif: any) => {
			console.log('📬 Real-time notification received:', notif);
			this.unreadCount.update(c => c + 1);
			this.realtimeNewNotification.set(notif);
			this.soundService.playPopSound();
			this.triggerToast(notif);
		};

		// The server cut this connection because the account is no longer active (admin suspension), or refused it at the handshake.
		this.socket.on('account_not_active', (payload: { message?: string }) => {
			this.ui.showBanner('error', accountBlockedText(payload?.message), { title: 'الحساب غير نشط' });
		});
		this.socket.on('connect_error', (err: Error & { data?: { code?: string } }) => {
			if (err?.data?.code === ACCOUNT_NOT_ACTIVE_CODE) this.ui.showBanner('error', accountBlockedText(undefined), { title: 'الحساب غير نشط' });
		});
		this.socket.on('notification:new', handleNewNotification);
		this.socket.on('new_notification', handleNewNotification);

		this.socket.on('notification_read', (data: { id: string }) => {
			if (data && data.id) {
				this.realtimeReadNotification.set(data.id);
			}
		});

		this.socket.on('all_notifications_read', () => {
			this.unreadCount.set(0);
			this.realtimeReadAll.set(true);
		});

		const handleModelUpdate = (updateData: any) => {
			console.log('✨ Model Audit Status Update arrived:', updateData);
			this.latestModelStatusUpdate.set(updateData);
			if (updateData.notification && !updateData._notified) {
				updateData._notified = true;
				this.unreadCount.update(c => c + 1);
				this.soundService.playPopSound();
				this.triggerToast(updateData.notification);
			}
		};

		this.socket.on('model:status_updated', handleModelUpdate);
		this.socket.on('model_status_update', handleModelUpdate);

		this.socket.emit('join_user_room', userId);
		console.log(`📡 NotificationEngine subscribed to room for user: ${userId}`);
	}

	fetchNotifications(category?: string): Observable<any> {
		const params: any = {};
		if (category && category !== 'all' && category !== 'ALL') {
			params.category = category;
		}
		return this.http.get<any>(`${environment.url_api}/notifications`, { params });
	}

	markNotificationAsRead(id: string): Observable<any> {
		return this.http.patch<any>(`${environment.url_api}/notifications/${id}/read`, {});
	}

	markAllNotificationsAsRead(): Observable<any> {
		return this.http.patch<any>(`${environment.url_api}/notifications/read-all`, {});
	}

	triggerToast(notif: NotificationEvent): void {
		this.latestNotification.set(notif);
		this.showToast.set(true);

		if (this.toastTimer) {
			clearTimeout(this.toastTimer);
		}

		this.toastTimer = setTimeout(() => {
			this.showToast.set(false);
		}, 7000);
	}

	closeToast(): void {
		this.showToast.set(false);
		if (this.toastTimer) {
			clearTimeout(this.toastTimer);
		}
	}

	resetUnread(): void {
		this.unreadCount.set(0);
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
	}

	ngOnDestroy(): void {
		this.disconnect();
	}

	/**
	 * Normalizes a raw backend/socket notification payload into a fully
	 * populated AppNotification — never leaving a field undefined. This is
	 * the single place that understands the raw notification contract, so
	 * every list (real-time or fetched) renders consistently.
	 *
	 * `basePath` is the current viewer's own dashboard root ('/provider-overview'
	 * by default, matching this method's original behavior for every
	 * pre-existing caller) — pass '/client-overview' or '/marketer-overview'
	 * when mapping for that dashboard so role-aware types (CHAT, FINANCIAL,
	 * GENERAL) resolve to that dashboard's real routes instead.
	 */
	mapToAppNotification(raw: any, basePath: NotificationBasePath = '/provider-overview'): AppNotification {
		const createdAt = raw?.createdAt ? new Date(raw.createdAt) : new Date();
		const category = NotificationEngineService.CATEGORY_MAP[String(raw?.category ?? '').toUpperCase()]
			?? NotificationEngineService.CATEGORY_BY_TYPE[String(raw?.type ?? '')]
			?? 'security';
		const iconStyle = NotificationEngineService.ICON_BY_TYPE[raw?.type as string]
			?? NotificationEngineService.ICON_BY_CATEGORY[category]
			?? NotificationEngineService.ICON_GENERAL;

		return {
			id: raw?.id ?? '',
			category,
			type: raw?.type ?? undefined,
			title: raw?.title ?? '',
			message: raw?.message ?? '',
			isUnread: raw?.isUnread !== undefined ? Boolean(raw.isUnread) : !raw?.isRead,
			actionText: raw?.actionText ?? undefined,
			actionUrl: this.resolveNotificationTarget(raw, basePath) ?? undefined,
			time: this.formatRelativeTime(createdAt),
			dateCategory: this.resolveDateCategory(createdAt),
			metadata: raw?.metadata ?? null,
			iconColorClass: iconStyle.color,
			iconBgClass: iconStyle.bg,
			svgIcon: this.buildIconHtml(iconStyle.svg),
		};
	}

	/**
	 * Resolves a notification to a real, existing Angular route — or null
	 * when no valid destination exists. Never fabricates a route: known
	 * types are only followed when their required metadata is present, and
	 * an unrecognized type (or a known type whose metadata is missing —
	 * e.g. an older row created before that type started carrying it) falls
	 * back to the raw actionUrl only when it passes isSafeInternalUrl().
	 *
	 * `basePath` is the CURRENT VIEWER's own dashboard root — never the
	 * notification recipient's stored role (this app has no such field on a
	 * notification; the same row is only ever visible to its own `userId`
	 * when they view their own list). PROJECT_MATCH/OFFER_ACCEPTED/
	 * STAGE_REVIEW/PROJECT_COMPLETION_REWARD are only ever created for a
	 * provider, and STAGE_DELIVERY/NEW_PROPOSAL only ever for a client
	 * (verified against every real backend `notification.create` call
	 * site), so those stay hardcoded regardless of `basePath`. CHAT and
	 * FINANCIAL are genuinely sent to any role, so they resolve against
	 * `basePath`.
	 */
	resolveNotificationTarget(
		nt: { type?: string; actionUrl?: string | null; metadata?: any },
		basePath: NotificationBasePath = '/provider-overview'
	): string | null {
		const metadata = nt?.metadata || {};

		switch (nt?.type) {
			case 'CHAT':
				return metadata.conversationId
					? `${basePath}/messages?conversationId=${metadata.conversationId}`
					: null;
			case 'PROJECT_MATCH':
				// Provider-only. Always resolves into the Marketplace (never
				// null) — see resolveProjectMatchTarget().
				return this.resolveProjectMatchTarget(metadata, nt?.actionUrl);
			case 'OFFER_ACCEPTED':
				if (metadata.offerId) {
					return `/provider-overview/offers/${metadata.offerId}/sign-contract`;
				}
				// Older rows (created before offerId metadata existed) stored
				// "/provider-overview/projects/<requestId>/contract" — never a
				// real route, and it carries no offer id. The provider's own
				// offers list ("عروضي") is where that accepted offer is signed.
				return '/provider-overview/offers';
			case 'STAGE_REVIEW':
			case 'PROJECT_COMPLETION_REWARD':
				// The provider Progress page has no stage-scoped route/param
				// today (verified against provider.routes.ts) — project-level
				// is the exact destination this UI currently supports.
				return metadata.projectId
					? `/provider-overview/projects/active/progress/${metadata.projectId}`
					: null;
			case 'STAGE_DELIVERY':
				// Client-only. delivery-review/:stageId is a real, actively
				// used route (the component reads stageId to find the exact
				// stage) — more precise than the project-level fallback below,
				// which is all older rows lacking stageId metadata can reach.
				if (metadata.projectId && metadata.stageId) {
					return `/client-overview/projects/${metadata.projectId}/delivery-review/${metadata.stageId}`;
				}
				return this.isSafeInternalUrl(nt?.actionUrl, '/client-overview') ? nt!.actionUrl! : null;
			case 'NEW_PROPOSAL':
				// Client-only. RequestDetails already shows every proposal on
				// the request — the exact destination this UI supports (it has
				// no per-offer route/query param to select one specifically).
				if (metadata.requestId) {
					return `/client-overview/my-requests/${metadata.requestId}`;
				}
				return this.isSafeInternalUrl(nt?.actionUrl, '/client-overview') ? nt!.actionUrl! : null;
			case 'MODEL_APPROVED':
				// Provider-only. business-models/market/:id is the exact
				// published-model detail page (confirmed to share ServiceCatalog
				// ids with metadata.serviceId) — more precise than the generic
				// center/list page older rows without metadata fall back to.
				if (metadata.serviceId) {
					return `/provider-overview/business-models/market/${metadata.serviceId}`;
				}
				return this.isSafeInternalUrl(nt?.actionUrl, '/provider-overview') ? nt!.actionUrl! : null;
			case 'FINANCIAL':
				// A specific transaction detail page exists and is more exact,
				// but only new rows (created after this fix) carry
				// metadata.transactionId. Deliberately ignores the raw actionUrl
				// otherwise: older stored rows may still hold the historical,
				// non-existent "/dashboard/clients-overview/finance/wallet"
				// value — recomputing the plain wallet route here normalizes
				// every such row without a DB migration/backfill.
				return metadata.transactionId
					? `${basePath}/finance/transactions/${metadata.transactionId}`
					: `${basePath}/finance/wallet`;
			default:
				// Covers GENERAL and any future/unrecognized type: never
				// fabricates a route, only ever trusts an already-real,
				// same-app actionUrl.
				return this.isSafeInternalUrl(nt?.actionUrl, basePath) ? nt!.actionUrl! : null;
		}
	}

	/**
	 * PROJECT_MATCH ("فرصة مشروع جديدة") → the exact Marketplace opportunity.
	 * The opportunity entity is a ClientRequest; its id is also the id of
	 * the mirrored legacy Project row the backend creates alongside it, so
	 * explore-requests/:id/apply (which loads GET /projects/:id/summary and
	 * hosts the offer form) is the exact "view details + submit offer" page —
	 * the same route the Marketplace list's own "تقديم عرض" button opens.
	 *
	 * Order of precedence, never parsing the notification title:
	 *  1. metadata.clientRequestId (every row created by the current backend).
	 *  2. A structured id inside the stored actionUrl: either the current
	 *     "/provider-overview/explore-requests/<id>/apply" or the historical
	 *     "/provider-overview/projects/<clientRequestId>" value the backend
	 *     wrote before metadata existed (that route never existed in the
	 *     provider router, which is why old rows were dead links).
	 *  3. The Marketplace list itself — never an unrelated page.
	 */
	private resolveProjectMatchTarget(metadata: any, actionUrl: string | null | undefined): string {
		const marketplace = '/provider-overview/explore-requests';
		const safeId = (value: unknown): string | null =>
			typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;

		const metaId = safeId(metadata?.clientRequestId);
		if (metaId) return `${marketplace}/${metaId}/apply`;

		const path = typeof actionUrl === 'string' ? actionUrl.split(/[?#]/)[0].replace(/\/+$/, '') : '';
		const current = /^\/provider-overview\/explore-requests\/([^/]+)\/apply$/.exec(path);
		const legacy = /^\/provider-overview\/projects\/([^/]+)$/.exec(path);
		// Real sibling routes under /projects that must never be mistaken for an id.
		const reserved = new Set(['active', 'archived', 'phases', 'progress']);
		const urlId = safeId(current?.[1] ?? (legacy && !reserved.has(legacy[1]) ? legacy[1] : undefined));
		if (urlId) return `${marketplace}/${urlId}/apply`;

		return marketplace;
	}

	/**
	 * True only for a relative path into one of this app's own dashboard
	 * sections (the sole existing "is this navigable" concept in the app —
	 * see resolveNotificationTarget()). Rejects anything else outright,
	 * including a bare "/marketer-overview" with no trailing segment, any
	 * other internal route, and — since it requires the string to start with
	 * one of these exact known-safe prefixes — any absolute/external URL or
	 * a "javascript:" pseudo-protocol (neither can ever start with
	 * "/provider-overview/" etc.).
	 */
	private isSafeInternalUrl(url: string | null | undefined, viewerBase?: NotificationBasePath): url is string {
		if (!url) return false;
		// A multi-role account sees every notification of the user in each dashboard: a stored URL that belongs to ANOTHER role's
		// dashboard (e.g. /marketer-overview/... seen from the provider page) is not a destination for this viewer.
		if (viewerBase) return url.startsWith(`${viewerBase}/`);
		return NotificationEngineService.SAFE_BASE_PATHS.some(base => url.startsWith(`${base}/`));
	}

	/**
	 * Builds a trusted, ready-to-render <svg>...</svg> block from one of this
	 * file's own static IconStyle path constants — the single place any
	 * surface (bell dropdown, provider/client full pages) should go through
	 * to render a notification icon. Angular's default [innerHTML] sanitizer
	 * strips <svg>/<path>/<circle> elements from a plain string (they are
	 * not on its safe-elements allowlist), so binding a raw concatenated
	 * string directly to [innerHTML] silently renders an empty icon box.
	 * bypassSecurityTrustHtml() is safe here specifically because the inner
	 * markup always comes from this service's own static icon maps, never
	 * from backend/user-controlled content.
	 */
	buildIconHtml(innerMarkup: string): SafeHtml {
		const cached = this.iconHtmlCache.get(innerMarkup);
		if (cached) return cached;
		const html = this.sanitizer.bypassSecurityTrustHtml(
			`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${innerMarkup}</svg>`
		);
		this.iconHtmlCache.set(innerMarkup, html);
		return html;
	}

	private formatRelativeTime(date: Date): string {
		const diffMs = Date.now() - date.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin < 1) return 'الآن';
		if (diffMin < 60) return `منذ ${diffMin} د`;
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return `منذ ${diffHr} س`;
		return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
	}

	private resolveDateCategory(date: Date): 'اليوم' | 'أمس' | 'أقدم' {
		const now = new Date();
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
		if (date >= startOfToday) return 'اليوم';
		if (date >= startOfYesterday) return 'أمس';
		return 'أقدم';
	}
}
