import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NotificationEngineService } from '../../../../core/services/notification-engine.service';
import { MarketerOverviewService, MarketerSummary } from '../../../../core/services/marketer-overview.service';

interface RawNotification {
	id: string;
	title: string;
	message: string;
	category?: string; // backend enum: ALL | OFFERS | PROJECTS | FINANCIAL | AI
	type?: string;
	actionUrl?: string | null;
	actionText?: string | null;
	isRead?: boolean;
	isUnread?: boolean;
	createdAt: string;
}

interface DisplayNotification extends RawNotification {
	timeLabel: string;
	dateCategory: 'اليوم' | 'أمس' | 'أقدم';
	iconBgClass: string;
	iconColorClass: string;
	svgIcon: string;
	categoryLabel: string;
	filterGroup: 'offers' | 'finance' | 'ai';
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
	activeFilter = signal<'all' | 'offers' | 'finance' | 'ai'>('all');

	filters: { id: 'all' | 'offers' | 'finance' | 'ai'; label: string }[] = [
		{ id: 'all', label: 'الكل' },
		{ id: 'offers', label: 'إحالات' },
		{ id: 'finance', label: 'عمولات' },
		{ id: 'ai', label: 'نظام' },
	];

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

	filterCount(id: 'all' | 'offers' | 'finance' | 'ai'): number {
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

	setFilter(id: 'all' | 'offers' | 'finance' | 'ai'): void {
		this.activeFilter.set(id);
	}

	markAllRead(): void {
		this.notificationEngine.markAllNotificationsAsRead().subscribe({
			next: () => this.applyMarkAllRead(),
			error: () => this.applyMarkAllRead()
		});
	}

	private applyMarkAllRead(): void {
		this.notifications.update(list => list.map(n => ({ ...n, isUnread: false, isRead: true })));
		this.notificationEngine.unreadCount.set(0);
		this.showToast('تم تعليم كل الإشعارات كمقروءة');
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
		if (nt.actionUrl) {
			this.router.navigate([nt.actionUrl]);
		}
	}

	private showToast(msg: string): void {
		this.toastMessage.set(msg);
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => this.toastMessage.set(null), 3000);
	}

	/** Maps a raw category/type into the display grouping used by the filter chips. */
	private mapFilterGroup(category?: string): 'offers' | 'finance' | 'ai' {
		const c = (category || '').toUpperCase();
		if (c === 'FINANCIAL') return 'finance';
		if (c === 'AI' || c === 'PROJECTS') return 'ai';
		return 'offers';
	}

	private iconFor(group: 'offers' | 'finance' | 'ai'): { bg: string; color: string; svg: string; label: string } {
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
				label: 'نظام'
			};
		}
		return {
			bg: 'bg-[rgba(43,212,199,.14)]', color: 'text-[#2BD4C7]',
			svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
			label: 'إحالات'
		};
	}

	private toDisplay(raw: RawNotification): DisplayNotification {
		const group = this.mapFilterGroup(raw.category);
		const icon = this.iconFor(group);
		return {
			...raw,
			isUnread: raw.isUnread ?? !raw.isRead,
			timeLabel: this.relativeTime(raw.createdAt),
			dateCategory: this.dateBucket(raw.createdAt),
			iconBgClass: icon.bg,
			iconColorClass: icon.color,
			svgIcon: icon.svg,
			categoryLabel: icon.label,
			filterGroup: group,
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
