import { Component, ChangeDetectionStrategy, signal, computed, inject, Output, EventEmitter, ChangeDetectorRef, effect, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../../core/store/auth.store';
import { AccountService } from '../../../core/services/account.service';
import { NotificationEngineService } from '../../../core/services/notification-engine.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ChatStateService } from '../../../core/services/chat-state.service';
import { UserRole } from '../../../core/models/auth.model';

@Component({
	selector: 'app-nav-dashboard',
	standalone: true,
	imports: [CommonModule, RouterModule],
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
	public themeService = inject(ThemeService);
	public chatState = inject(ChatStateService);
	private cdRef = inject(ChangeDetectorRef);
	private el = inject(ElementRef);

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

	logout() {
		this.authStore.logout('/auth/login');
	}
}
