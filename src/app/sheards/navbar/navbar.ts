import { Component, ChangeDetectionStrategy, signal, computed, inject, ChangeDetectorRef, effect, ElementRef, HostListener, PLATFORM_ID } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { AuthStore } from '../../core/store/auth.store';
import { AccountService } from '../../core/services/account.service';
import { NotificationEngineService } from '../../core/services/notification-engine.service';
import { ChatStateService } from '../../core/services/chat-state.service';
import { CartService } from '../../core/services/cart.service';
import { UserRole, AccountType } from '../../core/models/auth.model';

@Component({
	selector: 'app-navbar',
	standalone: true,
	imports: [RouterModule, CommonModule],
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
	public chatState = inject(ChatStateService);
	public cartService = inject(CartService);
	private cdRef = inject(ChangeDetectorRef);
	private el = inject(ElementRef);
	private platformId = inject(PLATFORM_ID);
	
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

	userRoles = computed<UserRole[]>(() => {
		const user = this.currentUser();
		if (user?.roles && user.roles.length > 0) {
			return user.roles;
		}
		return [UserRole.CLIENT];
	});

	activeRole = computed<UserRole>(() => {
		const user = this.currentUser();
		if (user?.activeRole) return user.activeRole;
		if (user?.accountType?.includes('PROVIDER')) return UserRole.PROVIDER;
		if (user?.accountType?.includes('MARKETING')) return UserRole.AFFILIATE;
		return UserRole.CLIENT;
	});

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

	get dashboardLink(): string {
		const user = this.authStore.currentUser();
		if (!user) return '/client-overview';

		switch (user.accountType) {
			case AccountType.SUPER_ADMIN:
				return '/supper-admin-overview';
			case AccountType.MARKETING_BROKER:
				return '/marketer-overview';
			case AccountType.PROVIDER_INDIVIDUAL:
			case AccountType.PROVIDER_COMPANY:
				return '/provider-overview';
			case AccountType.CLIENT_INDIVIDUAL:
			case AccountType.CLIENT_COMPANY:
			default:
				return '/client-overview';
		}
	}

	get profileLink(): string {
		const user = this.authStore.currentUser();
		if (!user) return '/client-overview/profile';

		switch (user.accountType) {
			case AccountType.SUPER_ADMIN:
				return '/supper-admin-overview/profile';
			case AccountType.MARKETING_BROKER:
				return '/marketer-overview/profile';
			case AccountType.PROVIDER_INDIVIDUAL:
			case AccountType.PROVIDER_COMPANY:
				return '/provider-overview/profile';
			case AccountType.CLIENT_INDIVIDUAL:
			case AccountType.CLIENT_COMPANY:
			default:
				return '/client-overview/profile';
		}
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
			this.isUserDropdownOpen.set(false);
			this.isDashSubMenuOpen.set(false);
			return;
		}

		this.accountService.switchActiveRole(role).subscribe({
			next: () => {
				this.isUserDropdownOpen.set(false);
				this.isDashSubMenuOpen.set(false);
				this.notifEngine.triggerToast({
					title: 'تم تبديل الحساب بنجاح',
					message: `أنت الآن في لوحة ${this.getRoleLabel(role)}`
				});

				const targetUrl = this.getRoleDashboardUrl(role);
				if (typeof window !== 'undefined') {
					window.location.href = targetUrl;
				} else {
					this.router.navigate([targetUrl]);
				}
			},
			error: (err: any) => {
				const msg = err?.error?.message || 'تعذر تبديل الحساب';
				this.notifEngine.triggerToast({
					title: 'خطأ في تبديل الحساب',
					message: msg
				});
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
