import { adminRoleOf, resolveActiveRole, roleLinks } from '../../../core/routing/role-routes';
import { Component, ChangeDetectionStrategy, signal, computed, inject, Output, EventEmitter, ChangeDetectorRef, effect, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../../core/store/auth.store';
import { AccountService } from '../../../core/services/account.service';
import { UiNotificationService } from '../../../core/services/ui-notification.service';
import { NotificationEngineService } from '../../../core/services/notification-engine.service';
import { NotificationNavigator } from '../../../core/services/notification-navigator.service';
import { normalizeLegacyNotificationUrl } from '../../../core/routing/notification-links';
import { ThemeService } from '../../../core/services/theme.service';
import { ChatStateService } from '../../../core/services/chat-state.service';
import { UserRole } from '../../../core/models/auth.model';
import { NotificationPopupComponent } from '../../notification-popup/notification-popup';
import { NotificationBell } from '../../notification-bell/notification-bell';
import { getDefaultDashboard } from '../../../core/guards/auth.guards';
import { AssistantStore } from '../../../core/store/assistant.store';
import { AdminAccessService } from '../../../core/services/admin-access.service';

@Component({
	selector: 'app-nav-dashboard',
	standalone: true,
	imports: [CommonModule, RouterModule, NotificationBell, NotificationPopupComponent],
	templateUrl: './nav-dashboard.html',
	styleUrl: './nav-dashboard.css',
	host: {
		'ngSkipHydration': 'true'
	},
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavDashboard {
	@Output() toggleSidebar = new EventEmitter<void>();

	public authStore = inject(AuthStore);
	public accountService = inject(AccountService);
	public router = inject(Router);
	public notifEngine = inject(NotificationEngineService);
	private adminAccess = inject(AdminAccessService);
	private notificationNavigator = inject(NotificationNavigator);
	private notify = inject(UiNotificationService);
	public themeService = inject(ThemeService);
	public chatState = inject(ChatStateService);
	public assistantStore = inject(AssistantStore, { optional: true });
	private cdRef = inject(ChangeDetectorRef);
	private el = inject(ElementRef);

	characterName = computed(() => this.assistantStore?.characterName() || 'نديم');

	toggleAssistant(): void {
		if (this.assistantStore) {
			if (this.assistantStore.dismissed()) {
				this.assistantStore.restore();
				this.assistantStore.open();
			} else if (this.assistantStore.panelOpen()) {
				this.assistantStore.close();
			} else {
				this.assistantStore.open();
			}
		} else if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('waseet-toggle-assistant'));
		}
	}

	@HostListener('document:click', ['$event'])
	onDocumentClick(event: Event) {
		if (this.isUserDropdownOpen()) {
			const clickedInside = this.el.nativeElement.querySelector('.t-user-wrap')?.contains(event.target as Node);
			if (!clickedInside) {
				this.isUserDropdownOpen.set(false);
				this.isDashSubMenuOpen.set(false);
			}
		}
	}

	constructor() {
		effect(() => {
			// Access signals to subscribe effect to updates
			this.chatState.totalUnreadCount();
			this.notifEngine.unreadCount();
			this.cdRef.markForCheck();
		});
	}

	UserRole = UserRole;

	isUserDropdownOpen = signal(false);
	isDashSubMenuOpen = signal(false);

	currentUser = this.authStore.currentUser;

	userFullName = computed(() => {
		const user = this.currentUser();
		return user ? `${user.firstName} ${user.lastName}` : 'مستخدم';
	});

	userInitials = computed(() => {
		const user = this.currentUser();
		return user ? user.firstName.substring(0, 2) : 'مح';
	});

	userRoles = computed<UserRole[]>(() => {
		const user = this.currentUser();
		if (user?.roles && user.roles.length > 0) {
			return user.roles;
		}
		return [UserRole.CLIENT];
	});

	activeRole = computed<UserRole>(() => resolveActiveRole(this.currentUser()));

	/** An admin account has ONE experience, the admin panel: no role list, no role switch (the server refuses it too), just a direct link. */
	isAdminAccount = computed(() => adminRoleOf(this.currentUser()) !== null);

	/** Messages / profile / settings / add-account of the ACTIVE role (a marketer never gets client links). */
	links = computed(() => roleLinks(this.activeRole()));

	/** An admin account shows its REAL administrative role (the platform owner, or the team role the owner gave it, or «غير مُسند»), never a generic title that suggests authority it was not given. */
	accountTypeLabel = computed(() => {
		if (this.isAdminAccount()) return this.adminAccess.displayRole() || 'حساب إداري';
		const role = this.activeRole();
		return this.getRoleLabel(role);
	});

	accountEntityLabel = computed(() => {
		if (this.isAdminAccount()) return '';
		const type = this.currentUser()?.accountType;
		if (type?.includes('COMPANY')) return 'شركة';
		if (type?.includes('INDIVIDUAL')) return 'فرد';
		return '';
	});

	getRoleLabel(role: UserRole): string {
		switch (role) {
			case UserRole.SUPER_ADMIN:
				return 'مدير النظام';
			case UserRole.ADMIN:
				return 'مشرف النظام';
			case UserRole.PROVIDER:
				return 'مقدم الخدمة';
			case UserRole.AFFILIATE:
				return 'الوسيط التسويقي';
			case UserRole.CLIENT:
			default:
				return 'طالب الخدمة';
		}
	}

	getRoleDashboardUrl(role: UserRole): string {
		switch (role) {
			case UserRole.PROVIDER:
				return '/provider-overview';
			case UserRole.AFFILIATE:
				return '/marketer-overview';
			case UserRole.CLIENT:
			default:
				return '/client-overview';
		}
	}

	onToggleSidebar() {
		this.toggleSidebar.emit();
	}

	toggleUserDropdown() {
		this.isUserDropdownOpen.update(v => !v);
	}

	toggleDashSubMenu(event: Event) {
		event.stopPropagation();
		this.isDashSubMenuOpen.update(v => !v);
	}

	switchRole(role: UserRole) {
		if (role === this.activeRole()) {
			// The row for the account that looks active is still a "take me to my dashboard" shortcut. But "looks active" is only this tab's belief: another tab / device
			// may have switched the account since. So the (idempotent) switch is ALWAYS sent first — the server answers with the authoritative role + a fresh token, which
			// AccountService stores — and only then the SPA navigates. If the call fails the menu says so and nothing moves.
			this.accountService.switchActiveRole(role).subscribe({
				next: () => {
					this.isUserDropdownOpen.set(false);
					this.isDashSubMenuOpen.set(false);
					this.router.navigateByUrl(getDefaultDashboard(this.currentUser()?.accountType, role));
				},
				error: (err: any) => this.notify.error(err?.error?.message || 'تعذر تبديل الحساب', { title: 'خطأ في تبديل الحساب' })
			});
			return;
		}

		this.accountService.switchActiveRole(role).subscribe({
			next: () => {
				this.isUserDropdownOpen.set(false);
				this.isDashSubMenuOpen.set(false);
				this.notify.success(`أنت الآن في لوحة ${this.getRoleLabel(role)}`, { title: 'تم تبديل الحساب بنجاح' });

				const targetUrl = this.getRoleDashboardUrl(role);
				if (typeof window !== 'undefined') {
					window.location.href = targetUrl;
				} else {
					this.router.navigate([targetUrl]);
				}
			},
			error: (err: any) => {
				const msg = err?.error?.message || 'تعذر تبديل الحساب';
				this.notify.error(msg, { title: 'خطأ في تبديل الحساب' });
			}
		});
	}

	logout() {
		this.authStore.logout('/auth/login');
	}

}
