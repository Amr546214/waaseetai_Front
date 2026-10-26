import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { ContractSignature } from './contract-signature';
import { ClientFinanceService } from '../../../../../core/services/client-finance.service';
import { ThemeService } from '../../../../../core/services/theme.service';

// The signature page shows ONLY the frozen contract's real terms (GET /client/my-requests/:id/contract): price, duration and its real stages.
// No invented clauses, and no sign button unless the server says the contract is ready for THIS client.
const MS = (n: number) => Array.from({ length: n }, (_, i) => ({ order: i + 1, title: `مرحلة ${i + 1}`, description: i === 0 ? 'وصف المرحلة الأولى' : '', days: 3 + i, amount: 100 * (i + 1), percentage: 100 / n }));
const CONTRACT = (n: number, o: Record<string, unknown> = {}) => ({ requestId: 'req-1', title: 'مشروع الهوية', contractId: 'c1', state: 'ready', ready: true, offerMatches: true, status: 'PENDING_CLIENT_SIGNATURE', price: 1500, currency: 'USD', durationDays: 21, milestones: MS(n), singleDelivery: n === 0, provider: { id: 'p1', name: 'نورة التصميم' }, escrowFunded: false, otpTtlSeconds: 600, ...o });

describe('client contract signature page: real terms only', () => {
	async function setup(contract: any, opts: { wallet?: number; httpError?: any } = {}) {
		const get = vi.fn((_url: string) => opts.httpError ? throwError(() => opts.httpError) : of({ success: true, data: contract }));
		await TestBed.configureTestingModule({ imports: [ContractSignature], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get } },
			{ provide: ClientFinanceService, useValue: { getWallet: () => of({ data: { summary: { availableBalance: opts.wallet ?? 5000 } } }) } },
			{ provide: ThemeService, useValue: {} },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'req-1' }), queryParamMap: convertToParamMap({ offerId: 'offer-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(ContractSignature); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, get, nav, text: () => el.textContent!.replace(/\s+/g, ' '), q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
	}
	afterEach(() => TestBed.resetTestingModule());

	for (const n of [1, 3, 5]) {
		it(`a contract with ${n} stage(s) shows exactly ${n} real rows, its price and its duration`, async () => {
			const s = await setup(CONTRACT(n));
			expect(s.el.querySelectorAll('[data-testid="cs-milestone"]')).toHaveLength(n);
			expect(s.q('cs-stages-count')!.textContent).toContain(`${n} مراحل`);
			expect(s.text()).toContain('1,500 USD'); expect(s.text()).toContain('21 يوم'); expect(s.text()).toContain('مرحلة 1'); expect(s.text()).toContain('وصف المرحلة الأولى');
			expect(s.q('cs-sign')).not.toBeNull();
		});
	}

	it('the contract is read from the contract endpoint with the chosen offer, never from the offers list', async () => {
		const s = await setup(CONTRACT(2));
		expect(s.get).toHaveBeenCalledTimes(1);
		expect(s.get.mock.calls[0][0]).toContain('/client/my-requests/req-1/contract?offerId=offer-1');
	});

	it('price and duration are the contract\'s (an accepted counter changes the contract, and the page follows it)', async () => {
		const s = await setup(CONTRACT(2, { price: 1800, durationDays: 30 }));
		expect(s.text()).toContain('1,800 USD'); expect(s.text()).toContain('30 يوم');
		expect(s.c.requiredAmount()).toBe(1800);
	});

	it('a contract without stages says it is one final delivery (no invented "3 مراحل")', async () => {
		const s = await setup(CONTRACT(0));
		expect(s.q('cs-no-milestones')!.textContent).toContain('تسليم واحد نهائي');
		expect(s.q('cs-stages-count')!.textContent).toContain('تسليم واحد');
		expect(s.text()).not.toContain('3 مراحل');
	});

	it('none of the invented clauses / claims is rendered', async () => {
		const s = await setup(CONTRACT(5));
		for (const gone of ['3 مراحل', '30 يوما', '30 يومًا', 'ملكية', 'فض النزاع', 'الدعم البشري', 'نموذج موحّد', 'PDPL', 'SAMA', 'v1.0.0', 'تعديل البنود', 'تفاوض بنود العقد']) expect(s.text(), gone).not.toContain(gone);
	});

	it('the source has none of them either, and the fake terms chat (collect text, discard it) is gone', () => {
		const html = readFileSync(join(__dirname, 'contract-signature.html'), 'utf8');
		const ts = readFileSync(join(__dirname, 'contract-signature.ts'), 'utf8');
		for (const gone of ['3 مراحل', '30 يوما', 'ملكية', 'فض النزاع', 'نموذج موحّد', 'PDPL', 'SAMA', 'v1.0.0', 'sendTermMsg', 'openTerms', 'termsInput', 'chatMessages']) { expect(html).not.toContain(gone); expect(ts).not.toContain(gone); }
	});

	it('the real escrow statement stays, built from the contract price; the terms link keeps opening in a new tab', async () => {
		const s = await setup(CONTRACT(3));
		expect(s.text()).toContain('يحجز مبلغ 1,500 USD في حساب الضمان');
		expect(s.text()).toContain('ولا يُفرج عن كل مرحلة إلا بعد اعتمادك لتسليمها');
		const a = s.el.querySelector('a[href="/terms"], a[target="_blank"]') as HTMLAnchorElement;
		expect(a.getAttribute('rel')).toContain('noopener');
	});

	describe('contract not ready: a clear state and NO sign button', () => {
		for (const [name, c] of [
			['no offer selected yet', { requestId: 'req-1', state: 'no_contract', ready: false, message: 'لم يتم اختيار عرض لهذا الطلب بعد.' }],
			['another offer than the one the contract was frozen for', CONTRACT(2, { ready: false, offerMatches: false, message: 'هذا العرض ليس العرض الذي جُهِّز له العقد.' })],
		] as [string, any][]) it(name, async () => {
			const s = await setup(c);
			expect(s.q('cs-blocked')).not.toBeNull();
			expect(s.q('cs-blocked-reason')!.textContent).toContain(c.message.slice(0, 12));
			expect(s.q('cs-sign')).toBeNull();
			expect(s.q('cs-ack')).toBeNull();
			expect(s.el.querySelectorAll('[data-testid="cs-milestone"]')).toHaveLength(0);
			expect(s.text()).not.toContain('بانتظار توقيعك');
		});
	});

	it('an already signed and funded contract shows its terms read-only (no sign button, no agreement box) and says who is awaited', async () => {
		const s = await setup(CONTRACT(2, { state: 'awaiting_provider', ready: false, message: 'وقّعت هذا العقد وأودعت الضمان، وبانتظار توقيع مقدم الخدمة.', escrowFunded: true }));
		expect(s.q('cs-readonly-note')!.textContent).toContain('بانتظار توقيع مقدم الخدمة');
		expect(s.q('cs-readonly-pill')).not.toBeNull();
		expect(s.el.querySelectorAll('[data-testid="cs-milestone"]')).toHaveLength(2);
		expect(s.text()).toContain('1,500 USD');
		expect(s.q('cs-sign')).toBeNull();
		expect(s.q('cs-ack')).toBeNull();
		expect(s.text()).not.toContain('بانتظار توقيعك');
	});

	it('a request that is not the client\'s (404) is a blocked state with the server message and no sign button', async () => {
		const s = await setup(null, { httpError: { status: 404, error: { message: 'طلب المشروع غير موجود أو لا تملك صلاحية الوصول إليه' } } });
		expect(s.q('cs-blocked-reason')!.textContent).toContain('لا تملك صلاحية الوصول');
		expect(s.q('cs-sign')).toBeNull();
	});

	it('a server failure shows a retry state, no terms and no sign button', async () => {
		const s = await setup(null, { httpError: { status: 500 } });
		expect(s.q('cs-error')).not.toBeNull();
		expect(s.q('cs-sign')).toBeNull();
	});

	describe('signing hands over to the deposit page only when allowed', () => {
		it('without ticking the agreement nothing happens (toast), with it the client goes to the deposit page of the same offer', async () => {
			const s = await setup(CONTRACT(2));
			s.q('cs-sign')!.click(); await s.f.whenStable();
			expect(s.nav).not.toHaveBeenCalled();
			expect(TestBed.inject(UiNotificationService).toasts().map(t => [t.kind, t.message])).toEqual([['warning', 'يجب الموافقة على بنود العقد أولا']]);
			(s.q('cs-ack') as HTMLInputElement).click(); s.f.detectChanges();
			s.q('cs-sign')!.click(); await s.f.whenStable();
			expect(s.nav).toHaveBeenCalledWith(['/client-overview/my-requests', 'req-1', 'deposit'], { queryParams: { offerId: 'offer-1' } });
		});

		it('the missing agreement also shows a red alert next to the checkbox with aria-invalid and aria-describedby', async () => {
			const s = await setup(CONTRACT(2));
			s.q('cs-sign')!.click(); await s.f.whenStable(); s.f.detectChanges();
			const box = s.q('cs-ack') as HTMLInputElement;
			const msg = (s.f.nativeElement as HTMLElement).querySelector('[data-testid=field-error]') as HTMLElement;
			expect(msg.getAttribute('role')).toBe('alert');
			expect(msg.textContent).toContain('يجب الموافقة على بنود العقد');
			expect(msg.className).toContain('text-red');
			expect(box.getAttribute('aria-invalid')).toBe('true');
			expect(box.getAttribute('aria-describedby')).toContain(msg.id);
		});

		it('an insufficient wallet is announced with the exact shortfall (the deposit page then offers the top-up)', async () => {
			const s = await setup(CONTRACT(2), { wallet: 1000 });
			(s.q('cs-ack') as HTMLInputElement).click(); s.f.detectChanges();
			s.q('cs-sign')!.click(); await s.f.whenStable(); s.f.detectChanges();
			const shown = TestBed.inject(UiNotificationService).toasts().map(t => t.message).join(' ');
			expect(shown).toContain('رصيد المحفظة غير كافٍ');
			expect(shown).toContain('500');
		});

		it('a double click while the balance is being checked sends the client on once', async () => {
			const s = await setup(CONTRACT(2));
			(s.q('cs-ack') as HTMLInputElement).click(); s.f.detectChanges();
			s.c.isCheckingBalance.set(true);
			s.q('cs-sign')!.click();
			expect(s.nav).not.toHaveBeenCalled();
		});
	});
});
