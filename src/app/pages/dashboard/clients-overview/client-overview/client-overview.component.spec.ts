import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { ClientOverviewComponent } from './client-overview.component';
import { DashboardStore } from '../../../../core/store/dashboard.store';
import { AuthStore } from '../../../../core/store/auth.store';

// Batch 7 regression: the "AI Insights" card on the client dashboard used to
// be fully static markup — a hardcoded "96%" and a fixed Arabic sentence,
// with zero signal/backend behind it (client-overview.component.html). It
// now renders dashboardStore.dashboardData()?.priceFairnessInsight, a real
// deterministic aggregate of the client's own proposals' AI price-fairness
// tags. These tests lock in that the fake "96%" never reappears and that
// both the real-data and no-data-yet states render honestly.
function baseDashboardData(overrides: any = {}) {
	return {
		summary: {
			activeProjectsCount: 1,
			newOffersCount: 0,
			totalEscrowAmount: 0,
			totalSpent: 0,
			aiRating: 0,
			humanRating: 4.5,
			profileCompletionPercent: 100,
			currentLevel: 'مستكشف',
			pointsToNextLevel: 50,
			currentPoints: 10,
		},
		topSteps: { step1_escrowRequiredCount: 0, step2_pendingApprovalCount: 0, step3_pendingProposalsCount: 0 },
		latestProjects: [],
		latestProposals: [],
		activeContract: null,
		priceFairnessInsight: null,
		...overrides,
	};
}

describe('ClientOverviewComponent — AI Insights card', () => {
	function setup(dashboardDataOverrides: any) {
		const dashboardData = baseDashboardData(dashboardDataOverrides);
		const fakeStore: Partial<DashboardStore> = {
			dashboardData: (() => dashboardData) as any,
			activeContract: (() => null) as any,
			isLoadingDashboard: (() => false) as any,
			error: (() => null) as any,
			totalActiveRequestsCount: (() => 0) as any,
			fetchDashboardStats: async () => {},
		};
		const fakeAuthStore: Partial<AuthStore> = { currentUser: (() => null) as any };

		TestBed.configureTestingModule({
			imports: [ClientOverviewComponent],
			providers: [
				provideRouter([]),
				{ provide: DashboardStore, useValue: fakeStore },
				{ provide: AuthStore, useValue: fakeAuthStore },
			],
		});
		const fixture = TestBed.createComponent(ClientOverviewComponent);
		fixture.detectChanges();
		return fixture;
	}

	it('never renders the old fabricated static "96%" AI Insights card', () => {
		const fixture = setup({ priceFairnessInsight: null });
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('96%');
		expect(text).not.toContain('الأسعار المقدمة في العروض الحالية متوافقة تماماً مع متوسط أسعار السوق');
	});

	it('renders the real percentage and summary when priceFairnessInsight is present', () => {
		const fixture = setup({
			priceFairnessInsight: { fairPricePercentage: 75, evaluatedOffersCount: 4, summaryText: '75% من عروضك المقيَّمة بالذكاء الاصطناعي ضمن النطاق العادل لأسعار السوق' },
		});
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('75%');
		expect(text).toContain('عروضك المقيَّمة بالذكاء الاصطناعي');
		expect(text).toContain('4 عرض مُقيَّم');
	});

	it('shows an honest "not enough data yet" message instead of any percentage when priceFairnessInsight is null', () => {
		const fixture = setup({ priceFairnessInsight: null });
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('لا تتوفر تحليلات كافية بعد');
	});
});
