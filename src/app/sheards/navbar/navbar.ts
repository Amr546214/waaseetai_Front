import { resolveActiveRole, roleHome, roleLinks } from '../../core/routing/role-routes';
import { Component, ChangeDetectionStrategy, signal, computed, inject, ChangeDetectorRef, effect, ElementRef, HostListener, PLATFORM_ID } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { AuthStore } from '../../core/store/auth.store';
import { AccountService } from '../../core/services/account.service';
import { UiNotificationService } from '../../core/services/ui-notification.service';
import { NotificationEngineService } from '../../core/services/notification-engine.service';
import { ChatStateService } from '../../core/services/chat-state.service';
import { CartService } from '../../core/services/cart.service';
import { UserRole, AccountType } from '../../core/models/auth.model';
import { getDefaultDashboard } from '../../core/guards/auth.guards';
import { NotificationPopupComponent } from '../notification-popup/notification-popup';
import { NotificationBell } from '../notification-bell/notification-bell';
import { AssistantStore } from '../../core/store/assistant.store';

@Component({
	selector: 'app-navbar',
	standalone: true,
	imports: [RouterModule, CommonModule, NotificationBell, NotificationPopupComponent],
	templateUrl: './navbar.html',
	styleUrl: './navbar.css',
	host: {
		'ngSkipHydration': 'true'
	},
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class Navbar {
	public themeService = inject(ThemeService);
	public authStore = inject(AuthStore);
	public accountService = inject(AccountService);
	public router = inject(Router);
	public notifEngine = inject(NotificationEngineService);
	private notify = inject(UiNotificationService);
	public chatState = inject(ChatStateService);
	public cartService = inject(CartService);
	public assistantStore = inject(AssistantStore, { optional: true });
	private cdRef = inject(ChangeDetectorRef);
	private el = inject(ElementRef);
	private platformId = inject(PLATFORM_ID);
	
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
	
	isMobileMenuOpen = false;
	exactMatchOptions = { exact: true };

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

	messagesLink = computed(() => {
		return roleLinks(resolveActiveRole(this.currentUser())).messages;
	});

	userRoles = computed<UserRole[]>(() => {
		const user = this.currentUser();
		if (user?.roles && user.roles.length > 0) {
			return user.roles;
		}
		return [UserRole.CLIENT];
	});

	activeRole = computed<UserRole>(() => resolveActiveRole(this.currentUser()));

	/** Profile / settings / add-account of the ACTIVE role. */
	links = computed(() => roleLinks(this.activeRole()));

	accountTypeLabel = computed(() => {
		const role = this.activeRole();
		return this.getRoleLabel(role);
	});

	accountEntityLabel = computed(() => {
		const type = this.currentUser()?.accountType;
		if (type?.includes('COMPANY')) return 'شركة';
		if (type?.includes('INDIVIDUAL')) return 'فرد';
		return '';
	});

	/** The dashboard / profile of the ACTIVE role (not of the account type). */
	get dashboardLink(): string {
		const user = this.authStore.currentUser();
		return user ? roleHome(resolveActiveRole(user)) : '/client-overview';
	}

	get profileLink(): string {
		const user = this.authStore.currentUser();
		if (!user) return '/client-overview/profile';
		const role = resolveActiveRole(user);
		if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) return '/supper-admin-overview/system-settings';
		return roleLinks(role).profile;
	}

	constructor() {
		effect(() => {
			this.chatState.totalUnreadCount();
			this.notifEngine.unreadCount();
			this.cartService.itemCount();
			this.cdRef.markForCheck();
		});
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

	getRoleLabel(role: UserRole): string {
		switch (role) {
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

	toggleMobileMenu() {
		this.isMobileMenuOpen = !this.isMobileMenuOpen;
		this.updateBodyScroll();
	}

	closeMobileMenu() {
		this.isMobileMenuOpen = false;
		this.updateBodyScroll();
	}

	logout() {
		this.isUserDropdownOpen.set(false);
		this.isDashSubMenuOpen.set(false);
		this.authStore.logout('/auth/login');
	}


	private updateBodyScroll() {
		if (isPlatformBrowser(this.platformId)) {
			if (this.isMobileMenuOpen) {
				document.body.style.overflow = 'hidden';
			} else {
				document.body.style.overflow = '';
			}
		}
	}
}
