import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

@Component({
	selector: 'app-profile-public',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './public.html',
	styleUrls: ['./public.css'],
})
export class Public implements OnInit {
	private providerProfileService = inject(ProviderProfileService);
	private authStore = inject(AuthStore);
	private specialtyService = inject(SpecialtyService);
	private router = inject(Router);

	currentTab = signal<string>('info');
	showBanner = signal<boolean>(true);

	profileData = signal<any | null>(null);
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
			case 'REJECTED': return 'تخصص غير معتمد';
			case 'LOCKED_OUT': return 'التخصص مقفل مؤقتاً';
			default: return 'قيد الاعتماد';
		}
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
		this.specialtyService.getPublicSpecialties().subscribe({
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
		return service?.specialtyName || this.specialtyName(service?.specialtyId);
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

	setTab(tab: string) {
		this.currentTab.set(tab);
	}

	closeBanner() {
		this.showBanner.set(false);
	}

	editProfile() {
		this.router.navigate(['/provider-overview/profile/data']);
	}
}
