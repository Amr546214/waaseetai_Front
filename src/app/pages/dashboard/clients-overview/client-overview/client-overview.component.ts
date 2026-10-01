import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { DashboardStore } from '../../../../core/store/dashboard.store';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { CompanyDashboardApiService } from '../../../../core/services/company-dashboard-api.service';
import { CompanyDashboardData } from '../../../../core/models/company-dashboard.model';
import { resolveProviderLevelBadgeStyle } from '../../../../core/utils/provider-level-style.util';

@Component({
	selector: 'app-client-overview',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './client-overview.component.html',
	styleUrl: './client-overview.component.css'
})
export class ClientOverviewComponent implements OnInit {
	public dashboardStore = inject(DashboardStore);
	public authStore = inject(AuthStore);
	private router = inject(Router);
	private companyDashboardApi = inject(CompanyDashboardApiService);

	isProfileBannerDismissed = false;

	readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

	companyData = signal<CompanyDashboardData | null>(null);
	companyLoading = signal<boolean>(true);
	companyError = signal<string>('');
	isCompanyProfileBannerDismissed = false;

	ngOnInit(): void {
		if (this.isCompany()) {
			this.fetchCompanyDashboard();
		} else {
			setTimeout(() => {
				this.dashboardStore.fetchDashboardStats();
			});
		}

		try {
			if (sessionStorage.getItem('ws-profile-dismissed')) {
				this.isProfileBannerDismissed = true;
			}
			if (sessionStorage.getItem('ws-company-profile-dismissed')) {
				this.isCompanyProfileBannerDismissed = true;
			}
		} catch (e) { }
	}

	private fetchCompanyDashboard(): void {
		this.companyLoading.set(true);
		this.companyError.set('');
		this.companyDashboardApi.getCompanyDashboard().subscribe({
			next: (res) => {
				this.companyLoading.set(false);
				if (res?.success && res.data) {
					this.companyData.set(res.data);
				} else {
					this.companyError.set('تعذر تحميل بيانات لوحة الشركة');
				}
			},
			error: (err) => {
				this.companyLoading.set(false);
				this.companyError.set(err?.error?.message || 'تعذر تحميل بيانات لوحة الشركة، حاول مرة أخرى');
			}
		});
	}

	retryCompanyDashboard(): void {
		this.fetchCompanyDashboard();
	}

	closeCompanyProfileBanner(): void {
		this.isCompanyProfileBannerDismissed = true;
		try {
			sessionStorage.setItem('ws-company-profile-dismissed', '1');
		} catch (e) { }
	}

	employeeSpendBarWidth(amount: number, list: { amount: number }[]): number {
		const max = Math.max(...list.map(e => e.amount), 1);
		return Math.max(4, Math.round((amount / max) * 100));
	}

	getInitials(name: string): string {
		if (!name) return 'م';
		const parts = name.trim().split(' ');
		if (parts.length >= 2) {
			return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.substring(0, 2);
		}
		return name.substring(0, 2);
	}

	closeProfileBanner() {
		this.isProfileBannerDismissed = true;
		try {
			sessionStorage.setItem('ws-profile-dismissed', '1');
		} catch (e) { }
	}

	goToProposal(projectId: string) {
		this.router.navigate(['/client-overview/my-requests', projectId]);
	}

	// "مقارنة العروض" shortcuts (quick action + offers section header) used to
	// always link to the plain requests list, which has no compare UI at all
	// — the real "select up to 3 offers and compare" feature only exists on a
	// specific request's own detail page (request-details.ts). Route to the
	// request behind the most recent real proposal instead, same target
	// goToProposal() already uses; fall back to the list only when there is
	// truly no proposal yet (nothing to compare).
	goToCompareOffers() {
		const proposals = this.dashboardStore.dashboardData()?.latestProposals || [];
		if (proposals.length > 0) {
			this.router.navigate(['/client-overview/my-requests', proposals[0].projectId]);
		} else {
			this.router.navigate(['/client-overview/my-requests']);
		}
	}

	getAvatarStyle(index: number): string {
		const styles = [
			'background:linear-gradient(135deg,rgba(43,212,199,.18),rgba(43,127,255,.12));color:var(--teal-txt,#2BD4C7);border:2px solid #2ECC8A',
			'background:linear-gradient(135deg,rgba(43,127,255,.18),rgba(43,127,255,.10));color:#5DA0FF;border:2px solid #5DA0FF',
			'background:linear-gradient(135deg,rgba(43,212,199,.16),rgba(43,127,255,.12));color:var(--teal-txt,#2BD4C7);border:2px solid #2BD4C7'
		];
		return styles[index % styles.length];
	}

	/** Batch 5 (completion pass) — real gamification-derived level now on
	 *  the proposal payload (DashboardService::getClientStats), resolved
	 *  through the same canonical shared helper as marketplace/slug/card/
	 *  curated. Never called for a null/missing providerLevel — callers
	 *  must guard with `@if (offer.providerLevel)` first. */
	levelStyle(level: string): { bg: string; color: string } {
		return resolveProviderLevelBadgeStyle(level);
	}

}
