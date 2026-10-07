import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MarketingBrokerOverview } from './marketing-broker-overview';
import { MarketerOverviewService } from '../../../../core/services/marketer-overview.service';

// #28 — the marketer dashboard speaks USD only (no ريال / SAR) and claims nothing the API did not say: the old fixed "+0 هذا الأسبوع" and
// "أعلى من المتوسط" are gone, and the commissions card says what the number is (the total of all commission logs).
describe('marketer dashboard — USD only, no invented claims (#28)', () => {
	function render(commissions: any[] = []) {
		TestBed.configureTestingModule({
			imports: [MarketingBrokerOverview],
			providers: [{ provide: MarketerOverviewService, useValue: {
				getSummary: () => of({ success: true, data: { tier: 'مساعد', successfulReferrals: 3, totalCommissions: 42.5, overallConversionRate: 12 } }),
				getChannelPerformance: () => of({ success: true, data: [] }),
				getRecentCommissions: () => of({ success: true, data: commissions }),
				getAiInsights: () => of({ success: true, data: [] }),
			} }],
		});
		const fixture = TestBed.createComponent(MarketingBrokerOverview);
		fixture.detectChanges();
		return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
	}
	afterEach(() => TestBed.resetTestingModule());

	it('money is shown in dollars and no riyal / SAR text exists', () => {
		const text = render([{ id: '1', source: 'خالد', type: 'اشتراك', time: '2026-10-01', amount: 7, currency: 'USD', status: 'PAID' }]);
		expect(text).toContain('42.5 دولار');
		expect(text).toContain('7 دولار');
		expect(text).toContain('دولار أمريكي');
		expect(text).not.toMatch(/ريال|SAR|ر\.س|﷼/);
	});

	it('no fixed deltas or superlatives', () => {
		const text = render();
		for (const forbidden of ['+0 هذا الأسبوع', 'أعلى من المتوسط', 'عمولات الشهر', 'أكمل متطلبات الترقية']) expect(text).not.toContain(forbidden);
		expect(text).toContain('إجمالي العمولات');
	});
});
