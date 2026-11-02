import { Component, DestroyRef, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { ProfileApiService } from '../../../../core/services/profile-api.service';
import { Subscription } from 'rxjs';

import { levelDisplayFromInfo } from '../../../../core/levels/level-display';
import { LevelBadgeComponent } from '../../../../shared/levels/level-badge.component';

type ProfileTab = 'info' | 'interests' | 'links' | 'activity';

@Component({
	selector: 'app-profile',
	standalone: true,
	imports: [CommonModule, RouterModule, DatePipe, LevelBadgeComponent],
	templateUrl: './profile.html',
	styleUrl: './profile.css',
})
export class Profile {
	authStore = inject(AuthStore);
	profileApi = inject(ProfileApiService);
	private destroyRef = inject(DestroyRef);
	private profileRequest?: Subscription;
	private requestVersion = 0;
	private sessionKey = computed(() => {
		const user = this.authStore.currentUser();
		return JSON.stringify([user?.id, user?.activeRole, user?.accountType, this.authStore.token()]);
	});

	activeTab = signal<ProfileTab>('info');
	isLoading = signal<boolean>(true);
	errorMsg = signal<string | null>(null);
	showBanner = true;
	avatarError = signal<boolean>(false);

	// The full merged profile data from the backend
	profileData = signal<any>(null);

	constructor() {
		this.destroyRef.onDestroy(() => this.profileRequest?.unsubscribe());
		effect(() => {
			this.sessionKey();
			untracked(() => this.loadProfile());
		});
	}

	loadProfile() {
		const sessionKey = this.sessionKey();
		const requestVersion = ++this.requestVersion;
		this.profileRequest?.unsubscribe();
		this.profileData.set(null);
		this.isLoading.set(true);
		this.errorMsg.set(null);
		this.avatarError.set(false);
		this.activeTab.set('info');
		this.showBanner = true;
		if (!this.authStore.currentUser() || !this.authStore.token()) {
			this.isLoading.set(false);
			return;
		}

		this.profileRequest = this.profileApi.getMyProfile().subscribe({
			next: (res) => {
				if (requestVersion !== this.requestVersion || sessionKey !== this.sessionKey()) return;
				this.isLoading.set(false);
				if (res.success && res.data) {
					const data = res.data.currentProfileData || res.data;
					this.profileData.set(data);

					// Update completion percent in auth store
					const currentUser = this.authStore.currentUser();
					if (currentUser && typeof data.profileCompletionPercent === 'number' && Number.isFinite(data.profileCompletionPercent)) {
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
				if (requestVersion !== this.requestVersion || sessionKey !== this.sessionKey()) return;
				this.isLoading.set(false);
				this.errorMsg.set('تعذر تحميل بيانات الملف الشخصي. حدث خطأ في الخادم.');
			}
		});
	}

	switchTab(tab: ProfileTab) {
		this.activeTab.set(tab);
	}

	getInitials(): string {
		const f = this.profileData()?.firstName || '';
		const l = this.profileData()?.lastName || '';
		if (f && l) return (f.charAt(0) + l.charAt(0)).toUpperCase();
		if (f) return f.charAt(0).toUpperCase();
		return 'م';
	}

	getFullName(): string {
		const f = this.profileData()?.firstName || '';
		const l = this.profileData()?.lastName || '';
		return `${f} ${l}`.trim() || 'الاسم غير مضاف';
	}

	getAvatar(): string | null {
		if (this.avatarError()) return null;
		return this.profileData()?.avatarUrl || null;
	}

	getMemberSince(): string {
		const createdAt = this.profileData()?.createdAt;
		if (!createdAt) return '';
		const d = new Date(createdAt);
		if (!Number.isFinite(d.getTime())) return '';
		const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
		return `عضو منذ ${months[d.getMonth()]} ${d.getFullYear()}`;
	}

	getAccountTypeLabel(): string {
		const accType = this.profileData()?.accountType || '';
		if (accType.includes('CLIENT')) return 'طالب خدمة';
		if (accType.includes('PROVIDER')) return 'مقدم خدمة';
		return 'غير متاح';
	}

	getEntityLabel(): string {
		const accType = this.profileData()?.accountType || '';
		if (accType.includes('COMPANY')) return 'شركة';
		if (accType.includes('INDIVIDUAL')) return 'فرد';
		return 'غير متاح';
	}

	/**
	 * Masks an ID number, showing only first and last digits.
	 * e.g. "1234567890" => "1xxxxxxxx0"
	 */
	maskId(id: string): string {
		if (!id || id.length < 3) return id;
		return id[0] + 'x'.repeat(id.length - 2) + id[id.length - 1];
	}

	get completionPercent(): number | null {
		const value = this.profileData()?.profileCompletionPercent;
		return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
	}

	/** What the backend still needs for 100% (GET /profiles/me -> missingItems). */
	get missingItems(): { key: string; label: string; points: number }[] {
		const items = this.profileData()?.missingItems;
		return Array.isArray(items) ? items : [];
	}

	/** The average of the provider reviews about this client; null until there is one (never a default). */
	get humanRating(): number | null {
		const r = this.profileData()?.humanRating;
		return this.profileData()?.reviewsCount !== 0 && typeof r === 'number' && Number.isFinite(r) && r >= 1 && r <= 5 ? r : null;
	}

	get roundedRating(): number {
		return Math.round(this.humanRating ?? 0);
	}

	/** The shared level display from the backend levelInfo (same badge as the dashboard). */
	levelDisplay = computed(() => levelDisplayFromInfo(this.profileData()?.levelInfo));

	get level(): string {
		return this.profileData()?.currentLevel || '';
	}

	get skills(): string[] {
		return this.profileData()?.skills || this.profileData()?.interests || [];
	}

	get bio(): string {
		return this.profileData()?.bio || this.profileData()?.about || '';
	}
}
