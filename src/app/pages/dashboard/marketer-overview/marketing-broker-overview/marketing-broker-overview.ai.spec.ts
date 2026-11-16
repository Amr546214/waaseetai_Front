import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { MarketingBrokerOverview } from './marketing-broker-overview';
import { MarketerOverviewService } from '../../../../core/services/marketer-overview.service';

const res = (o: any) => ({ status: 'READY', source: 'GEMINI', score: null, confidence: null, summary: 'ملخص أداء', recommendation: null, details: { observations: [{ text: 'رصد' }], recommendations: [{ text: 'اقتراح عملي' }] }, generatedAt: null, ...o });

describe('marketer dashboard — AI insights card', () => {
	function setup(insights: () => any) {
		let n = 0;
		TestBed.configureTestingModule({ imports: [MarketingBrokerOverview], providers: [provideRouter([]), { provide: MarketerOverviewService, useValue: {
			getSummary: () => of({ success: true, data: { tier: 'مساعد', successfulReferrals: 1, totalCommissions: 1, overallConversionRate: 1 } }),
			getChannelPerformance: () => of({ success: true, data: [] }),
			getRecentCommissions: () => of({ success: true, data: [] }),
			getAiInsights: () => { n++; return insights(); },
		} }] });
		const f = TestBed.createComponent(MarketingBrokerOverview);
		f.detectChanges();
		return { f, el: f.nativeElement as HTMLElement, count: () => n };
	}
	afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });
	/** the card retries once by itself after 2.5 s before it shows the failure */
	const afterAutoRetry = (f: { detectChanges(): void }) => { vi.advanceTimersByTime(2600); f.detectChanges(); };

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
			vi.useFakeTimers();
			const { f, el } = setup(s); afterAutoRetry(f);
			expect(el.textContent).toContain('تعذر تشغيل التحليل حاليًا');
			expect(el.querySelector('[data-testid="ai-card-retry"]')).toBeTruthy();
			expect(el.textContent).toContain('إجمالي العمولات');
			TestBed.resetTestingModule();
		}
	});
	it('legacy array response is not rendered as advice', () => {
		vi.useFakeTimers();
		const { f, el } = setup(() => of({ success: true, data: [{ text: 'نصيحة قديمة' }] })); afterAutoRetry(f);
		expect(el.textContent).not.toContain('نصيحة قديمة');
		expect(el.textContent).toContain('تعذر تشغيل التحليل حاليًا');
	});
	it('retry reloads (the button starts over, with its own silent retry)', () => {
		vi.useFakeTimers();
		const { f, el, count } = setup(() => throwError(() => new Error('x'))); afterAutoRetry(f);
		expect(count()).toBe(2); // first call + the silent retry
		(el.querySelector('[data-testid="ai-card-retry"]') as HTMLButtonElement).click();
		f.detectChanges();
		expect(count()).toBe(3);
	});
	it('a first failure is retried silently: the result shows without any click', () => {
		vi.useFakeTimers();
		let calls = 0;
		const { f, el, count } = setup(() => (++calls === 1 ? of({ success: true, data: res({ status: 'FAILED', source: 'NONE', summary: null, details: null }) }) : of({ success: true, data: res({}) })));
		expect(el.textContent).not.toContain('تعذر تشغيل التحليل حاليًا'); // still loading (no failure flash)
		afterAutoRetry(f);
		expect(count()).toBe(2); expect(el.querySelector('[data-testid="ai-card-ai"]')).toBeTruthy(); expect(el.textContent).toContain('ملخص أداء'); expect(el.textContent).not.toContain('تعذر تشغيل التحليل حاليًا');
	});
});
