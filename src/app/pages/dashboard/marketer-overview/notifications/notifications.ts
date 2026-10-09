import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { SafeHtml } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { NotificationEngineService } from '../../../../core/services/notification-engine.service';
import { MarketerOverviewService, MarketerSummary } from '../../../../core/services/marketer-overview.service';

interface RawNotification {
	id: string;
	title: string;
	message: string;
	category?: string; // backend enum: ALL | OFFERS | PROJECTS | FINANCIAL | AI
	type?: string;
	metadata?: Record<string, unknown> | null;
	actionUrl?: string | null;
	actionText?: string | null;
	/** Resolved, same-dashboard destination (see resolveTarget): never the raw stored URL. */
	target?: string;
	isRead?: boolean;
	isUnread?: boolean;
	createdAt: string;
}

type FilterGroup = 'finance' | 'general' | 'ai';
type FilterId = 'all' | FilterGroup;

interface DisplayNotification extends RawNotification {
	timeLabel: string;
	dateCategory: 'اليوم' | 'أمس' | 'أقدم';
	iconBgClass: string;
	iconColorClass: string;
	svgIcon: string;
	/** The same icon as a trusted SafeHtml (a plain string bound to [innerHTML] has its <svg> stripped by Angular's sanitizer: an empty icon box). */
	iconHtml: SafeHtml;
	categoryLabel: string;
	filterGroup: FilterGroup;
}


@Component({
	selector: 'app-marketer-notifications',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './notifications.html',
	styleUrl: './notifications.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notifications implements OnInit, OnDestroy {
	private notificationEngine = inject(NotificationEngineService);
	private overviewService = inject(MarketerOverviewService);
	private router = inject(Router);

	summary = signal<MarketerSummary | null>(null);

	isLoading = signal(true);
	hasError = signal(false);
	toastMessage = signal<string | null>(null);
	private toastTimer: any = null;

	notifications = signal<DisplayNotification[]>([]);
	activeFilter = signal<FilterId>('all');
	markingAll = signal(false);

	// Only groups that really exist for a marketer: commissions/finance, general account notices (KYC, requests, chat…), and AI ones when present.
	private readonly allFilters: { id: FilterId; label: string }[] = [
		{ id: 'all', label: 'الكل' },
		{ id: 'finance', label: 'عمولات' },
		{ id: 'general', label: 'عام' },
		{ id: 'ai', label: 'ذكاء AI' },
	];
	filters = computed(() => this.allFilters.filter(f => f.id !== 'ai' || this.notifications().some(n => n.filterGroup === 'ai') || this.activeFilter() === 'ai'));

	unreadLabel = computed(() => {
		const n = this.unreadCount();
		if (n === 0) return 'لا توجد إشعارات غير مقروءة';
		if (n === 1) return 'إشعار واحد غير مقروء';
		if (n === 2) return 'إشعاران غير مقروءين';
		return n <= 10 ? `${n} إشعارات غير مقروءة` : `${n} إشعارًا غير مقروء`;
	});

	filteredNotifications = computed(() => {
		const filter = this.activeFilter();
		const list = this.notifications();
		return filter === 'all' ? list : list.filter(n => n.filterGroup === filter);
	});

	groupedNotifications = computed(() => {
		const list = this.filteredNotifications();
		const groups: { date: string; items: DisplayNotification[] }[] = [];
		for (const nt of list) {
			let g = groups.find(x => x.date === nt.dateCategory);
			if (!g) { g = { date: nt.dateCategory, items: [] }; groups.push(g); }
			g.items.push(nt);
		}
		return groups;
	});

	unreadCount = computed(() => this.notifications().filter(n => n.isUnread).length);

	filterCount(id: FilterId): number {
		const list = this.notifications();
		return id === 'all' ? list.length : list.filter(n => n.filterGroup === id).length;
	}

	constructor() {
		effect(() => {
			const newNotif = this.notificationEngine.realtimeNewNotification();
			if (newNotif && newNotif.id && !this.notifications().some(n => n.id === newNotif.id)) {
				this.notifications.update(list => [this.toDisplay(newNotif), ...list]);
			}
		});

		effect(() => {
			const readId = this.notificationEngine.realtimeReadNotification();
			if (readId) {
				this.notifications.update(list => list.map(n => n.id === readId ? { ...n, isUnread: false } : n));
			}
		});

		effect(() => {
			if (this.notificationEngine.realtimeReadAll()) {
				this.notifications.update(list => list.map(n => ({ ...n, isUnread: false })));
			}
		});
	}

	ngOnInit(): void {
		this.loadNotifications();
		this.overviewService.getSummary().subscribe(res => {
			if (res.success) this.summary.set(res.data);
		});
	}

	ngOnDestroy(): void {
		if (this.toastTimer) clearTimeout(this.toastTimer);
	}

	loadNotifications(): void {
		this.isLoading.set(true);
		this.hasError.set(false);

		this.notificationEngine.fetchNotifications().subscribe({
			next: (res: any) => {
				this.isLoading.set(false);
				const items: RawNotification[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
				this.notifications.set(items.map(n => this.toDisplay(n)));
				this.notificationEngine.unreadCount.set(this.unreadCount());
			},
			error: (err: any) => {
				console.error('Failed to load notifications:', err);
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	retry(): void {
		this.loadNotifications();
	}

	setFilter(id: FilterId): void {
		this.activeFilter.set(id);
	}

	markAllRead(): void {
		if (this.unreadCount() === 0 || this.markingAll()) return;
		this.markingAll.set(true);
		this.notificationEngine.markAllNotificationsAsRead().subscribe({
			next: () => {
				this.markingAll.set(false);
				this.notifications.update(list => list.map(n => ({ ...n, isUnread: false, isRead: true })));
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

	onNotificationClick(nt: DisplayNotification): void {
		if (nt.isUnread) {
			this.notificationEngine.markNotificationAsRead(nt.id).subscribe({
				next: () => {
					this.notifications.update(list => list.map(n => n.id === nt.id ? { ...n, isUnread: false, isRead: true } : n));
					this.notificationEngine.unreadCount.set(this.unreadCount());
				}
			});
		}
		if (nt.target) this.router.navigateByUrl(nt.target);
	}

	private showToast(msg: string): void {
		this.toastMessage.set(msg);
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => this.toastMessage.set(null), 3000);
	}

	/** Display group from the real category/type (never "everything else is offers", never PROJECTS-as-AI). */
	private mapFilterGroup(raw: RawNotification): FilterGroup {
		const c = (raw.category || '').toUpperCase();
		if (c === 'AI') return 'ai';
		if (c === 'FINANCIAL' || raw.type === 'FINANCIAL') return 'finance';
		return 'general';
	}

	/**
	 * A real, existing marketer route or nothing (no CTA, no navigation): CHAT -> this dashboard's messages with the conversation,
	 * FINANCIAL -> commissions, anything else only when its stored URL is already inside /marketer-overview/.
	 */
	private resolveTarget(raw: RawNotification): string | undefined {
		const meta = (raw.metadata || {}) as Record<string, unknown>;
		if (raw.type === 'CHAT') return typeof meta['conversationId'] === 'string' ? `/marketer-overview/messages?conversationId=${meta['conversationId']}` : undefined;
		if (raw.type === 'FINANCIAL') return '/marketer-overview/commissions';
		const url = raw.actionUrl;
		return typeof url === 'string' && url.startsWith('/marketer-overview/') ? url : undefined;
	}

	private iconFor(group: FilterGroup): { bg: string; color: string; svg: string; label: string } {
		if (group === 'finance') {
			return {
				bg: 'bg-[rgba(15,169,154,.14)]', color: 'text-[#0FA99A]',
				svg: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
				label: 'عمولات'
			};
		}
		if (group === 'ai') {
			return {
				bg: 'bg-[rgba(123,47,190,.14)]', color: 'text-[#A56BE0]',
				svg: '<circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/><path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/>',
				label: 'ذكاء AI'
			};
		}
		return {
			bg: 'bg-[rgba(160,178,209,.12)]', color: 'text-[var(--txt-3)]',
			svg: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>',
			label: 'عام'
		};
	}

	private toDisplay(raw: RawNotification): DisplayNotification {
		const group = this.mapFilterGroup(raw);
		const icon = this.iconFor(group);
		return {
			...raw,
			isUnread: raw.isUnread ?? !raw.isRead,
			timeLabel: this.relativeTime(raw.createdAt),
			dateCategory: this.dateBucket(raw.createdAt),
			iconBgClass: icon.bg,
			iconColorClass: icon.color,
			svgIcon: icon.svg,
			iconHtml: this.notificationEngine.buildIconHtml(icon.svg),
			categoryLabel: icon.label,
			filterGroup: group,
			target: this.resolveTarget(raw),
		};
	}

	private dateBucket(iso: string): 'اليوم' | 'أمس' | 'أقدم' {
		const d = new Date(iso);
		const now = new Date();
		const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
		const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
		if (diffDays <= 0) return 'اليوم';
		if (diffDays === 1) return 'أمس';
		return 'أقدم';
	}

	private relativeTime(iso: string): string {
		const d = new Date(iso);
		const diffMs = Date.now() - d.getTime();
		const diffMin = Math.floor(diffMs / 60000);

		if (diffMin < 1) return 'الآن';
		if (diffMin < 60) return `قبل ${diffMin} دقيقة`;
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return `قبل ${diffHr} ساعة`;
		const diffDays = Math.floor(diffHr / 24);
		if (diffDays === 1) return `أمس ${d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
		if (diffDays < 7) return `قبل ${diffDays} أيام`;
		return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
	}
}
