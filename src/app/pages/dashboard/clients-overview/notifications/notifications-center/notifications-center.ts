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
					// Use demo fallback if API returns no data
					this.notifications.set(this.getDemoNotifications());
				}
			},
			error: (err: any) => {
				if (!(err?.status === 401 && err?.statusText?.includes('SSR Bypassed'))) {
					console.error('Failed to load client notifications, using demo fallback:', err);
				}
				this.notifications.set(this.getDemoNotifications());
				this.isLoading.set(false);
			}
		});
	}

	ngOnDestroy() {
		this.dataSub?.unsubscribe();
	}

	private getDemoNotifications(): AppNotification[] {
		// svgIcon here is raw inner <path>/<circle> markup, not yet a SafeHtml
		// block — wrapped through the shared buildIconHtml() below, the same
		// helper mapToAppNotification() uses for real data, so demo items
		// render through the exact same trusted-HTML mechanism.
		const items: (Omit<AppNotification, 'svgIcon'> & { svgIcon: string })[] = [
			// اليوم
			{
				id: 'demo-1', category: 'offers', title: 'عرض جديد على طلبك', time: 'قبل ساعة',
				message: 'قدّمت نورة التصنيم عرضًا على طلب تصميم الهوية البصرية بقيمة 4,500 ريال',
				isUnread: true, actionText: 'عرض العرض', actionUrl: '/client-overview/my-request',
				dateCategory: 'اليوم',
				iconColorClass: 'text-[#5DA0FF]', iconBgClass: 'bg-[rgba(43,127,255,.12)]',
				svgIcon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
			},
			{
				id: 'demo-2', category: 'projects', title: 'بانتظار اعتمادك', time: 'قبل 3 ساعات',
				message: 'رفع مقدّم الخدمة تسليم المرحلة 2، لديك 6 أيام للمراجعة',
				isUnread: true, actionText: 'مراجعة التسليم', actionUrl: '/client-overview/my-request',
				dateCategory: 'اليوم',
				iconColorClass: 'text-[#FFB400]', iconBgClass: 'bg-[rgba(255,180,0,.12)]',
				svgIcon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>'
			},
			{
				id: 'demo-3', category: 'ai', title: 'توصية من الذكاء', time: 'قبل 5 ساعات',
				message: 'طلبك الجديد يطابق 12 مقدّم خدمة بتقييم عالٍ، توقّع عروضًا خلال 24 ساعة',
				isUnread: true,
				dateCategory: 'اليوم',
				iconColorClass: 'text-[#A56BE0]', iconBgClass: 'bg-[rgba(123,47,190,.12)]',
				svgIcon: '<circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/><path d="M12 10V5M12 19v-5M10 12H5M19 12h-5"/>'
			},
			// أمس
			{
				id: 'demo-4', category: 'finance', title: 'كاش باك جديد', time: 'أمس',
				message: 'أُضيف 45 ريال كاش باك إلى محفظتك من مشروعك المكتمل',
				isUnread: false, actionText: 'عرض المحفظة', actionUrl: '/client-overview/finance',
				dateCategory: 'أمس',
				iconColorClass: 'text-[#0FA99A]', iconBgClass: 'bg-[rgba(15,169,154,.12)]',
				svgIcon: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>'
			},
			{
				id: 'demo-5', category: 'projects', title: 'اكتمل مشروع', time: 'أمس',
				message: 'اكتمل مشروع تصميم تطبيق الجوال بنجاح، لا تنسَ تقييم مقدّم الخدمة',
				isUnread: false, actionText: 'تقييم', actionUrl: '/client-overview/my-request',
				dateCategory: 'أمس',
				iconColorClass: 'text-[#0FA99A]', iconBgClass: 'bg-[rgba(15,169,154,.12)]',
				svgIcon: '<polyline points="20 6 9 17 4 12"/>'
			},
			{
				id: 'demo-6', category: 'security', title: 'تسجيل دخول جديد', time: 'أمس',
				message: 'تم تسجيل دخول لحسابك من جهاز جديد، إن لم يكن أنت راجع الأمان',
				isUnread: false,
				dateCategory: 'أمس',
				iconColorClass: 'text-[#5DA0FF]', iconBgClass: 'bg-[rgba(43,127,255,.12)]',
				svgIcon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
			},
		];
		return items.map(d => ({ ...d, svgIcon: this.notificationEngine.buildIconHtml(d.svgIcon) }));
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
					this.notifications.set(this.getDemoNotifications());
				}
			},
			error: (err: any) => {
				this.notifications.set(this.getDemoNotifications());
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
