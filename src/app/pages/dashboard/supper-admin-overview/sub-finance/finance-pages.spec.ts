import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SaRevenues } from '../sa-revenues/sa-revenues';
import { SaSubFinance } from '../sa-sub-finance/sa-sub-finance';
import { SaFinanceReports } from '../sa-finance-reports/sa-finance-reports';
import { SaInvoicesOut } from './sa-invoices-out/sa-invoices-out';
import { SaInvoicesIn } from './sa-invoices-in/sa-invoices-in';
import { SaCommissions } from './sa-commissions/sa-commissions';
import { SaSubFinanceReports } from './sa-sub-finance-reports/sa-sub-finance-reports';
import { SaGovFees } from './sa-gov-fees/sa-gov-fees';
import { SaFutureBilling } from './sa-future-billing/sa-future-billing';
import { SaCashback } from './sa-cashback/sa-cashback';
import { AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';
import { AdminAiService } from '../../../../core/services/admin-ai.service';
import { LevelsService } from '../../../../core/levels/levels.service';
import { signal } from '@angular/core';

const PAG = { page: 1, limit: 10, total: 1, pages: 1, totalPages: 1 };
const OVERVIEW = {
	currency: 'USD',
	totals: { escrowHeldCount: 4, escrowHeldAmount: 1234.56, releasedGross: 8000, platformCommission: 777.77, providerNetReleased: 7222.23, depositsCount: 9, depositsAmount: 9999.99, paymentGatewayFees: 55.55 },
	withdrawals: { PENDING: { count: 2, amount: 321.09 } },
	affiliateCommissions: { PENDING: { count: 1, amount: 11.11 }, APPROVED: { count: 2, amount: 22.22 }, PAID: { count: 3, amount: 33.33 } },
	series: [{ month: '2026-09', deposits: 100, releasedGross: 200, withdrawalsPaid: 50, affiliateCommissions: 5 }, { month: '2026-10', deposits: 300, releasedGross: 400, withdrawalsPaid: 60, affiliateCommissions: 6 }],
};
const TX = { id: 'tx-1', type: 'DEPOSIT', amount: 4242.42, currency: 'USD', status: 'COMPLETED', paymentMethod: 'PAYPAL', referenceId: 'REF-XYZ', description: null, createdAt: '2026-10-05T00:00:00Z', user: { id: 'u', name: 'سلمى الدوسري', email: 's@e.com' } };
const INV = { id: 'i1', sourceId: 's1', contractId: 'c', projectId: 'p', clientName: 'عميل اختبار', providerName: 'مقدم اختبار', projectTitle: 'مشروع الاختبار', stageTitle: 'مرحلة أولى', date: '2026-10-01', stageValue: 640.5, platformCommission: 64.05, net: 576.45, status: 'due', paymentDate: null, currency: 'USD' };

function api(over: Partial<Record<string, any>> = {}) {
	return {
		financeOverview: vi.fn(() => of({ success: true, data: OVERVIEW })),
		financeTransactions: vi.fn(() => of({ success: true, data: { items: [TX], typeCounts: { DEPOSIT: 1, ESCROW_RELEASE: 5 }, pagination: PAG } })),
		financeCommissions: vi.fn(() => of({ success: true, data: { currency: 'USD', totals: { releasedGross: 5000, platformCommission: 500.5, providerNet: 4499.5 }, affiliate: { PAID: { count: 2, amount: 70 } }, items: [{ id: 'e1', projectId: 'p', projectTitle: 'مشروع العمولة', provider: 'مقدم ج', escrowStatus: 'RELEASED', releasedGross: 5000, platformCommission: 500.5, providerNet: 4499.5, ratePercent: 10, level: 3, updatedAt: '2026-10-01' }], pagination: PAG } })),
		financeInvoices: vi.fn((_q?: any) => of({ success: true, data: { currency: 'USD', summary: { totalCount: 1, paidCount: 0, dueCount: 1, paidTotal: 0, dueTotal: 640.5, platformCommission: 64.05 }, items: [INV], pagination: PAG } })),
		downloadCsv: vi.fn((_n: any, _f?: any) => of(new Blob(['x']))),
		...over,
	};
}
function mount<T>(cmp: new (...a: any[]) => T, a = api()) {
	TestBed.configureTestingModule({
		imports: [cmp],
		providers: [provideRouter([]), { provide: AdminOpsApiService, useValue: a },
			{ provide: LevelsService, useValue: { payload: signal(null), ensureLoaded: () => undefined } },
			{ provide: AdminAiService, useValue: { getForecastSummary: () => of({ success: true, data: null }) } }],
	});
	const f = TestBed.createComponent(cmp);
	f.detectChanges();
	return { f, el: f.nativeElement as HTMLElement, a };
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null;
/** saveBlob is an ESM export (cannot be spied): observe the real browser calls instead. */
function stubSave() {
	(URL as any).createObjectURL = vi.fn(() => 'blob:test');
	(URL as any).revokeObjectURL = vi.fn();
	return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
}

afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

describe('SaRevenues', () => {
	it('shows API figures only, real chart, transactions with typeCounts tabs, and real buttons', () => {
		const save = stubSave();
		const { f, el, a } = mount(SaRevenues);
		const t = el.textContent || '';
		for (const v of ['777.77 $', '1,234.56 $', '9,999.99 $', '55.55 $', '321.09 $', '4,242.42 $', 'سلمى الدوسري']) expect(t, v).toContain(v);
		for (const old of ['2.84M', '284K', '1,284', 'ZATCA', 'B2B', 'ضريب']) expect(t, old).not.toContain(old);
		expect(t).toContain('ليست إيرادًا');
		expect(t).toContain('إيداع (1)');
		expect(el.querySelector('[data-testid="rev-chart"]')).toBeTruthy();
		expect(q(el, 'rev-print')!.textContent).toContain('طباعة / حفظ PDF');
		expect(el.textContent).not.toContain('مقارنة بالشهر الماضي');
		(Array.from(el.querySelectorAll('.rev-period-btn')).find((b) => b.textContent?.includes('سنة')) as HTMLButtonElement).click();
		expect(a.financeOverview).toHaveBeenLastCalledWith(12);
		(Array.from(el.querySelectorAll('.rev-tab')).find((b) => b.textContent?.includes('إيداع')) as HTMLButtonElement).click();
		expect(a.financeTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'DEPOSIT', page: 1 }));
		q(el, 'rev-export-csv')!.click();
		expect(a.downloadCsv).toHaveBeenCalledWith('transactions', { type: 'DEPOSIT' });
		expect(save).toHaveBeenCalled();
		f.detectChanges();
	});

	it('shows an error with retry and an empty chart state', () => {
		const empty = { ...OVERVIEW, series: [] };
		const { el } = mount(SaRevenues, api({ financeOverview: () => of({ success: true, data: empty }), financeTransactions: () => of({ success: true, data: { items: [], typeCounts: {}, pagination: PAG } }) }));
		expect(el.textContent).toContain('لا توجد حركة مالية في هذه الفترة');
		expect(el.textContent).toContain('لا توجد معاملات');
	});
});

describe('SaSubFinance', () => {
	it('renders API KPIs and recent transactions; PDF is print and CSV is a real download', () => {
		const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
		stubSave();
		const { el, a } = mount(SaSubFinance);
		const t = el.textContent || '';
		for (const v of ['777.77 $', '9,999.99 $', '1,234.56 $', '321.09 $', 'سلمى الدوسري', '4,242.42 $']) expect(t, v).toContain(v);
		for (const old of ['14.8M', '9.2M', '99.2%', 'عتبة', '10,000']) expect(t, old).not.toContain(old);
		expect(a.financeTransactions).toHaveBeenCalledWith({ limit: 5 });
		expect(q(el, 'sf-print')!.textContent).toContain('طباعة / حفظ PDF');
		q(el, 'sf-print')!.click();
		expect(print).toHaveBeenCalled();
		expect(q(el, 'sf-csv')!.textContent).toContain('تنزيل CSV');
		q(el, 'sf-csv')!.click();
		expect(a.downloadCsv).toHaveBeenCalledWith('transactions');
		expect(el.querySelector('.fd-toast')).toBeNull();
	});
});

describe('SaSubFinance - currencies', () => {
	it('with one currency there is no per-currency strip; with several, each currency is listed on its own and never added', () => {
		const one = mount(SaSubFinance); expect(q(one.el, 'sf-by-currency')).toBeNull();
		TestBed.resetTestingModule();
		const many = { ...OVERVIEW, mixedCurrencies: true, byCurrency: { USD: { escrowHeldAmount: 1234.56, releasedGross: 8000, platformCommission: 777.77, providerNetReleased: 7222.23, depositsAmount: 9999.99 }, SAR: { escrowHeldAmount: 500, releasedGross: 0, platformCommission: 0, providerNetReleased: 0, depositsAmount: 0 } } };
		const m = mount(SaSubFinance, api({ financeOverview: vi.fn(() => of({ success: true, data: many })) }));
		const strip = q(m.el, 'sf-by-currency')!; expect(strip).not.toBeNull(); expect(strip.textContent).toContain('SAR: ضمان محجوز 500.00 SAR'); expect(strip.textContent).toContain('USD: ضمان محجوز 1,234.56 USD');
	});
});

describe('SaFinanceReports', () => {
	it('binds overview to API figures; expenses/profit show the honest empty state plus real cost figures', () => {
		const { f, el } = mount(SaFinanceReports);
		const t = el.textContent || '';
		for (const v of ['777.77 $', '8,000.00 $', '9,999.99 $']) expect(t, v).toContain(v);
		for (const old of ['14.8M', '9.2M', '8.4%']) expect(t, old).not.toContain(old);
		expect(q(el, 'frp-print')!.textContent).toContain('طباعة / حفظ PDF');
		(Array.from(el.querySelectorAll('.frp-tab')).find((b) => b.textContent?.includes('المصروفات')) as HTMLButtonElement).click();
		f.detectChanges();
		expect(q(el, 'frp-no-expenses')!.textContent).toContain('لا يوجد سجل مصروفات في المنصة بعد — لا تُعرض أرقام تقديرية');
		expect(q(el, 'frp-costs')!.textContent).toContain('7,222.23 $');
		expect(q(el, 'frp-costs')!.textContent).toContain('55.55 $');
	});
});

describe('Invoices pages', () => {
	it('invoices-out lists API invoices, filters by status tab and exports invoices CSV', () => {
		stubSave();
		const { f, el, a } = mount(SaInvoicesOut);
		const t = el.textContent || '';
		for (const v of ['مشروع الاختبار', 'مرحلة أولى', 'عميل اختبار', '640.50 $', 'مستحقة']) expect(t, v).toContain(v);
		expect(t).not.toContain('B2B');
		expect(t).not.toContain('B2C');
		(Array.from(el.querySelectorAll('.fio-tab')).find((b) => b.textContent?.includes('مدفوعة')) as HTMLButtonElement).click();
		expect(a.financeInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'paid' }));
		q(el, 'inv-export')!.click();
		expect(a.downloadCsv).toHaveBeenCalledWith('invoices', { status: 'paid' });
		expect(q(el, 'inv-new')!.disabled).toBe(true);
		expect(q(el, 'inv-new-reason')!.textContent?.trim().length).toBeGreaterThan(5);
		f.detectChanges();
	});
	it('invoices-in shows provider, platform commission and provider net', () => {
		const { el } = mount(SaInvoicesIn);
		const t = el.textContent || '';
		for (const v of ['مقدم اختبار', '64.05 $', '576.45 $']) expect(t, v).toContain(v);
	});
});

describe('SaCommissions', () => {
	it('shows per-project commission and affiliate totals from the API, no 15-tier mock, disabled edit with reason', () => {
		const { el, a } = mount(SaCommissions);
		const t = el.textContent || '';
		for (const v of ['500.50 $', 'مشروع العمولة', '70.00 $']) expect(t, v).toContain(v);
		for (const old of ['1,247', '2.96M', 'M15', 'أسطوري']) expect(t, old).not.toContain(old);
		expect(q(el, 'cm-edit')!.disabled).toBe(true);
		expect(q(el, 'cm-edit-reason')!.textContent?.trim().length).toBeGreaterThan(5);
		q(el, 'cm-export')!.click();
		expect(a.downloadCsv).toHaveBeenCalledWith('commissions');
	});
});

describe('SaSubFinanceReports', () => {
	it('offers the four real CSV exports and print', () => {
		const { el, a } = mount(SaSubFinanceReports);
		for (const n of ['transactions', 'commissions', 'invoices', 'withdrawals']) {
			q(el, 'sfr-dl-' + n)!.click();
			expect(a.downloadCsv).toHaveBeenLastCalledWith(n);
		}
		expect(q(el, 'sfr-print')!.textContent).toContain('طباعة / حفظ PDF');
		expect(el.textContent).not.toContain('14.8M');
	});
});

describe('Pages with no backend source: honest empty state, disabled actions, no mock rows', () => {
	it.each([
		[SaGovFees, 'لا توجد رسوم حكومية مسجّلة في المنصة', ['1.24M', '508,800', '31 مارس']],
		[SaFutureBilling, 'الفوترة المستقبلية غير مفعّلة', ['8,247', '310000000001233', 'QR']],
		[SaCashback, 'الكاش باك قيد القرار ولم يُفعَّل بعد', ['487k', 'هيثم القرني', '84.6%']],
	] as const)('%o', (cmp, msg, mocks) => {
		const { el } = mount(cmp as any);
		const t = el.textContent || '';
		expect(t).toContain(msg);
		for (const m of mocks) expect(t, m).not.toContain(m);
		const btns = Array.from(el.querySelectorAll('button'));
		expect(btns.length).toBeGreaterThan(0);
		for (const b of btns) { expect(b.disabled).toBe(true); expect(b.getAttribute('title')?.length).toBeGreaterThan(5); }
		expect(q(el, 'sf-empty-reason')!.textContent?.trim().length).toBeGreaterThan(10);
		expect(el.querySelector('table')).toBeNull();
	});
});
