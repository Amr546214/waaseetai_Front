import { Component, ChangeDetectionStrategy, signal, computed, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NotificationEngineService, AppNotification } from '../../../../core/services/notification-engine.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';

export type { AppNotification };

@Component({
	selector: 'app-provider-notifications',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './notifications.html',
	styleUrl: './notifications.css',
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
    :host-context([data-theme='light']) .filter-chip.active {
      background: #E6FDFB;
      border-color: #2BD4C7;
      color: #007A72;
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
  `],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class Notifications implements OnInit {
	private notificationEngine = inject(NotificationEngineService);
	private router = inject(Router);
	private authStore = inject(AuthStore);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	// Company filter state
	coTypeFilter = signal<string>('all');
	coStatusFilter = signal<string>('all');
	coSearchQuery = signal('');
	coTab = signal<string>('all');

	coFilteredNotifications = computed(() => {
		let list = this.notifications();
		const type = this.coTypeFilter();
		const status = this.coStatusFilter();
		const tab = this.coTab();
		const q = this.coSearchQuery().toLowerCase();

		if (type !== 'all') {
			list = list.filter(n => this.mapCategoryToCo(n.category) === type);
		}
		if (status !== 'all') {
			list = list.filter(n => this.mapStatusToCo(n) === status);
		}
		if (tab !== 'all') {
			if (tab === 'new') list = list.filter(n => n.isUnread);
			else if (tab === 'read') list = list.filter(n => !n.isUnread);
			else if (tab === 'action') list = list.filter(n => this.needsAction(n));
		}
		if (q) {
			list = list.filter(n => (n.title + ' ' + n.message).toLowerCase().includes(q));
		}
		return list;
	});

	coTabCounts = computed(() => {
		const list = this.notifications();
		return {
			all: list.length,
			new: list.filter(n => n.isUnread).length,
			action: list.filter(n => this.needsAction(n)).length,
			read: list.filter(n => !n.isUnread).length,
		};
	});

	/** "Needs action" only when the notification carries a real, resolved destination: an action label alone is not an action. */
	private needsAction(n: AppNotification): boolean {
		return !!n.actionText && !!n.actionUrl;
	}

	private mapCategoryToCo(cat: string): string {
		if (cat === 'projects') return 'projects';
		if (cat === 'finance') return 'finance';
		if (cat === 'ai') return 'accreditation';
		if (cat === 'offers') return 'projects';
		if (cat === 'security') return 'support';
		return 'support';
	}

	private mapStatusToCo(n: AppNotification): string {
		if (this.needsAction(n)) return 'action';
		if (n.isUnread) return 'new';
		return 'read';
	}

	setCoTypeFilter(f: string) { this.coTypeFilter.set(f); }
	setCoStatusFilter(f: string) { this.coStatusFilter.set(f); }
	setCoTab(t: string) { this.coTab.set(t); }
	updateCoSearch(event: Event) {
		const input = event.target as HTMLInputElement;
		this.coSearchQuery.set(input.value);
	}

	coCategoryLabel(cat: string): string {
		const labels: Record<string, string> = {
			projects: 'مشاريع',
			finance: 'مالية',
			ai: 'اعتماد',
			offers: 'مشاريع',
			security: 'دعم',
		};
		return labels[cat] || 'دعم';
	}

	// State
	activeFilter = signal<string>('all');
	isLoading = signal<boolean>(true);
	hasError = signal<boolean>(false);
	toastMessage = signal<string | null>(null);
	markingAll = signal<boolean>(false);

	filters = [
		{ id: 'all', label: 'الكل' },
		{ id: 'offers', label: 'عروض' },
		{ id: 'projects', label: 'مشاريع' },
		{ id: 'finance', label: 'مالية' },
		{ id: 'ai', label: 'ذكاء AI' },
	];

	// Database notifications state
	notifications = signal<AppNotification[]>([]);

	constructor() {
		// Listen to real-time WebSocket signals from NotificationEngine
		effect(() => {
			const newNotif = this.notificationEngine.realtimeNewNotification();
			if (newNotif && newNotif.id) {
				const existing = this.notifications().find(n => n.id === newNotif.id);
				if (!existing) {
					const mapped = this.notificationEngine.mapToAppNotification(newNotif);
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
		this.loadNotifications();
	}

	loadNotifications() {
		this.isLoading.set(true);
		this.hasError.set(false);

		this.notificationEngine.fetchNotifications().subscribe({
			next: (res: any) => {
				this.isLoading.set(false);
				if (res && res.success && Array.isArray(res.data)) {
					this.notifications.set(res.data.map((raw: any) => this.notificationEngine.mapToAppNotification(raw)));
					this.notificationEngine.unreadCount.set(this.unreadCount());
				}
			},
			error: (err: any) => {
				console.error('Failed to load notifications from database:', err);
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
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

	/** The AI chip only exists when there really are AI notifications (or it is the open filter). */
	visibleFilters = computed(() => this.filters.filter(f => f.id !== 'ai' || this.notifications().some(n => n.category === 'ai') || this.activeFilter() === 'ai'));

	unreadLabel = computed(() => {
		const n = this.unreadCount();
		if (n === 0) return 'لا توجد إشعارات غير مقروءة';
		if (n === 1) return 'إشعار واحد غير مقروء';
		if (n === 2) return 'إشعاران غير مقروءين';
		return n <= 10 ? `${n} إشعارات غير مقروءة` : `${n} إشعارًا غير مقروء`;
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
		if (this.unreadCount() === 0 || this.markingAll()) return;
		this.markingAll.set(true);
		this.notificationEngine.markAllNotificationsAsRead().subscribe({
			next: () => {
				this.markingAll.set(false);
				this.notifications.update(list => list.map(n => ({ ...n, isUnread: false })));
				this.notificationEngine.unreadCount.set(0);
				this.showToast('تم تعليم كل الإشعارات كمقروءة');
			},
			error: () => {
				// Never fake it: the server did not record it, so the list and the counters stay as they are.
				this.markingAll.set(false);
				this.showToast('تعذر تعليم الإشعارات كمقروءة، حاول مرة أخرى');
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
			// actionUrl is a complete URL string (it may include a query string,
			// e.g. a chat notification's ?conversationId=...) — navigateByUrl
			// parses it correctly, unlike navigate([...]) which treats a single
			// array element as a literal path segment and would mangle the "?".
			this.router.navigateByUrl(nt.actionUrl);
		}
	}

	retry() {
		this.loadNotifications();
	}

	showToast(msg: string) {
		this.toastMessage.set(msg);
		setTimeout(() => {
			this.toastMessage.set(null);
		}, 3000);
	}
}
