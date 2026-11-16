import { DestroyRef as CatalogDestroyRef, inject as catalogInject } from '@angular/core';
import { takeUntilDestroyed as catalogUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AccountLogsService } from '../../../../../core/services/account-logs.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { resolveLevelDisplay } from '../../../../../core/levels/level-display';
import { LevelBadgeComponent } from '../../../../../shared/levels/level-badge.component';
import { AccountType } from '../../../../../core/models/auth.model';

@Component({
	selector: 'app-profile-public',
	standalone: true,
	imports: [CommonModule, RouterModule, DatePipe, LevelBadgeComponent],
	templateUrl: './public.html',
	styleUrls: ['./public.css'],
})
export class Public implements OnInit {
  private readonly catalogDestroy = catalogInject(CatalogDestroyRef);
	/** The one shared level display (same badge as the dashboard and the level page): backend levelDisplay, else the level name read back to its level. */
	levelDisplay = computed(() => {
		const li = (this.profileData() as any)?.header?.levelInfo;
		return resolveLevelDisplay({ info: li?.levelDisplay, providerTitle: li?.levelName });
	});

	private providerProfileService = inject(ProviderProfileService);
	private authStore = inject(AuthStore);
	private specialtyService = inject(SpecialtyService);
	private router = inject(Router);
	private accountLogs = inject(AccountLogsService);

	currentTab = signal<string>('info');
	showBanner = signal<boolean>(true);
	/** The "ملفي المهني مكتمل X%" banner is for an incomplete profile only: hidden at 100% (an unknown value keeps the old behaviour; companies are untouched). */
	bannerVisible = computed<boolean>(() => {
		if (!this.showBanner()) return false;
		if (this.isCompanyMode()) return true;
		const pct = this.profileData()?.header?.levelInfo?.completionPercentage;
		return typeof pct === 'number' ? pct < 100 : true;
	});

	profileData = signal<any | null>(null);

	// Contact details come from the backend `contact` block (the SAME stored data as the profile data page). It is sent to the owner only: a visitor's answer has
	// contact = null and contactVisibility = 'HIDDEN_FROM_VISITORS', which is said as such, never shown as an unexplained dash.
	readonly contactEmail = computed(() => this.contactText(this.profileData()?.contact?.email, 'لم يُضف بعد'));
	readonly contactPhone = computed(() => this.contactText(this.profileData()?.contact?.phone?.display, 'لم يُضف بعد'));
	private contactText(value: string | null | undefined, empty: string): string {
		const d = this.profileData();
		if (!d) return '—';
		if (!d.contact) return d.contactVisibility === 'HIDDEN_FROM_VISITORS' ? 'مخفي عن الزوار' : '—';
		return value || empty;
	}
	isLoading = signal<boolean>(true);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	/** Specialties whose verification status is APPROVED (null when the response has no specialties list). */
	approvedSpecialtiesCount = computed<number | null>(() => {
		const list = this.profileData()?.specialties;
		return Array.isArray(list) ? list.filter((s: any) => s?.status === 'APPROVED').length : null;
	});

	/** Approved specialties that carry a completed, passed assessment attempt (the WaseetAI-graded test). */
	aiPassedSpecialtiesCount = computed<number | null>(() => {
		const list = this.profileData()?.specialties;
		return Array.isArray(list) ? list.filter((s: any) => s?.status === 'APPROVED' && s?.isPassed && s?.assessmentDetails).length : null;
	});

	/** Real verification state of a specialty. APPROVED is set either by passing the assessment or by an admin
	 *  approving a work sample, so the label does not attribute it to a single party. */
	specStatusLabel(spec: any): string {
		switch (spec?.status) {
			case 'APPROVED': return spec?.isPassed && spec?.assessmentDetails ? 'تخصص معتمد · اجتاز اختبار AI' : 'تخصص معتمد';
			case 'REJECTED': return 'تم رفض التخصص';
			case 'LOCKED_OUT': return 'التخصص مقفل مؤقتاً';
			// the test / proof steps are the provider's own: only a specialty that already went through them is "waiting for the administration"
			case 'PENDING_PROOF': return spec?.isPassed ? 'اجتزت الاختبار · بانتظار رفع الإثباتات' : spec?.hasTakenAssessment ? 'بانتظار رفع الإثباتات' : 'لم تُجرِ الاختبار بعد';
			case 'PENDING_TEST':
			case 'TEST_REQUIRED': return 'بانتظار إجراء الاختبار';
			default: return 'بانتظار اعتماد الإدارة';
		}
	}

	/** A specialty whose test was not taken yet: its score box and status lead to the page where the test is taken. */
	needsTest(spec: any): boolean {
		return !spec?.hasTakenAssessment && spec?.status !== 'APPROVED' && spec?.status !== 'REJECTED' && spec?.status !== 'LOCKED_OUT';
	}

	/** The test score is shown only when a test was really taken and scored; otherwise nothing is invented (no 0%, no tick). */
	hasTestScore(spec: any): boolean {
		return !!spec?.hasTakenAssessment && typeof spec?.latestScore === 'number';
	}

	/** "—" for a missing value; numbers (including 0) are shown as they are. */
	dash(v: unknown): string | number {
		return v === null || v === undefined || v === '' ? '—' : (v as string | number);
	}

	/** Minutes with a unit, "—" when the value is missing. */
	minutes(v: number | null | undefined): string {
		return v === null || v === undefined ? '—' : `${v} دقيقة`;
	}

	/** The test's time LIMIT: the new `timeLimitMinutes`, falling back to the legacy `timeTakenMinutes` (which always meant the limit). */
	timeLimitOf(d: { timeLimitMinutes?: number | null; timeTakenMinutes?: number | null } | null | undefined): number | null {
		return d?.timeLimitMinutes ?? d?.timeTakenMinutes ?? null;
	}

	serviceStatusLabel(status: string | null | undefined): string {
		switch (status) {
			case 'APPROVED': return 'معتمد';
			case 'PUBLISHED': return 'منشور';
			default: return status || '—';
		}
	}

	companyInitials = computed<string>(() => {
		const user = this.authStore.currentUser();
		if (!user) return 'خت';
		const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
		return name.slice(0, 2);
	});

	/** Specialty.id → Arabic name, from the public specialties list (a service only carries `specialtyId`). */
	specialtyNames = signal<Record<string, string>>({});

	ngOnInit() {
		this.loadPublicProfile();
		this.specialtyService.getPublicSpecialties().pipe(catalogUntilDestroyed(this.catalogDestroy)).subscribe({
			next: (res: any) => {
				const map: Record<string, string> = {};
				for (const s of (Array.isArray(res?.data) ? res.data : [])) if (s?.id) map[s.id] = s.nameAr || s.name || '';
				this.specialtyNames.set(map);
			},
			error: () => this.specialtyNames.set({})
		});
	}

	/** The service's specialty: the API's `specialtyName` first (new backend), else the public-specialties lookup, else '—'. */
	specialtyOf(service: { specialtyName?: string | null; specialtyId?: string | null }): string {
		return (service?.specialtyId && this.specialtyNames()[service.specialtyId]) || service?.specialtyName || '—';
	}

	/** Name of a service's specialty, or '—' when it is not in the public (active) specialties list. */
	specialtyName(id: string | null | undefined): string {
		return (id && this.specialtyNames()[id]) || '—';
	}

	loadPublicProfile() {
		this.isLoading.set(true);
		// Fetch for self-preview (no providerId specified defaults to req.user.id)
		this.providerProfileService.getPublicProfile().subscribe({
			next: (res) => {
				if (res.success) {
					this.profileData.set(res.data);
				}
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Failed to load public profile', err);
				this.isLoading.set(false);
			}
		});
	}

	/** The average client rating out of 5 (one decimal), from the real public reviews; null while there are none. */
	clientRatingOutOf5(): number | null {
		const stats = this.profileData()?.header?.stats;
		if (!stats || !(stats.reviewsCount > 0) || typeof stats.clientRating !== 'number') return null;
		return Math.round((stats.clientRating / 20) * 10) / 10;
	}

	setTab(tab: string) {
		this.currentTab.set(tab);
		if (tab === 'activity') this.loadActivity();
	}

	/** The real account activity (the same audit log as «سجل النشاط والأمان»), read when the tab is opened. */
	activityState = signal<'idle' | 'loading' | 'error' | 'ready'>('idle');
	activityItems = signal<Array<{ id: string; title: string; status: string; at: string }>>([]);

	loadActivity() {
		if (this.activityState() === 'loading' || this.activityState() === 'ready') return;
		this.activityState.set('loading');
		this.accountLogs.getUserLogs({ limit: 8 }).subscribe({
			next: (res) => {
				if (!res?.success) { this.activityState.set('error'); return; }
				const rows = Array.isArray(res.data) ? res.data : (res.data?.items || []);
				this.activityItems.set(rows.slice(0, 8).map((log: any) => ({
					id: String(log.id),
					title: String(log.summary || log.title || log.actionText || 'إجراء في الحساب'),
					status: String(log.statusText || ''),
					at: String(log.occurredAt || log.createdAt || ''),
				})));
				this.activityState.set('ready');
			},
			error: () => this.activityState.set('error'),
		});
	}

	closeBanner() {
		this.showBanner.set(false);
	}

	editProfile() {
		this.router.navigate(['/provider-overview/profile/data']);
	}
}
