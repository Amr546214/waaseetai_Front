import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { InvoicesComponent } from './finance/invoices/invoices';
import { helpRoleOfUrl } from '../../../core/help/help-guided';

// Individual-provider FE cleanup 1: nothing fake, nothing that promises what does not exist. (Bebo is NOT touched: normal everywhere, guided-only in the help pages.)
const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
const FOOTER_FILES: string[] = [];
(function walk(dir: string) { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (/\.html$/.test(n)) FOOTER_FILES.push(p); } })(__dirname);

describe('provider invoices page', () => {
	it('shows an honest empty state: no invented invoices, clients, ids, tax or download button', async () => {
		await TestBed.configureTestingModule({ imports: [InvoicesComponent], providers: [provideRouter([])] }).compileComponents();
		const f = TestBed.createComponent(InvoicesComponent); f.detectChanges();
		const el = f.nativeElement as HTMLElement; const t = el.textContent!.replace(/\s+/g, ' ');
		expect(el.querySelector('[data-testid="provider-invoices-empty"]')).not.toBeNull();
		expect(t).toContain('لا توجد فواتير مزوّد متاحة حاليًا');
		for (const gone of ['INV-', 'ضريب', 'نورة التصميم', 'رشا الكاتبة', 'تقنية الرواد', 'مكتب أفق', 'تنزيل', 'معتمدة']) expect(t, gone).not.toContain(gone);
		expect(el.querySelectorAll('button')).toHaveLength(0);
		expect(el.querySelector('[data-testid="provider-invoices-to-transactions"]')!.getAttribute('href')).toBe('/provider-overview/finance/transactions');
		TestBed.resetTestingModule();
	});
	it('the source has no mock invoices, no setTimeout fake load, no toast download', () => {
		const ts = read('finance/invoices/invoices.ts');
		for (const gone of ['mockInvoices', 'setTimeout', 'downloadInvoice', 'showToast', 'INV-2026']) expect(ts, gone).not.toContain(gone);
	});
});

describe('provider wallet / reports / receipt', () => {
	it('wallet: the dead deposit button is hidden for the individual provider; no fixed donut; no invented "one active project"', () => {
		const w = read('finance/wallet/wallet.html');
		expect(w).toMatch(/@if \(isCompany\(\)\) \{\s*<button type="button" class="wal-btn wal-btn-sec" \(click\)="openDepositModal\(\)">/);
		expect(w).not.toContain('مشروع نشط واحد');
		expect(w).not.toContain('stroke-dasharray="149 77"');
		expect(w).toContain('data-testid="wallet-ring"');
		expect(w).toContain('ringTotal() > 0');
	});
	it('deposit modal: no invented limits (50 / 100,000) and no PayPal-fee row', () => {
		const h = read('finance/wallet/deposit-modal/deposit-modal.html'); const t = read('finance/wallet/deposit-modal/deposit-modal.ts');
		for (const gone of ['أقل مبلغ للإيداع', '100,000', 'رسوم PayPal']) expect(h, gone).not.toContain(gone);
		expect(t).not.toMatch(/>= 50|100000/);
	});
	it('reports: the toast-only PDF / CSV buttons are gone for the individual provider (company keeps its own)', () => {
		const r = read('reports/reports.html');
		expect(r).toMatch(/@if \(isCompanyMode\(\)\) \{\s*<div class="flex items-center gap-2">\s*<button/);
	});
	it('transaction details: «طباعة / حفظ كـ PDF» (it is window.print), no hardcoded payment method', () => {
		const h = read('finance/transaction-details/transaction-details.html');
		expect(h).toContain('طباعة / حفظ كـ PDF'); expect(h).not.toContain('تحميل الإيصال'); expect(h).not.toContain('طريقة الدفع'); expect(h).not.toContain('رصيد المحفظة');
		expect(read('finance/transaction-details/transaction-details.ts')).toContain('window.print()');
	});
});

describe('placeholder routes', () => {
	it('service-edit / customer-requests / business-models negotiation are not routed and nothing links to them', () => {
		const routes = read('provider.routes.ts');
		for (const gone of ['service-edit', 'customer-requests', 'business-models/negotiation']) expect(routes, gone).not.toContain(gone);
		for (const f of FOOTER_FILES) { const h = readFileSync(f, 'utf8'); for (const gone of ['business-models/service-edit', 'business-models/customer-requests', 'business-models/negotiation']) expect(h, `${f}: ${gone}`).not.toContain(gone); }
	});
});

describe('sign-contract (provider)', () => {
	const h = read('offers/sign-contract/sign-contract.html'); const t = read('offers/sign-contract/sign-contract.ts');
	it('no fake terms chat / «تعديل البنود عبر المحادثة»; the other party is the CLIENT', () => {
		for (const gone of ['تعديل البنود عبر المحادثة', 'تفاوض بنود العقد', 'openTermsModal', 'sendTermMsg', 'chatMessages', 'termInput']) { expect(h, gone).not.toContain(gone); expect(t, gone).not.toContain(gone); }
		expect(t).toContain('clientName = signal'); expect(t).not.toContain('providerName');
	});
	it('no internal «قاعدة البيانات» wording in the toasts', () => {
		expect(t).not.toContain('قاعدة البيانات');
		expect(t).toContain('تم توقيع العقد بنجاح');
	});
});

describe('help (provider)', () => {
	const h = read('help/help.html');
	it('no invented availability / response times, no «human live chat» wording', () => {
		for (const gone of ['متاح الآن', 'الرد خلال دقائق', 'الرد خلال 24 ساعة', 'شات مباشر مع موظف', 'الدعم المباشر']) expect(h, gone).not.toContain(gone);
		expect(h).toContain('إنشاء تذكرة دعم'); expect(h).toContain('data-testid="help-create-ticket"');
	});
	it('FAQ is written for the provider (earnings / release / change request / dispute), not the client', () => {
		for (const gone of ['عند طلب خدمة', 'ترتيب العروض المقدّمة لي', 'تسوية الرصيد عند إلغاء الطلب', 'الكاش باك', 'الإيداع']) expect(h, gone).not.toContain(gone);
		expect(h).toContain('كيف يحمي الضمان أرباحي؟'); expect(h).toContain('متى تصلني أرباح المرحلة؟');
	});
	it('tickets list: no fake «average response time» tile', () => {
		expect(read('help/tickets/tickets.html')).not.toContain('متوسط زمن الرد');
	});
});

describe('profile setup / level', () => {
	it('profile/setup: no «30 يوم» wait claim; the unsaved language / channels / timezone preferences are gone', () => {
		const h = read('profile/profile-setup/profile-setup.html');
		for (const gone of ['30 يوم', '30 يوما', 'لغة الواجهة', 'قنوات الإشعارات', 'المنطقة الزمنية', 'tz-select']) expect(h, gone).not.toContain(gone);
	});
	it('profile/level: no fixed timeline lines (11/15, 4/15, M1–M4) and no unbacked search-priority benefit', () => {
		const h = read('profile/level/level.html');
		for (const gone of ['100%*11/15', '100%*4/15', 'M1 to M4', 'أولوية ظهور نماذجك']) expect(h, gone).not.toContain(gone);
	});
});

describe('accreditation/new + apply wizard', () => {
	it('accreditation step 3 (manual review): no AI icon, no AI purple', () => {
		const h = read('business-models/accreditation/new/components/step3-evaluation/step3-evaluation.component.html');
		for (const gone of ['#i-ai', '#C084FC', '#A56BE0', '165,107,224']) expect(h, gone).not.toContain(gone);
	});
	it('apply wizard: no 48-hour promise, no market-comparison claim, no invented default price', () => {
		const html = read('explore-requests/applay-request/applay-request.html'); const ts = read('explore-requests/applay-request/applay-request.ts'); const s2 = read('explore-requests/applay-request/components/step2-pricing/step2-pricing.html');
		expect(html).not.toContain('48 ساعة'); expect(s2).not.toContain('يقارن التوزيع بالسوق'); expect(s2).not.toContain('#i-ai'); expect(s2).toContain('data-testid="step2-note"');
		expect(ts).toContain('totalBudget = signal<number>(0)'); expect(ts).not.toContain('signal<number>(4500)');
		expect(ts).toContain('draft_proposal_v2_'); expect(ts).not.toMatch(/removeItem\(`draft_proposal_\$/);
	});
	it('explore-requests «مؤشرات الطلب»: neutral icon (the AI network glyph and purple are gone from the rule-based block)', () => {
		const h = read('explore-requests/explore-requests.html');
		const block = h.slice(h.indexOf('<div class="rc-ai-lbl">'), h.indexOf('مؤشرات الطلب</div>'));
		expect(block).not.toContain('<circle'); expect(block).toContain('#i-chart');
		expect(read('explore-requests/explore-requests.css')).not.toContain('.rc-ai-lbl{display:flex;align-items:center;gap:5px;font-size:9px;font-weight:900;color:var(--ai-txt,#A56BE0)');
	});
});

describe('decorative footers in the provider pages', () => {
	it('no «SAMA», no «v1.0.0», no «PDPL» decorative footer anywhere under provider-overview', () => {
		const offenders: string[] = [];
		for (const f of FOOTER_FILES) { const h = readFileSync(f, 'utf8'); for (const bad of ['v1.0.0', '>SAMA<', '>PDPL<']) if (h.includes(bad)) offenders.push(`${f.replace(__dirname, '')}: ${bad}`); }
		expect(offenders).toEqual([]);
	});
});

describe('Bebo behaviour is unchanged', () => {
	it('guided (no free text) only inside the help pages of each role; every other page keeps the normal assistant', () => {
		for (const role of ['provider', 'client', 'marketer']) {
			expect(helpRoleOfUrl(`/${role}-overview/help`)).toBe(role);
			expect(helpRoleOfUrl(`/${role}-overview/help/tickets`)).toBe(role);
			expect(helpRoleOfUrl(`/${role}-overview/finance/wallet`)).toBeNull();
		}
		expect(helpRoleOfUrl('/provider-overview/messages')).toBeNull();
		expect(helpRoleOfUrl('/provider-overview')).toBeNull();
	});
});
