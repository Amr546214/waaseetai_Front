import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProviderOverview } from './provider-overview';
import { ProviderApiService } from '../../../../core/services/provider-api.service';
import { AuthStore } from '../../../../core/store/auth.store';

// #16 — nothing on the provider dashboard is invented: no fixed "موثّق · مكافأة 3%", no "+2 هذا الشهر" / "+3 منذ أمس", no "199 نقطة للمستوى 3",
// and an account without ratings shows "—" (not 0 and not 5).
describe('ProviderOverview — values come only from the API (#16)', () => {
	function render(summary: any) {
		const data = { summary: { firstName: 'م', lastName: 'خ', hasApprovedSpecialties: true, profileSetupCompleted: true, setupTestCompleted: true, pendingOffersCount: 0, ...summary }, topSteps: {}, latestProjects: [], latestProposals: [], aiMatchingProjects: [] };
		TestBed.configureTestingModule({
			imports: [ProviderOverview],
			providers: [provideRouter([]), { provide: ProviderApiService, useValue: { getOverviewStats: () => of({ success: true, data }) } }, { provide: AuthStore, useValue: { currentUser: () => null } }],
		});
		const fixture = TestBed.createComponent(ProviderOverview);
		fixture.detectChanges();
		return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
	}
	afterEach(() => TestBed.resetTestingModule());

	it('no hardcoded claims or deltas are rendered', () => {
		const text = render({ activeProjectsCount: 0, availableEarnings: 0, monthlyEarnings: 0, totalEscrowAmount: 0, currentPoints: 40, currentLevel: 'مستكشف', profileCompletionPercent: 60, providerRating: 0, aiRating: 0, pendingClientApprovalCount: 0, negotiationOffersCount: 0 });
		for (const forbidden of ['مكافأة', '+2 هذا الشهر', '+3 منذ أمس', '199 نقطة', 'مقدم موثّق']) expect(text).not.toContain(forbidden);
	});

	it('the badge says only that the account data is complete (the API sends no verification or bonus value)', () => {
		expect(render({ profileSetupCompleted: true })).toContain('تم استكمال بيانات الحساب');
	});

	it('the secondary lines are the real API counts', () => {
		const text = render({ pendingClientApprovalCount: 4, negotiationOffersCount: 7 });
		expect(text).toContain('بانتظار اعتماد العميل: 4');
		expect(text).toContain('قيد التفاوض: 7');
	});

	it('level card: the points come from the API and the completion text from profileCompletionPercent (no invented points-to-next-level)', () => {
		const text = render({ currentPoints: 123, currentLevel: 'باحث', profileCompletionPercent: 55 });
		expect(text).toContain('123');
		expect(text).toContain('اكتمال الملف 55%');
	});

	it('no ratings yet → "—" and an explicit empty text, never 0 or a default 5', () => {
		const text = render({ providerRating: 0, aiRating: 0 });
		expect(text).toContain('لا توجد تقييمات بعد');
		expect(text).toContain('لا توجد بيانات بعد');
		expect(text).not.toMatch(/تقييم العملاء\s*0\b/);
	});

	it('a real rating is shown as is', () => {
		const text = render({ providerRating: 4.6 });
		expect(text).toContain('4.6');
		expect(text).toContain('من 5 نجوم');
	});
});
