import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { MarketingBrokerOverview } from './marketing-broker-overview';
import { MarketerOverviewService } from '../../../../core/services/marketer-overview.service';

const res = (o: any) => ({ status: 'READY', source: 'GEMINI', score: null, confidence: null, summary: 'ملخص أداء', recommendation: null, details: { observations: [{ text: 'رصد' }], recommendations: [{ text: 'اقتراح عملي' }] }, generatedAt: null, ...o });

describe('marketer dashboard — AI insights card', () => {
	function setup(insights: () => any) {
		let n = 0;
		TestBed.configureTestingModule({ imports: [MarketingBrokerOverview], providers: [{ provide: MarketerOverviewService, useValue: {
			getSummary: () => of({ success: true, data: { tier: 'مساعد', successfulReferrals: 1, totalCommissions: 1, overallConversionRate: 1 } }),
			getChannelPerformance: () => of({ success: true, data: [] }),
			getRecentCommissions: () => of({ success: true, data: [] }),
			getAiInsights: () => { n++; return insights(); },
		} }] });
		const f = TestBed.createComponent(MarketingBrokerOverview);
		f.detectChanges();
		return { f, el: f.nativeElement as HTMLElement, count: () => n };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('READY', () => {
		const { el } = setup(() => of({ success: true, data: res({}) }));
		expect(el.querySelector('[data-testid="ai-card-ai"]')).toBeTruthy();
		expect(el.textContent).toContain('رؤى وتوصيات الأداء');
		for (const t of ['ملخص أداء', 'رصد', 'اقتراح عملي']) expect(el.textContent).toContain(t);
	});
	it('loading', () => {
		const { el } = setup(() => new Subject());
		expect(el.querySelector('[data-testid="ai-card-loading"]')).toBeTruthy();
	});
	it('NOT_ENOUGH_DATA', () => {
		const { el } = setup(() => of({ success: true, data: res({ status: 'NOT_ENOUGH_DATA', source: 'NONE', summary: null, details: null }) }));
		expect(el.textContent).toContain('لا توجد بيانات كافية للتحليل');
	});
	it('FAILED and HTTP error show the failure text + retry; rest of the page renders', () => {
		for (const s of [() => of({ success: true, data: res({ status: 'FAILED', source: 'NONE', summary: null, details: null }) }), () => throwError(() => new Error('x'))]) {
			const { el } = setup(s);
			expect(el.textContent).toContain('تعذر تشغيل التحليل حاليًا');
			expect(el.querySelector('[data-testid="ai-card-retry"]')).toBeTruthy();
			expect(el.textContent).toContain('إجمالي العمولات');
			TestBed.resetTestingModule();
		}
	});
	it('legacy array response is not rendered as advice', () => {
		const { el } = setup(() => of({ success: true, data: [{ text: 'نصيحة قديمة' }] }));
		expect(el.textContent).not.toContain('نصيحة قديمة');
		expect(el.textContent).toContain('تعذر تشغيل التحليل حاليًا');
	});
	it('retry reloads', () => {
		const { f, el, count } = setup(() => throwError(() => new Error('x')));
		(el.querySelector('[data-testid="ai-card-retry"]') as HTMLButtonElement).click();
		f.detectChanges();
		expect(count()).toBe(2);
	});
});
