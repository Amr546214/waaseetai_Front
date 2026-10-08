import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ClientOverviewComponent } from './client-overview.component';
import { DashboardStore } from '../../../../core/store/dashboard.store';
import { AuthStore } from '../../../../core/store/auth.store';

// The "استكمل بيانات حسابك" banner and the "التحقق من الهوية ناقص" chip on the client dashboard exist only while the completion is < 100.
function mount(percent: number) {
	const data = {
		summary: { activeProjectsCount: 0, newOffersCount: 0, totalEscrowAmount: 0, totalSpent: 0, aiRating: 0, humanRating: 0, profileCompletionPercent: percent, currentLevel: 'x', pointsToNextLevel: 1, currentPoints: 1 },
		topSteps: { step1_escrowRequiredCount: 0, step2_pendingApprovalCount: 0, step3_pendingProposalsCount: 0 },
		latestProjects: [], latestProposals: [], activeContract: null, priceFairnessInsight: null,
	};
	TestBed.configureTestingModule({
		imports: [ClientOverviewComponent],
		providers: [
			provideRouter([]),
			{ provide: DashboardStore, useValue: { dashboardData: () => data, activeContract: () => null, isLoadingDashboard: () => false, error: () => null, totalActiveRequestsCount: () => 0, fetchDashboardStats: async () => {} } },
			{ provide: AuthStore, useValue: { currentUser: () => null } },
		],
	});
	const f = TestBed.createComponent(ClientOverviewComponent);
	f.detectChanges();
	return f.nativeElement as HTMLElement;
}

describe('client dashboard: completion banner', () => {
	afterEach(() => { try { sessionStorage.clear(); } catch { /* */ } TestBed.resetTestingModule(); });
	it('at 100% there is no completion banner, no "استكمال البيانات" button and no identity chip', () => {
		const el = mount(100);
		expect(el.querySelector('#profile-banner')).toBeNull();
		expect(el.textContent).not.toContain('استكمال البيانات');
		expect(el.textContent).not.toContain('التحقق من الهوية ناقص');
	});
	it('below 100% the banner shows the percentage and links to the edit page', () => {
		const el = mount(60);
		expect(el.querySelector('#profile-banner')).not.toBeNull();
		expect(el.textContent).toContain('60%');
		expect(el.querySelector('#profile-banner a')?.getAttribute('href')).toContain('/client-overview/profile/edit');
	});
});
