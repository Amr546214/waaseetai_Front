import { Component, ChangeDetectionStrategy, signal, computed, inject, ElementRef, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NotificationEngineService, AppNotification, NotificationBasePath } from '../../core/services/notification-engine.service';
import { AuthStore } from '../../core/store/auth.store';

@Component({
	selector: 'app-notification-bell',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './notification-bell.html',
	styleUrl: './notification-bell.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBell {
	private notifEngine = inject(NotificationEngineService);
	private authStore = inject(AuthStore);
	private router = inject(Router);
	private el = inject(ElementRef);

	unreadCount = this.notifEngine.unreadCount;

	isOpen = signal(false);
	isLoading = signal(false);
	hasError = signal(false);
	notifications = signal<AppNotification[]>([]);

	private loadedOnce = false;

	// This same bell is rendered in every dashboard's header (provider,
	// client, and marketer), so the base dashboard segment (used both for
	// "view all" and for resolving role-aware notification routes, e.g.
	// CHAT/FINANCIAL/GENERAL) must be derived from the CURRENT viewer, not
	// assumed to be one role. Matches the same accountType check already
	// used by nav-dashboard.ts/navbar.ts elsewhere in the header.
	dashboardBase = computed<NotificationBasePath>(() => {
		const accountType = this.authStore.currentUser()?.accountType;
		if (accountType?.includes('PROVIDER')) return '/provider-overview';
		if (accountType?.includes('MARKETING')) return '/marketer-overview';
		return '/client-overview';
	});

	viewAllLink = computed(() => `${this.dashboardBase()}/notifications`);

	constructor() {
		// Keep the already-loaded top-5 list in sync with the same real-time
		// signals the full notifications pages react to, so a dropdown left
		// open (or reopened) never shows stale data.
		effect(() => {
			const newNotif = this.notifEngine.realtimeNewNotification();
			if (newNotif && newNotif.id && this.loadedOnce) {
				const existing = this.notifications().find(n => n.id === newNotif.id);
				if (!existing) {
					const mapped = this.notifEngine.mapToAppNotification(newNotif, this.dashboardBase());
					this.notifications.update(list => [mapped, ...list].slice(0, 5));
				}
			}
		});

		effect(() => {
			const readId = this.notifEngine.realtimeReadNotification();
			if (readId) {
				this.notifications.update(list => list.map(n => n.id === readId ? { ...n, isUnread: false } : n));
			}
		});

		effect(() => {
			if (this.notifEngine.realtimeReadAll()) {
				this.notifications.update(list => list.map(n => ({ ...n, isUnread: false })));
			}
		});
	}

	@HostListener('document:click', ['$event'])
	onDocumentClick(event: Event) {
		if (this.isOpen() && !this.el.nativeElement.contains(event.target as Node)) {
			this.isOpen.set(false);
		}
	}

	@HostListener('document:keydown.escape')
	onEscape() {
		this.isOpen.set(false);
	}

	toggle(): void {
		// Matches the exact behavior the bell had before it opened a dropdown:
		// clicking it always reset the client-side unread dot, regardless of
		// whether anything was actually read.
		this.notifEngine.resetUnread();

		const next = !this.isOpen();
		this.isOpen.set(next);
		if (next && !this.loadedOnce) {
			this.load();
		}
	}

	private load(): void {
		this.loadedOnce = true;
		this.isLoading.set(true);
		this.hasError.set(false);

		this.notifEngine.fetchNotifications().subscribe({
			next: (res: any) => {
				this.isLoading.set(false);
				if (res && res.success && Array.isArray(res.data)) {
					const sorted = [...res.data].sort((a: any, b: any) => {
						const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
						const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
						return tb - ta;
					});
					const basePath = this.dashboardBase();
					this.notifications.set(sorted.slice(0, 5).map(raw => this.notifEngine.mapToAppNotification(raw, basePath)));
				} else {
					this.notifications.set([]);
				}
			},
			error: () => {
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	onItemClick(nt: AppNotification): void {
		if (nt.isUnread) {
			this.notifEngine.markNotificationAsRead(nt.id).subscribe({
				next: () => {
					this.notifications.update(list => list.map(n => n.id === nt.id ? { ...n, isUnread: false } : n));
				}
			});
		}

		this.isOpen.set(false);

		if (nt.actionUrl) {
			this.router.navigateByUrl(nt.actionUrl);
		}
	}

	onViewAllClick(): void {
		this.isOpen.set(false);
	}
}
