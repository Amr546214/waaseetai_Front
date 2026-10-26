import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Invoices } from './invoices';
import { InvoiceDetails } from '../invoice-details/invoice-details';
import { ClientFinanceService } from '../../../../../core/services/client-finance.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Invoices are STAGE statements built from real deliveries (tax is 0 by policy): no "tax invoice" / VAT wording, completeness is not "accuracy",
// and the PDF button is honest — it opens the browser print dialog.
const INV = (o: object = {}) => ({ id: 'INV-2026-ABC', sourceId: 'd1', contractId: 'c1', projectId: 'p1', stageId: 's1', providerName: 'نورة', date: '2026-10-01T00:00:00Z', project: 'مشروع · مرحلة', projectTitle: 'مشروع', stageTitle: 'مرحلة', subtotal: 250, total: 250, tax: 0, taxRate: 0, status: 'paid', paymentDate: null, verificationScore: 80, taxDocumentAvailable: false, commercialRegistrationAvailable: true, ...o });
const GONE = ['ضريبية معتمدة', 'فواتير ضريبية', 'الفواتير الضريبية', 'ضريبة القيمة المضافة', 'شامل الضريبة', 'ضريبة (', 'لا تُسجَّل ضريبة', 'تنزيل الفاتورة PDF', 'دقة'];
const read = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');

describe('client invoices: honest wording', () => {
	afterEach(() => TestBed.resetTestingModule());

	async function list() {
		await TestBed.configureTestingModule({ imports: [Invoices], providers: [provideRouter([]),
			{ provide: ClientFinanceService, useValue: { getInvoices: () => of({ success: true, data: { summary: {}, invoices: [INV(), INV({ id: 'INV-2', sourceId: 'd2', status: 'due' })] } }) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }) } }] }).compileComponents();
		const f = TestBed.createComponent(Invoices); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement, nav };
	}

	it('the list says «فواتير مراحل مشاريعك», shows three KPIs (no VAT card) and no tax wording', async () => {
		const s = await list();
		const t = s.el.textContent!.replace(/\s+/g, ' ');
		expect(t).toContain('فواتير مراحل مشاريعك');
		for (const gone of GONE) expect(t, gone).not.toContain(gone);
		expect(s.el.querySelectorAll('.grid > div').length).toBeGreaterThanOrEqual(3);
		expect(t).toContain('إجمالي الفواتير'); expect(t).toContain('مدفوعة'); expect(t).toContain('بانتظار الدفع');
		expect(Array.from(s.el.querySelectorAll('th')).map(x => x.textContent!.trim())).toContain('المبلغ');
	});

	it('«دقة» became «اكتمال البيانات» (a completeness percentage, with what it counts)', async () => {
		const s = await list();
		const chip = s.el.querySelector('[data-testid="invoices-completeness"]')!.textContent!.replace(/\s+/g, ' ');
		expect(chip).toContain('اكتمال البيانات'); expect(chip).toContain('%'); expect(chip).not.toContain('دقة');
		expect(s.el.textContent).toContain('العقد الموقّع');
	});

	it('the row action is «طباعة / حفظ كـ PDF» and opens the invoice in print mode', async () => {
		const s = await list();
		const btn = s.el.querySelector('[data-testid="invoice-row-print"]') as HTMLButtonElement;
		expect(btn.getAttribute('title')).toBe('طباعة / حفظ كـ PDF');
		btn.click();
		expect(s.nav).toHaveBeenCalledWith(['/client-overview/finance/invoices', 'd1'], { queryParams: { print: 1 } });
	});

	it('details: «طباعة / حفظ كـ PDF» calls the browser print; no tax rows, no «تنزيل … PDF», «اكتمال بيانات» not «دقة»', async () => {
		const print = vi.spyOn(window, 'print').mockImplementation(() => {});
		await TestBed.configureTestingModule({ imports: [InvoiceDetails], providers: [provideRouter([]),
			{ provide: ClientFinanceService, useValue: { getInvoice: () => of({ success: true, data: INV() }) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }) } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'd1' }), queryParamMap: convertToParamMap({}) } } }] }).compileComponents();
		const f = TestBed.createComponent(InvoiceDetails); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement; const t = el.textContent!.replace(/\s+/g, ' ');
		for (const gone of GONE) expect(t, gone).not.toContain(gone);
		expect(t).toContain('اكتمال بيانات الفاتورة');
		const btn = el.querySelector('[data-testid="invoice-print"]') as HTMLButtonElement;
		expect(btn.textContent).toContain('طباعة / حفظ كـ PDF');
		btn.click();
		expect(print).toHaveBeenCalledTimes(1);
		print.mockRestore();
	});

	it('static guard: the deleted wording is gone from the templates and the VAT total from the component', () => {
		for (const f of ['invoices/invoices.html', 'invoice-details/invoice-details.html']) { const h = read(f); for (const gone of ['ضريبية معتمدة', 'فواتير ضريبية', 'الفواتير الضريبية', 'ضريبة القيمة المضافة', 'شامل الضريبة', 'تنزيل الفاتورة PDF', 'invoice-tax-row', 'invoice-no-tax']) expect(h, `${f}: ${gone}`).not.toContain(gone); }
		const ts = read('invoices/invoices.ts') + read('invoice-details/invoice-details.ts');
		expect(ts).not.toContain('totalTax'); expect(ts).not.toContain('downloadPdf'); expect(ts).not.toContain('downloadInvoice');
	});
});

describe('client invoices: provider-coupon discount', () => {
	afterEach(() => TestBed.resetTestingModule());
	const DISC = INV({ subtotal: 20, discount: 2, couponCode: 'QAC2TEN', total: 18 });

	it('details: service value 20, coupon discount -2 (with the code), total paid 18', async () => {
		await TestBed.configureTestingModule({ imports: [InvoiceDetails], providers: [provideRouter([]),
			{ provide: ClientFinanceService, useValue: { getInvoice: () => of({ success: true, data: DISC }) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }) } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'd1' }), queryParamMap: convertToParamMap({}) } } }] }).compileComponents();
		const f = TestBed.createComponent(InvoiceDetails); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement; const t = el.textContent!.replace(/\s+/g, ' ');
		expect(t).toContain('قيمة الخدمة'); expect(t).toMatch(/قيمة الخدمة\s*20\s*USD/);
		const row = el.querySelector('[data-testid="invoice-discount-row"]')!.textContent!.replace(/\s+/g, ' ');
		expect(row).toContain('خصم الكوبون'); expect(row).toContain('QAC2TEN'); expect(row).toMatch(/-\s*2\s*USD/);
		expect(t).toMatch(/الإجمالي المدفوع\s*18\s*USD/);
	});

	it('details without a coupon: no discount row, total = service value', async () => {
		await TestBed.configureTestingModule({ imports: [InvoiceDetails], providers: [provideRouter([]),
			{ provide: ClientFinanceService, useValue: { getInvoice: () => of({ success: true, data: INV() }) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }) } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'd1' }), queryParamMap: convertToParamMap({}) } } }] }).compileComponents();
		const f = TestBed.createComponent(InvoiceDetails); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="invoice-discount-row"]')).toBeNull();
		expect(el.textContent!.replace(/\s+/g, ' ')).toMatch(/الإجمالي المدفوع\s*250\s*USD/);
	});

	it('list: the amount is what was paid, with «بعد خصم كوبون 2 USD» only for the discounted invoice', async () => {
		await TestBed.configureTestingModule({ imports: [Invoices], providers: [provideRouter([]),
			{ provide: ClientFinanceService, useValue: { getInvoices: () => of({ success: true, data: { summary: {}, invoices: [DISC, INV({ id: 'INV-2', sourceId: 'd2' })] } }) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }) } }] }).compileComponents();
		const f = TestBed.createComponent(Invoices); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const notes = (f.nativeElement as HTMLElement).querySelectorAll('[data-testid="invoice-row-discount"]');
		expect(notes).toHaveLength(1);
		expect(notes[0].textContent).toContain('بعد خصم كوبون 2 USD');
	});
});
