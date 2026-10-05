import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { ProfileApiService } from '../../../../core/services/profile-api.service';

type ProfileTab = 'info' | 'interests' | 'links' | 'activity';

@Component({
	selector: 'app-profile',
	standalone: true,
	imports: [CommonModule, RouterModule, DatePipe],
	templateUrl: './profile.html',
	styleUrl: './profile.css',
})
export class Profile implements OnInit {
	authStore = inject(AuthStore);
	profileApi = inject(ProfileApiService);

	activeTab = signal<ProfileTab>('info');
	isLoading = signal<boolean>(true);
	errorMsg = signal<string | null>(null);
	showBanner = true;
	avatarError = signal<boolean>(false);

	// The full merged profile data from the backend
	profileData = signal<any>(null);

	ngOnInit() {
		this.loadProfile();
	}

	loadProfile() {
		this.isLoading.set(true);
		this.errorMsg.set(null);
		this.avatarError.set(false);

		this.profileApi.getMyProfile().subscribe({
			next: (res) => {
				this.isLoading.set(false);
				if (res.success && res.data) {
					const data = res.data.currentProfileData || res.data;
					this.profileData.set(data);

					// Update completion percent in auth store
					const currentUser = this.authStore.currentUser();
					if (currentUser && data.profileCompletionPercent !== undefined) {
						this.authStore.authenticate(this.authStore.token()!, {
							...currentUser,
							profileCompletionPercent: data.profileCompletionPercent
						});
					}
				} else {
					this.errorMsg.set('تعذر تحميل بيانات الملف الشخصي');
				}
			},
			error: (err) => {
				this.isLoading.set(false);
				this.errorMsg.set('تعذر تحميل بيانات الملف الشخصي. حدث خطأ في الخادم.');
			}
		});
	}

	switchTab(tab: ProfileTab) {
		this.activeTab.set(tab);
	}

	getInitials(): string {
		const f = this.profileData()?.firstName || this.authStore.currentUser()?.firstName || '';
		const l = this.profileData()?.lastName || this.authStore.currentUser()?.lastName || '';
		if (f && l) return (f.charAt(0) + l.charAt(0)).toUpperCase();
		if (f) return f.charAt(0).toUpperCase();
		return 'م';
	}

	getFullName(): string {
		const f = this.profileData()?.firstName || this.authStore.currentUser()?.firstName || '';
		const l = this.profileData()?.lastName || this.authStore.currentUser()?.lastName || '';
		return `${f} ${l}`.trim() || 'مستخدم غير معروف';
	}

	getAvatar(): string | null {
		if (this.avatarError()) return null;
		return this.profileData()?.avatarUrl || this.authStore.currentUser()?.avatarUrl || null;
	}

	getMemberSince(): string {
		const createdAt = this.profileData()?.createdAt || (this.authStore.currentUser() as any)?.createdAt;
		if (!createdAt) return '';
		const d = new Date(createdAt);
		const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
		return `عضو منذ ${months[d.getMonth()]} ${d.getFullYear()}`;
	}

	getAccountTypeLabel(): string {
		const accType = this.profileData()?.accountType || this.authStore.currentUser()?.accountType || '';
		if (accType.includes('CLIENT')) return 'طالب خدمة';
		if (accType.includes('PROVIDER')) return 'مقدم خدمة';
		return 'مستخدم';
	}

	getEntityLabel(): string {
		const accType = this.profileData()?.accountType || this.authStore.currentUser()?.accountType || '';
		if (accType.includes('COMPANY')) return 'شركة';
		return 'فرد';
	}

	/**
	 * Masks an ID number, showing only first and last digits.
	 * e.g. "1234567890" => "1xxxxxxxx0"
	 */
	maskId(id: string): string {
		if (!id || id.length < 3) return id;
		return id[0] + 'x'.repeat(id.length - 2) + id[id.length - 1];
	}

	get completionPercent(): number {
		// The backend value (a real 0 included) wins; the auth-store copy is only a fallback while the profile loads.
		return this.profileData()?.profileCompletionPercent
			?? this.authStore.currentUser()?.profileCompletionPercent
			?? 0;
	}

	/** What the backend still needs for 100% (GET /profiles/me -> missingItems). */
	get missingItems(): { key: string; label: string; points: number }[] {
		const items = this.profileData()?.missingItems;
		return Array.isArray(items) ? items : [];
	}

	get rating(): number {
		return this.profileData()?.rating || this.profileData()?.humanRating || 0;
	}

	get level(): string {
		return this.profileData()?.currentLevel
			|| this.authStore.currentUser()?.currentLevel
			|| 'مستكشف';
	}

	get skills(): string[] {
		return this.profileData()?.skills || this.profileData()?.interests || [];
	}

	get bio(): string {
		return this.profileData()?.bio || this.profileData()?.about || '';
	}
}
