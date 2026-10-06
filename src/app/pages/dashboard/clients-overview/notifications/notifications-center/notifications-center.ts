import { Component, ChangeDetectionStrategy, signal, computed, OnInit, OnDestroy, inject, effect, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationEngineService, AppNotification } from '../../../../../core/services/notification-engine.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { Subscription } from 'rxjs';
import { filter, take, switchMap } from 'rxjs/operators';

export type { AppNotification };

@Component({
	selector: 'app-notifications-center',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './notifications-center.html',
	styleUrl: './notifications-center.css',
	styles: [`
    :host {
      display: block;
      width: 100%;
      animation: ws-fade 0.2s ease forwards;
    }
    @keyframes ws-fade {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes skel-pulse {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .skeleton-box, .skeleton-row {
      background: linear-gradient(90deg, rgba(255,255,255,.05) 25%, rgba(255,255,255,.10) 50%, rgba(255,255,255,.05) 75%);
      background-size: 200% 100%;
      animation: skel-pulse 1.5s infinite;
    }
    :host-context([data-theme='light']) .skeleton-box,
    :host-context([data-theme='light']) .skeleton-row {
      background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
      background-size: 200% 100%;
    }

    /* Notification Row */
    .nt {
      display: flex;
      gap: 13px;
      padding: 15px 17px;
      border-radius: 13px;
      border: 1px solid var(--sec-bd, rgba(255,255,255,.07));
      background: var(--crd-bg, linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,.01)));
      margin-bottom: 10px;
      transition: border-color .15s, transform .15s;
      cursor: pointer;
    }
    :host-context([data-theme='light']) .nt {
      background: #ffffff;
      border-color: #E7EAF1;
    }
    .nt:hover {
      border-color: rgba(43,212,199,.25);
      transform: translateY(-1px);
    }
    .nt.unread {
      background: linear-gradient(135deg, rgba(43,212,199,.06), rgba(43,127,255,.04));
      border-color: rgba(43,212,199,.20);
    }
    :host-context([data-theme='light']) .nt.unread {
      background: #F0FBFA;
      border-color: #A3ECE5;
    }

    .nt-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #2BD4C7;
      flex-shrink: 0;
    }

    /* Notification Icon Container */
    .nt-ico {
      width: 30px;
      height: 30px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .nt-ico svg {
      width: 14px;
      height: 14px;
    }

    /* Filter Chips */
    .filter-chip {
      padding: 7px 14px;
      background: var(--inp-bg, rgba(255,255,255,.04));
      border: 1px solid var(--sec-bd, rgba(255,255,255,.10));
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      color: var(--txt-3, #A8B2D1);
      cursor: pointer;
      transition: all .15s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    :host-context([data-theme='light']) .filter-chip {
      background: #F8FAFC;
      border-color: #D8DFEC;
      color: #64748B;
    }
    .filter-chip:hover {
      background: rgba(255,255,255,.08);
      color: var(--txt, #fff);
    }
    :host-context([data-theme='light']) .filter-chip:hover {
      background: #E2E8F0;
      color: #0F172A;
    }
    .filter-chip.active {
      background: rgba(43,212,199,.12);
      border-color: rgba(43,212,199,.30);
      color: #2BD4C7;
    }
    :host-context(body.light) .filter-chip.active,
    :host-context(.light-theme) .filter-chip.active,
    :host-context(.theme-light) .filter-chip.active {
      background: rgba(43,212,199,.15);
      border-color: rgba(43,212,199,.40);
      color: #0F172A;
    }

    .fc-count {
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      background: var(--sec-bd, rgba(255,255,255,.08));
      font-size: 10px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
    }
    :host-context([data-theme='light']) .fc-count {
      background: #E2E8F0;
      color: #475569;
    }
    .filter-chip.active .fc-count {
      background: rgba(43,212,199,.2);
      color: inherit;
    }
    :host-context(body.light) .filter-chip.active .fc-count,
    :host-context(.light-theme) .filter-chip.active .fc-count,
    :host-context(.theme-light) .filter-chip.active .fc-count {
      background: rgba(43,212,199,.25);
      color: #0F172A;
    }
  `],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsCenter implements OnInit, OnDestroy {
	private notificationEngine = inject(NotificationEngineService);
	private router = inject(Router);
	private authStore = inject(AuthStore);
	private platformId = inject(PLATFORM_ID);

	// State
	activeFilter = signal<string>('all');
	isLoading = signal<boolean>(true);
	hasError = signal<boolean>(false);
	toastMessage = signal<string | null>(null);

	filters = [
		{ id: 'all', label: 'الكل' },
		{ id: 'offers', label: 'عروض' },
		{ id: 'projects', label: 'مشاريع' },
		{ id: 'finance', label: 'مالية' },
		{ id: 'ai', label: 'ذكاء AI' },
	];

	// Database notifications state
	notifications = signal<AppNotification[]>([]);

	private dataSub?: Subscription;

	/**
	 * Normalizes a raw backend/socket notification the same way the bell
	 * dropdown and the provider notifications page do (icon, time, date
	 * grouping, category), via the single shared mapper — passing
	 * '/client-overview' so role-aware types (CHAT, FINANCIAL) resolve to
	 * this dashboard's real routes instead of the resolver's provider
	 * default. Types with no dedicated case (e.g. NEW_PROPOSAL,
	 * STAGE_DELIVERY) fall through to the resolver's own raw-actionUrl
	 * passthrough, which already accepts a /client-overview/ prefix.
	 */
	private toClientNotification(raw: any): AppNotification {
		return this.notificationEngine.mapToAppNotification(raw, '/client-overview');
	}

	constructor() {
		effect(() => {
			const newNotif = this.notificationEngine.realtimeNewNotification();
			if (newNotif && newNotif.id) {
				const existing = this.notifications().find(n => n.id === newNotif.id);
				if (!existing) {
					const mapped = this.toClientNotification(newNotif);
					this.notifications.update(list => [mapped, ...list]);
				}
			}
		});

		effect(() => {
			const readId = this.notificationEngine.realtimeReadNotification();
			if (readId) {
				this.notifications.update(list =>
					list.map(n => n.id === readId ? { ...n, isUnread: false } : n)
				);
			}
		});

		effect(() => {
			if (this.notificationEngine.realtimeReadAll()) {
				this.notifications.update(list =>
					list.map(n => ({ ...n, isUnread: false }))
				);
			}
		});
	}

	ngOnInit() {
		// Do NOT call authenticated endpoints during SSR.
		if (!isPlatformBrowser(this.platformId)) {
			this.isLoading.set(false);
			return;
		}

		// Browser: wait for auth initialization, then fetch exactly once.
		this.dataSub = this.authStore.isInitialized$.pipe(
			filter((initialized) => initialized),
			take(1),
			switchMap(() => this.notificationEngine.fetchNotifications())
		).subscribe({
			next: (res: any) => {
				this.isLoading.set(false);
				if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
					this.notifications.set(res.data.map((raw: any) => this.toClientNotification(raw)));
					this.notificationEngine.unreadCount.set(this.unreadCount());
				} else {
					// No notifications yet: the page's "لا توجد إشعارات" empty state is shown — never invented items.
					this.notifications.set([]);
				}
			},
			error: (err: any) => {
				if (!(err?.status === 401 && err?.statusText?.includes('SSR Bypassed'))) {
					console.error('Failed to load client notifications:', err);
				}
				// Honest error state ("تعذر تحميل الإشعارات" + retry) instead of invented notifications.
				this.notifications.set([]);
				this.hasError.set(true);
				this.isLoading.set(false);
			}
		});
	}

	ngOnDestroy() {
		this.dataSub?.unsubscribe();
	}

	// Computed Properties
	filteredNotifications = computed(() => {
		const filter = this.activeFilter();
		if (filter === 'all') return this.notifications();
		return this.notifications().filter(n => n.category === filter);
	});

	unreadCount = computed(() => {
		return this.notifications().filter(n => n.isUnread).length;
	});

	groupedNotifications = computed(() => {
		const list = this.filteredNotifications();
		const groups: { date: string, items: AppNotification[] }[] = [];
		list.forEach(nt => {
			let g = groups.find(x => x.date === nt.dateCategory);
			if (!g) {
				g = { date: nt.dateCategory, items: [] };
				groups.push(g);
			}
			g.items.push(nt);
		});
		return groups;
	});

	filterCount(catId: string) {
		if (catId === 'all') return this.notifications().length;
		return this.notifications().filter(n => n.category === catId).length;
	}

	// Actions
	setFilter(filterId: string) {
		this.activeFilter.set(filterId);
	}

	markAllRead() {
		this.notificationEngine.markAllNotificationsAsRead().subscribe({
			next: () => {
				this.notifications.update(list =>
					list.map(n => ({ ...n, isUnread: false }))
				);
				this.notificationEngine.unreadCount.set(0);
				this.showToast('تم تعليم كل الإشعارات كمقروءة');
			},
			error: (err) => {
				console.error('Error marking all as read:', err);
				this.notifications.update(list =>
					list.map(n => ({ ...n, isUnread: false }))
				);
				this.showToast('تم تعليم كل الإشعارات كمقروءة');
			}
		});
	}

	onNotificationClick(nt: AppNotification) {
		if (nt.isUnread) {
			this.notificationEngine.markNotificationAsRead(nt.id).subscribe({
				next: () => {
					this.notifications.update(list =>
						list.map(n => n.id === nt.id ? { ...n, isUnread: false } : n)
					);
					this.notificationEngine.unreadCount.set(this.unreadCount());
				}
			});
		}
		if (nt.actionUrl) {
			// actionUrl may include a query string (e.g. a CHAT notification's
			// ?conversationId=...) — navigateByUrl parses it correctly, unlike
			// navigate([...]) which treats a single array element as a literal
			// path segment and would mangle the "?". Matches the provider
			// notifications page's own click handler.
			this.router.navigateByUrl(nt.actionUrl);
		}
	}

	retry() {
		this.dataSub?.unsubscribe();
		this.isLoading.set(true);
		this.hasError.set(false);
		this.dataSub = this.notificationEngine.fetchNotifications().subscribe({
			next: (res: any) => {
				this.isLoading.set(false);
				if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
					this.notifications.set(res.data.map((raw: any) => this.toClientNotification(raw)));
					this.notificationEngine.unreadCount.set(this.unreadCount());
				} else {
					this.notifications.set([]);
				}
			},
			error: () => {
				this.notifications.set([]);
				this.hasError.set(true);
				this.isLoading.set(false);
			}
		});
	}

	showToast(msg: string) {
		this.toastMessage.set(msg);
		setTimeout(() => {
			this.toastMessage.set(null);
		}, 3000);
	}

	goToSettings() {
		this.router.navigate(['/client-overview/notifications/settings']);
	}
}
