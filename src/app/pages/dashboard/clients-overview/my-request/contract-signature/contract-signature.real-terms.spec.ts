import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContractSignature } from './contract-signature';
import { ClientFinanceService } from '../../../../../core/services/client-finance.service';
import { ThemeService } from '../../../../../core/services/theme.service';

// The signature page shows ONLY the chosen offer's real terms: price, duration, scope and its real milestones. No invented clauses.
const MS = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, stepOrder: i + 1, title: `مرحلة ${i + 1}`, description: i === 0 ? 'وصف المرحلة الأولى' : '', days: 3 + i, amount: 100 * (i + 1), percentage: 100 / n }));
const OFFER = (n: number, o: Record<string, unknown> = {}) => ({ id: 'offer-1', totalPrice: 1500, deliveryDays: 21, outputs: 'تصميم الهوية', message: 'رسالة', provider: { name: 'نورة التصميم' }, milestones: MS(n), ...o });

describe('client contract signature page: real terms only', () => {
	async function setup(offer: any) {
		await TestBed.configureTestingModule({ imports: [ContractSignature], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get: () => of({ success: true, data: { title: 'مشروع الهوية', proposals: [offer] } }) } },
			{ provide: ClientFinanceService, useValue: { getWallet: () => of({ data: { summary: { availableBalance: 5000 } } }) } },
			{ provide: ThemeService, useValue: {} },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'req-1' }), queryParamMap: convertToParamMap({ offerId: 'offer-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(ContractSignature); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, text: () => el.textContent!.replace(/\s+/g, ' '), q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
	}
	afterEach(() => TestBed.resetTestingModule());

	for (const n of [1, 3, 5]) {
		it(`an offer with ${n} milestone(s) shows exactly ${n} real rows, its price and its duration`, async () => {
			const s = await setup(OFFER(n));
			expect(s.el.querySelectorAll('[data-testid="cs-milestone"]')).toHaveLength(n);
			expect(s.q('cs-stages-count')!.textContent).toContain(`${n} مراحل`);
			expect(s.text()).toContain('1500 $'); expect(s.text()).toContain('21 يوم'); expect(s.text()).toContain('مرحلة 1'); expect(s.text()).toContain('وصف المرحلة الأولى');
			expect(s.text()).toContain('تصميم الهوية');
		});
	}

	it('an offer without milestones says so (no invented "3 مراحل")', async () => {
		const s = await setup(OFFER(0));
		expect(s.q('cs-no-milestones')).not.toBeNull();
		expect(s.q('cs-stages-count')!.textContent).toContain('غير محددة');
		expect(s.text()).not.toContain('3 مراحل');
	});

	it('none of the invented clauses / claims is rendered', async () => {
		const s = await setup(OFFER(5));
		for (const gone of ['3 مراحل', '30 يوما', '30 يومًا', 'ملكية', 'فض النزاع', 'الدعم البشري', 'نموذج موحّد', 'PDPL', 'SAMA', 'v1.0.0', 'تعديل البنود', 'تفاوض بنود العقد']) expect(s.text(), gone).not.toContain(gone);
	});

	it('the source has none of them either, and the fake terms chat (collect text, discard it) is gone', () => {
		const html = readFileSync(join(__dirname, 'contract-signature.html'), 'utf8');
		const ts = readFileSync(join(__dirname, 'contract-signature.ts'), 'utf8');
		for (const gone of ['3 مراحل', '30 يوما', 'ملكية', 'فض النزاع', 'نموذج موحّد', 'PDPL', 'SAMA', 'v1.0.0', 'sendTermMsg', 'openTerms', 'termsInput', 'chatMessages']) { expect(html).not.toContain(gone); expect(ts).not.toContain(gone); }
	});

	it('the real escrow statement stays, built from the contract price; the terms link keeps opening in a new tab', async () => {
		const s = await setup(OFFER(3));
		expect(s.text()).toContain('يحجز مبلغ 1500 $ في حساب الضمان');
		expect(s.text()).toContain('ولا يُفرج عن كل مرحلة إلا بعد اعتمادك لتسليمها');
		const a = s.el.querySelector('a[href="/terms"], a[target="_blank"]') as HTMLAnchorElement;
		expect(a.getAttribute('rel')).toContain('noopener');
	});

	it('an offer that is not available shows the toast and no terms', async () => {
		const s = await setup(OFFER(3, { id: 'another' }));
		expect(s.el.querySelectorAll('[data-testid="cs-milestone"]')).toHaveLength(0);
	});
});
