import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
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
			case 'APPROVED': return spec?.isPassed && spec?.assessmentDetails ? 'تخصص معتمد · اجتاز اختبار التخصص' : 'تخصص معتمد';
			case 'REJECTED': return 'تخصص غير معتمد';
			case 'LOCKED_OUT': return 'التخصص مقفل مؤقتاً';
			default: return 'قيد الاعتماد';
		}
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

	ngOnInit() {
		this.loadPublicProfile();
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
