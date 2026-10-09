import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { Reports } from './reports';
import { ThemeService } from '../../../../core/services/theme.service';
import { ClientReportsService } from '../../../../core/services/client-reports.service';

const REPORT = { success: true, data: {
	kpis: { totalSpent: 100, avgRating: 4, ratingDelta: 0, activeOrders: 1, completedOrders: 1, totalOrders: 2 },
	orders: { counts: { all: 0 }, items: [], statusDistribution: {}, acceptanceBySpecialty: [] },
	projects: { activeCount: 0, completedCount: 0, items: [] },
	finance: { transactions: [] }, disputes: { counts: { all: 0 }, items: [] },
} } as any;
const ai = (o: any) => ({ success: true, data: { status: 'READY', source: 'GEMINI', score: null, confidence: null, summary: 'ملخص تجريبي', recommendation: null, details: { observations: [{ text: 'ملاحظة' }], recommendations: [{ text: 'توصية' }] }, generatedAt: null, ...o } });

describe('client reports — AI summary card', () => {
	function setup(getAiSummary: (r: string) => any) {
		const calls: string[] = [];
		TestBed.configureTestingModule({
			imports: [Reports], providers: [provideRouter([]), { provide: ThemeService, useValue: { isDark: () => true, theme: () => 'dark' } }, { provide: ClientReportsService, useValue: {
				getReports: () => of(REPORT), getAiSummary: (r: string) => { calls.push(r); return getAiSummary(r); },
			} }],
		});
		const f = TestBed.createComponent(Reports);
		f.detectChanges();
		return { f, calls, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('READY: AI card with summary, observations and recommendations', () => {
		const { el, calls } = setup(() => of(ai({})));
		expect(calls).toEqual(['month']);
		expect(el.querySelector('[data-testid="ai-card-ai"]')).toBeTruthy();
		expect(el.textContent).toContain('ملخص ذكي لنشاطك');
		expect(el.textContent).toContain('ملخص تجريبي');
		expect(el.textContent).toContain('ملاحظة');
		expect(el.textContent).toContain('توصية');
	});
	it('top acceptance stat is plain data outside the AI card; hidden without data', () => {
		const withData = JSON.parse(JSON.stringify(REPORT));
		withData.data.orders.acceptanceBySpecialty = [{ specialty: 'تصميم', rate: 80, total: 5 }, { specialty: 'برمجة', rate: 50, total: 4 }];
		TestBed.configureTestingModule({
			imports: [Reports], providers: [provideRouter([]), { provide: ThemeService, useValue: { isDark: () => true, theme: () => 'dark' } }, { provide: ClientReportsService, useValue: { getReports: () => of(withData), getAiSummary: () => of(ai({})) } }],
		});
		const f = TestBed.createComponent(Reports); f.detectChanges();
		const stat = (f.nativeElement as HTMLElement).querySelector('[data-testid="top-acceptance-stat"]')!;
		expect(stat.textContent).toContain('«تصميم» بنسبة 80%');
		expect(stat.closest('ws-ai-result-card')).toBeNull();
		expect(stat.querySelector('circle')).toBeNull();
		TestBed.resetTestingModule();
		const { el } = setup(() => of(ai({})));
		expect(el.querySelector('[data-testid="top-acceptance-stat"]')).toBeNull();
	});
	it('loading state', () => {
		const { el } = setup(() => new Subject());
		expect(el.querySelector('[data-testid="ai-card-loading"]')).toBeTruthy();
		expect(el.textContent).toContain('جارٍ التحليل');
	});
	it('NOT_ENOUGH_DATA', () => {
		const { el } = setup(() => of(ai({ status: 'NOT_ENOUGH_DATA', source: 'NONE', summary: null, details: null })));
		expect(el.textContent).toContain('لا توجد بيانات كافية للتحليل');
		expect(el.querySelector('[data-testid="ai-card-ai"]')).toBeNull();
	});
	it('FAILED result and HTTP error: neutral message + retry, report still renders', () => {
		for (const src of [() => of(ai({ status: 'FAILED', source: 'NONE', summary: null, details: null })), () => throwError(() => new Error('x'))]) {
			const { f, el } = setup(src);
			expect(el.textContent).toContain('تعذر تشغيل التحليل حاليًا');
			expect(el.querySelector('[data-testid="ai-card-retry"]')).toBeTruthy();
			expect(el.querySelector('.kpi-card')).toBeTruthy();
			expect(f.componentInstance.hasError()).toBe(false);
			TestBed.resetTestingModule();
		}
	});
	it('retry calls the endpoint again', () => {
		const { f, el, calls } = setup(() => throwError(() => new Error('x')));
		(el.querySelector('[data-testid="ai-card-retry"]') as HTMLButtonElement).click();
		f.detectChanges();
		expect(calls).toEqual(['month', 'month']);
	});
	it('range change reloads with that range and ignores a stale response', () => {
		const subs: Record<string, Subject<any>> = { month: new Subject(), '3m': new Subject() };
		const { f, el, calls } = setup(r => subs[r]);
		f.componentInstance.setDate('3m');
		f.detectChanges();
		expect(calls).toEqual(['month', '3m']);
		subs['3m'].next(ai({ summary: 'جديد' })); subs['3m'].complete();
		subs['month'].next(ai({ summary: 'قديم' })); subs['month'].complete();
		f.detectChanges();
		expect(el.textContent).toContain('جديد');
		expect(el.textContent).not.toContain('قديم');
	});
	it('custom range: no AI card, no call', () => {
		const { f, el, calls } = setup(() => of(ai({})));
		f.componentInstance.dpApply();
		f.detectChanges();
		expect(calls).toEqual(['month']);
		expect(el.querySelector('ws-ai-result-card section')).toBeNull();
	});
});
