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
		const text = render({ activeProjectsCount: 0, availableEarnings: 0, monthlyEarnings: 0, totalEscrowAmount: 0, currentPoints: 40, currentLevel: 'مستكشف', profileCompletionPercent: 60, providerRating: null, aiRating: null, pendingClientApprovalCount: 0, negotiationOffersCount: 0 });
		for (const forbidden of ['مكافأة', '+2 هذا الشهر', '+3 منذ أمس', '199 نقطة', 'مقدم موثّق']) expect(text).not.toContain(forbidden);
	});

	it('the badge says only that the setup data was submitted (the API sends no verification, completion-100 or bonus value)', () => {
		expect(render({ profileSetupCompleted: true, profileCompletionPercent: 50 })).toContain('تم إرسال بيانات الإعداد');
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
		const text = render({ providerRating: null, aiRating: null });
		expect(text).toContain('لا توجد تقييمات بعد');
		expect(text).toContain('لا توجد بيانات بعد');
		expect(text).not.toMatch(/تقييم العملاء\s*0\b/);
	});

	it('a real rating is shown as is', () => {
		const text = render({ providerRating: 4.6 });
		expect(text).toContain('4.6');
		expect(text).toContain('من 5 نجوم');
	});

	it('#16 verification badge (kycStatus fallback, no identityVerification sent): VERIFIED with the real commission; pending says so; rejected / unverified say what to do; unknown shows nothing', () => {
		const verified = render({ kycStatus: 'VERIFIED', commissionPercent: 4.6 });
		expect(verified).toContain('مقدم موثّق');
		expect(verified).toContain('عمولة مستواك 4.6%');
		TestBed.resetTestingModule();
		const noCommission = render({ kycStatus: 'VERIFIED', commissionPercent: null });
		expect(noCommission).toContain('مقدم موثّق');
		expect(noCommission).not.toContain('عمولة مستواك');
		TestBed.resetTestingModule();
		expect(render({ kycStatus: 'PENDING', commissionPercent: 5 })).toContain('التوثيق قيد المراجعة');
		TestBed.resetTestingModule();
		expect(render({ kycStatus: 'REJECTED' })).toContain('التوثيق مرفوض — يحتاج تعديل');
		TestBed.resetTestingModule();
		expect(render({ kycStatus: 'UNVERIFIED' })).toContain('أكمل التوثيق');
		for (const kyc of [undefined, null]) {
			TestBed.resetTestingModule();
			const text = render({ kycStatus: kyc, commissionPercent: 5 });
			expect(text, String(kyc)).not.toContain('مقدم موثّق');
			expect(text, String(kyc)).not.toContain('عمولة مستواك');
			expect(text, String(kyc)).not.toContain('قيد المراجعة');
			expect(text, String(kyc)).not.toContain('أكمل التوثيق');
		}
	});

	const idv = (status: string, extra: any = {}) => ({ status, requestId: null, submittedAt: null, rejectionReason: null, ...extra });
	it('identityVerification is the source: VERIFIED shows "مقدم موثّق" and NEVER "قيد المراجعة", even when the raw kycStatus is a stale PENDING (the reported contradiction)', () => {
		const text = render({ kycStatus: 'PENDING', identityVerification: idv('VERIFIED'), commissionPercent: 4.6 });
		expect(text).toContain('مقدم موثّق');
		expect(text).toContain('عمولة مستواك 4.6%');
		expect(text).not.toContain('التوثيق قيد المراجعة');
		expect(text).not.toContain('مرفوض');
		expect(text).not.toContain('أكمل التوثيق');
	});
	it('identityVerification PENDING_REVIEW shows "التوثيق قيد المراجعة" only then; REJECTED shows the rejected badge; NOT_SUBMITTED asks to complete', () => {
		const pending = render({ kycStatus: 'VERIFIED', identityVerification: idv('PENDING_REVIEW') });
		expect(pending).toContain('التوثيق قيد المراجعة');
		expect(pending).not.toContain('مقدم موثّق');
		TestBed.resetTestingModule();
		const rejected = render({ kycStatus: 'PENDING', identityVerification: idv('REJECTED', { rejectionReason: 'x' }) });
		expect(rejected).toContain('التوثيق مرفوض — يحتاج تعديل');
		expect(rejected).not.toContain('التوثيق قيد المراجعة');
		expect(rejected).not.toContain('مقدم موثّق');
		TestBed.resetTestingModule();
		const none = render({ kycStatus: null, identityVerification: idv('NOT_SUBMITTED') });
		expect(none).toContain('أكمل التوثيق');
		expect(none).not.toContain('مقدم موثّق');
	});
	it('identityVerification null (the backend could not read it) falls back to kycStatus, and makes no claim when that is unknown too', () => {
		expect(render({ kycStatus: 'VERIFIED', identityVerification: null })).toContain('مقدم موثّق');
		TestBed.resetTestingModule();
		const text = render({ kycStatus: null, identityVerification: null });
		for (const x of ['مقدم موثّق', 'التوثيق قيد المراجعة', 'مرفوض', 'أكمل التوثيق']) expect(text).not.toContain(x);
	});

	it('a real 5.0 rating is shown as a rating (5.0 is no longer treated as unrated)', () => {
		expect(render({ providerRating: 5 })).toContain('من 5 نجوم');
	});
	it('a null rating is "no ratings yet", not a rating', () => {
		const none = render({ providerRating: null });
		expect(none).toContain('لا توجد تقييمات بعد');
		expect(none).not.toContain('من 5 نجوم');
	});
});
