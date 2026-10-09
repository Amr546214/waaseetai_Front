import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { environment } from '../../../../environments/environment';
import { ForecastSummaryComponent } from './sa-finance-reports/forecast-summary.component';
import { ReviewsSummaryComponent } from './analytics/sa-quality/reviews-summary.component';
import { AnomalySummaryComponent } from './sa-audit-trail/anomaly-summary.component';

const base = { score: null, confidence: null, recommendation: null, generatedAt: null };
const ready = { ...base, status: 'READY', source: 'GEMINI', summary: 'ملخص حقيقي', details: { observations: [{ text: 'ملاحظة' }], recommendations: [] } };
const empty = { ...base, status: 'NOT_ENOUGH_DATA', source: 'NONE', summary: null, details: null };
const failedR = { ...base, status: 'FAILED', source: 'NONE', summary: null, details: null };

const FORECAST = { ...ready, series: { currency: 'USD', monthsWithData: 3, inflowTrendBasedOnMonths: 3, inflowNextMonthEstimate: 1500, months: [{ month: '2026-08', inflow: 1000, outflow: 200, inflowChangePercent: null }, { month: '2026-09', inflow: 1200, outflow: 300, inflowChangePercent: 20 }] } };
const SENT = { ...ready, stats: { totalReviews: 10, averageRating: 4.2, withCommentCount: 4, positivePercent: 70, negativePercent: 10, commentSnippets: [], distribution: [{ stars: 5, count: 7, percent: 70 }, { stars: 1, count: 1, percent: 10 }] } };
const ANOM = (count: number) => ({ ...ready, anomalies: { windowDays: 30, sigma: 3, anomalyCount: count, securityEventsByType: [], metrics: [{ key: 'failedLoginsPerDay', totalEvents: 40, evaluated: true, mean: 1.33, stdDev: 2, anomalyDays: count ? [{ date: '2026-09-20', count: 9, zScore: 3.4 }] : [] }] } });

function setup(cmp: any, path: string) {
	TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
	const http = TestBed.inject(HttpTestingController);
	const f = TestBed.createComponent(cmp);
	f.detectChanges();
	const url = `${environment.url_api}/admin/ai/${path}`;
	const el = f.nativeElement as HTMLElement;
	return { f, http, el, url, text: () => el.textContent ?? '', respond: (body: any) => { http.expectOne(url).flush(body); f.detectChanges(); }, fail: () => { http.expectOne(url).flush({}, { status: 500, statusText: 'x' }); f.detectChanges(); } };
}

describe('admin AI cards', () => {
	describe('forecast currency (no SAR/USD fallback shown)', () => {
		const series = (o: any) => ({ ...ready, series: { currency: 'USD', monthsWithData: 3, inflowTrendBasedOnMonths: 3, inflowNextMonthEstimate: 1500, months: [{ month: '2026-09', inflow: 1200, outflow: 300, inflowChangePercent: null }], ...o } });
		it('mixed currencies: says "عملات متعددة", no estimate line', () => {
			const s = setup(ForecastSummaryComponent, 'forecast-summary');
			s.respond({ success: true, data: series({ mixedCurrencies: true, currenciesSeen: ['USD', 'SAR'], inflowNextMonthEstimate: null, inflowTrendBasedOnMonths: null }) });
			expect(s.el.querySelector('[data-testid="forecast-mixed-currencies"]')!.textContent).toContain('عملات متعددة');
			expect(s.el.querySelector('[data-testid="forecast-estimate"]')).toBeNull();
			expect(s.text()).not.toContain('SAR فقط');
			s.http.verify();
		});
		it('no currency: no currency label is invented', () => {
			const s = setup(ForecastSummaryComponent, 'forecast-summary');
			s.respond({ success: true, data: series({ currency: null, months: [], inflowNextMonthEstimate: null }) });
			expect(s.text()).not.toMatch(/SAR|USD|ر\.س/);
			s.http.verify();
		});
	});

	describe('A2 card states', () => {
		it('FAILED / NOT_ENOUGH_DATA texts, no confidence, no AI mark unless READY from a real AI source', () => {
			for (const [data, txt, ai] of [[failedR, 'تعذر تشغيل التحليل حاليًا', false], [empty, 'لا توجد بيانات كافية للتحليل', false], [{ ...ready, source: 'RULES' }, '', false], [ready, 'ملخص حقيقي', true], [{ ...ready, source: 'WASEET_AI' }, 'ملخص حقيقي', true]] as const) {
				const s = setup(ForecastSummaryComponent, 'forecast-summary');
				s.respond({ success: true, data: { ...data, confidence: 0.9, score: 80 } });
				if (txt) expect(s.text()).toContain(txt);
				expect(s.text()).not.toMatch(/ثقة|confidence|90|80\s*%/);
				expect(!!s.el.querySelector('ws-ai-result-card circle')).toBe(ai);
				TestBed.resetTestingModule();
			}
		});
	});

	describe('forecast summary', () => {
		it('loading then READY: card + data table + simple trend estimate, no confidence %', () => {
			const s = setup(ForecastSummaryComponent, 'forecast-summary');
			expect(s.text()).toContain('جارٍ التحليل');
			s.respond({ success: true, data: FORECAST });
			expect(s.text()).toContain('ملخص حقيقي');
			expect(s.el.querySelectorAll('tbody tr').length).toBe(2);
			expect(s.el.querySelector('[data-testid="forecast-estimate"]')!.textContent).toContain('تقدير الشهر القادم (اتجاه خطي بسيط من 3 شهر): 1,500 USD');
			expect(s.text()).not.toContain('ثقة');
			s.http.verify();
		});
		it('READY with null estimate shows no estimate line', () => {
			const s = setup(ForecastSummaryComponent, 'forecast-summary');
			s.respond({ success: true, data: { ...FORECAST, series: { ...FORECAST.series, inflowNextMonthEstimate: null } } });
			expect(s.el.querySelector('[data-testid="forecast-estimate"]')).toBeNull();
			expect(s.el.querySelectorAll('tbody tr').length).toBe(2);
		});
		it('NOT_ENOUGH_DATA: empty text, no table/estimate', () => {
			const s = setup(ForecastSummaryComponent, 'forecast-summary');
			s.respond({ success: true, data: { ...empty, series: null } });
			expect(s.text()).toContain('لا توجد بيانات كافية للتحليل');
			expect(s.el.querySelector('table')).toBeNull();
			expect(s.el.querySelector('[data-testid="forecast-estimate"]')).toBeNull();
		});
		it('FAILED and HTTP error: failure text + retry re-calls', () => {
			const s = setup(ForecastSummaryComponent, 'forecast-summary');
			s.respond({ success: true, data: { ...failedR, series: null } });
			expect(s.text()).toContain('تعذر تشغيل التحليل حاليًا');
			(s.el.querySelector('[data-testid="ai-card-retry"]') as HTMLElement).click();
			s.f.detectChanges();
			s.fail();
			expect(s.text()).toContain('تعذر تشغيل التحليل حاليًا');
			(s.el.querySelector('[data-testid="ai-card-retry"]') as HTMLElement).click();
			s.http.expectOne(s.url).flush({ success: true, data: FORECAST });
			s.f.detectChanges();
			expect(s.text()).toContain('ملخص حقيقي');
		});
	});

	describe('reviews summary', () => {
		it('READY: bars from the server distribution + averages', () => {
			const s = setup(ReviewsSummaryComponent, 'sentiment-summary');
			s.respond({ success: true, data: SENT });
			const bars = Array.from(s.el.querySelectorAll('[data-testid="rs-bar"]'));
			expect(bars.length).toBe(2);
			expect(bars[0].textContent).toContain('7 (70%)');
			expect((bars[0].querySelector('.rs-fill') as HTMLElement).style.width).toBe('70%');
			expect(s.text()).toContain('إجمالي التقييمات: 10');
			expect(s.text()).toContain('متوسط التقييم: 4.2');
			expect(s.text()).toContain('إيجابية: 70%');
			expect(s.text()).toContain('سلبية: 10%');
		});
		it('NOT_ENOUGH_DATA / FAILED / HTTP error', () => {
			let s = setup(ReviewsSummaryComponent, 'sentiment-summary');
			s.respond({ success: true, data: { ...empty, stats: null } });
			expect(s.text()).toContain('لا توجد بيانات كافية للتحليل');
			expect(s.el.querySelector('[data-testid="rs-bar"]')).toBeNull();
			TestBed.resetTestingModule();
			s = setup(ReviewsSummaryComponent, 'sentiment-summary');
			s.fail();
			expect(s.text()).toContain('تعذر تشغيل التحليل حاليًا');
			expect(s.el.querySelector('[data-testid="ai-card-retry"]')).not.toBeNull();
		});
	});

	describe('anomaly summary', () => {
		it('READY: count from server, Arabic label, anomaly day', () => {
			const s = setup(AnomalySummaryComponent, 'anomaly-summary');
			s.respond({ success: true, data: ANOM(1) });
			expect(s.el.querySelector('[data-testid="anomaly-count"]')!.textContent).toContain('عدد الأيام غير الاعتيادية: 1');
			const row = s.el.querySelector('[data-testid="anomaly-row"]')!.textContent!;
			expect(row).toContain('محاولات الدخول المرفوضة يوميًا');
			expect(row).toContain('40');
			expect(row).toContain('1.33');
			expect(row).toContain('2026-09-20 — 9');
		});
		it('server-computed zero is shown as 0', () => {
			const s = setup(AnomalySummaryComponent, 'anomaly-summary');
			s.respond({ success: true, data: ANOM(0) });
			expect(s.el.querySelector('[data-testid="anomaly-count"]')!.textContent).toContain('عدد الأيام غير الاعتيادية: 0');
		});
		it('NOT_ENOUGH_DATA (anomalies null): no count line; HTTP error: failed card', () => {
			let s = setup(AnomalySummaryComponent, 'anomaly-summary');
			s.respond({ success: true, data: { ...empty, anomalies: null } });
			expect(s.text()).toContain('لا توجد بيانات كافية للتحليل');
			expect(s.el.querySelector('[data-testid="anomaly-count"]')).toBeNull();
			TestBed.resetTestingModule();
			s = setup(AnomalySummaryComponent, 'anomaly-summary');
			s.fail();
			expect(s.text()).toContain('تعذر تشغيل التحليل حاليًا');
			expect(s.el.querySelector('[data-testid="anomaly-count"]')).toBeNull();
		});
	});

	describe('no static AI phrases on the host pages', () => {
		const D = __dirname;
		const files = ['sa-finance-reports/sa-finance-reports', 'sub-finance/sa-sub-finance-reports/sa-sub-finance-reports', 'analytics/sa-quality/sa-quality', 'sa-audit-trail/sa-audit-trail'];
		const banned = ['ثقة النموذج', 'بثقة', 'توقع AI — ', 'Sentiment Analysis (AI)', '72%', 'رُصدت 3 عمليات', '2.14M'];
		it('old fake strings are gone and each page embeds its real card', () => {
			for (const f of files) for (const ext of ['.html', '.ts']) {
				const s = readFileSync(join(D, f + ext), 'utf8');
				for (const b of banned) expect(s.includes(b), `${f}${ext} contains ${b}`).toBe(false);
			}
			const h = (f: string) => readFileSync(join(D, f + '.html'), 'utf8');
			expect(h(files[0])).toContain('<app-forecast-summary');
			expect(h(files[1])).toContain('<app-forecast-summary');
			expect(h(files[2])).toContain('<app-reviews-summary');
			expect(h(files[3])).toContain('<app-anomaly-summary');
		});
	});
});
