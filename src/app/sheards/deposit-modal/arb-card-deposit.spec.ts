import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ArbCardDeposit } from './arb-card-deposit';
import { ArbDepositService, ArbView } from '../../core/services/arb-deposit.service';

const view = (state: ArbView['state'], over: Partial<ArbView> = {}): ArbView => ({ reference: 'ref-1', state, message: 'م', nextStep: 'خ', redirectUrl: null, creditedUsd: null, chargedSar: null, bankFinal: false, requiresAcknowledgement: false, previousReference: null, ...over });
const quote = { netUsd: 100, feePercent: 4.25, feeUsd: 4.44, grossUsd: 104.44, chargedSar: 391.65, currency: 'SAR' as const, sarPerUsd: 3.75 };

function setup(over: { available?: boolean; initiate?: any; open?: any; amount?: number | null; terms?: boolean } = {}) {
	const svc = { availability: () => of({ success: true, data: { available: over.available ?? true } }), quote: vi.fn(() => of({ success: true, data: quote })), initiate: vi.fn(over.initiate ?? (() => of({ success: true, data: view('WAITING_PAGE', { redirectUrl: 'https://bank.example/pg/paymentpage.htm?PaymentID=1' }) }))), open: vi.fn(over.open ?? (() => of({ success: true, data: null }))) };
	TestBed.configureTestingModule({ imports: [ArbCardDeposit], providers: [provideRouter([]), { provide: ArbDepositService, useValue: svc }] });
	const f = TestBed.createComponent(ArbCardDeposit);
	f.componentRef.setInput('amount', over.amount === undefined ? 100 : over.amount); f.componentRef.setInput('termsAccepted', over.terms ?? true);
	f.detectChanges();
	const c: any = f.componentInstance; const nav = vi.spyOn(c, 'navigateTo').mockImplementation(() => {});
	return { f, c, svc, nav, el: f.nativeElement as HTMLElement, router: TestBed.inject(Router) };
}

describe('bank card deposit option', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('is not rendered at all while the server says the rail is not available', () => {
		const { el } = setup({ available: false });
		expect(el.querySelector('[data-testid="arb-card-box"]')).toBeNull();
	});

	it('closed rail: nothing is rendered AND nothing but the availability question is ever sent (no quote, no initiate, no open)', () => {
		const { c, f, svc } = setup({ available: false });
		f.componentRef.setInput('amount', 500); f.detectChanges();
		c.pay(); // even a forced call cannot reach a bank request while closed: the box (and its button) does not exist
		expect(svc.quote).not.toHaveBeenCalled(); expect(svc.open).not.toHaveBeenCalled();
	});

	it('shows the SERVER quote (net, fee, the SAR amount that will be charged) before the user leaves', () => {
		const { f, el, svc } = setup(); f.detectChanges();
		expect(svc.quote).toHaveBeenCalledWith(100);
		expect(el.querySelector('[data-testid="arb-quote-sar"]')?.textContent).toContain('391.65');
	});

	it('sends ONLY the net amount and follows the bank address it received (https)', () => {
		const { c, svc, nav } = setup();
		c.pay();
		expect(svc.initiate).toHaveBeenCalledWith(100);
		expect(nav).toHaveBeenCalledWith('https://bank.example/pg/paymentpage.htm?PaymentID=1');
	});

	it('terms not accepted / amount missing: nothing is sent, the dialog is told to explain', () => {
		const a = setup({ terms: false }); const t = vi.fn(); a.c.termsMissing.subscribe(t); a.c.pay();
		expect(t).toHaveBeenCalled(); expect(a.svc.initiate).not.toHaveBeenCalled();
		TestBed.resetTestingModule();
		const b = setup({ amount: null }); const m = vi.fn(); b.c.amountMissing.subscribe(m); b.c.pay();
		expect(m).toHaveBeenCalled(); expect(b.svc.initiate).not.toHaveBeenCalled();
	});

	it('double click sends one request', () => {
		let calls = 0; const { c, svc } = setup({ initiate: () => { calls++; return new Subject(); } });
		c.pay(); c.pay(); c.pay();
		expect(svc.initiate).toHaveBeenCalledTimes(1);
	});

	it('an existing open attempt is followed on the wallet page instead of starting another', () => {
		const { c, router } = setup({ initiate: () => of({ success: true, data: view('VERIFYING') }) });
		const go = vi.spyOn(router, 'navigate').mockResolvedValue(true);
		c.pay();
		expect(go).toHaveBeenCalledWith(['/client-overview/finance/wallet'], { queryParams: { arb: 'ref-1' } });
	});

	it('a clear refusal (400/503) is shown beside the button and the button works again', () => {
		const { c, f, el } = setup({ initiate: () => throwError(() => ({ status: 503, error: { message: 'الدفع بالبطاقة غير متاح حاليًا.' } })) });
		c.pay(); f.detectChanges();
		expect(el.querySelector('[data-testid="arb-error"]')).toBeTruthy(); expect(c.busy()).toBe(false); expect(c.blocked()).toBe(false);
	});

	it('LOST answer to "start": looks for the attempt first; found -> follow it; not found -> says nothing was charged and allows a retry; cannot tell -> blocks', () => {
		const lost = () => throwError(() => ({ status: 0 }));
		const found = setup({ initiate: lost, open: () => of({ success: true, data: view('WAITING_PAGE') }) });
		const go = vi.spyOn(found.router, 'navigate').mockResolvedValue(true); found.c.pay();
		expect(go).toHaveBeenCalledWith(['/client-overview/finance/wallet'], { queryParams: { arb: 'ref-1' } });
		TestBed.resetTestingModule();
		const none = setup({ initiate: lost, open: () => of({ success: true, data: null }) }); none.c.pay(); none.f.detectChanges();
		expect(none.c.blocked()).toBe(false); expect(none.el.querySelector('[data-testid="arb-error"]')?.textContent).toContain('لم يُخصم');
		TestBed.resetTestingModule();
		const unknown = setup({ initiate: lost, open: () => throwError(() => ({ status: 0 })) }); unknown.c.pay(); unknown.f.detectChanges();
		expect(unknown.c.blocked()).toBe(true); expect(unknown.el.querySelector('[data-testid="arb-error"]')?.textContent).toContain('قبل المحاولة مرة أخرى');
		unknown.c.pay(); expect(unknown.svc.initiate).toHaveBeenCalledTimes(1);
	});

	it('refuses to follow a non-https destination', () => {
		const { c, f, el } = setup({ initiate: () => of({ success: true, data: view('WAITING_PAGE', { redirectUrl: 'http://bank.example/p' }) }) });
		vi.spyOn(c, 'navigateTo').mockRestore();
		const assign = vi.fn(); vi.stubGlobal('location', { ...window.location, assign });
		c.pay(); f.detectChanges();
		expect(assign).not.toHaveBeenCalled(); expect(el.querySelector('[data-testid="arb-error"]')).toBeTruthy();
		vi.unstubAllGlobals();
	});

	it('the quote also shows the rate and the wallet credit in dollars before the user leaves', () => {
		const { f, el } = setup(); f.detectChanges();
		expect(el.querySelector('[data-testid="arb-quote-rate"]')?.textContent).toContain('3.75');
		expect(el.querySelector('[data-testid="arb-quote-wallet"]')?.textContent).toContain('100.00');
	});

	it('an earlier attempt that can still be collected BLOCKS a new start: warning, no acknowledgement box, the button stays disabled, «تحديث الحالة» asks again; it lifts only when the server says so', () => {
		const unsettled = view('UNSETTLED', { previousReference: 'old-1', message: 'لم نتأكد بعد', nextStep: 'لا يمكن بدء عملية جديدة قبل أن يحسم البنك' });
		let n = 0;
		const { c, f, el, svc } = setup({ initiate: () => of({ success: true, data: ++n < 3 ? unsettled : view('WAITING_PAGE', { redirectUrl: 'https://bank.example/pg/paymentpage.htm?PaymentID=2' }) }) });
		c.pay(); f.detectChanges();
		expect(el.querySelector('[data-testid="arb-unsettled"]')).toBeTruthy();
		expect(el.querySelector('[data-testid="arb-ack"]')).toBeNull(); // no «accept the double-charge risk» box
		expect((el.querySelector('[data-testid="arb-pay"]') as HTMLButtonElement).disabled).toBe(true);
		expect((el.querySelector('[data-testid="arb-follow-previous"]') as HTMLAnchorElement).getAttribute('href')).toContain('arb=old-1');
		(el.querySelector('[data-testid="arb-refresh"]') as HTMLButtonElement).click(); f.detectChanges(); // still blocked
		expect(el.querySelector('[data-testid="arb-unsettled"]')).toBeTruthy(); expect(c.navigateTo).not.toHaveBeenCalled();
		(el.querySelector('[data-testid="arb-refresh"]') as HTMLButtonElement).click(); f.detectChanges(); // the server finally answers: the bank is final
		expect(svc.initiate).toHaveBeenCalledTimes(3); for (const call of svc.initiate.mock.calls) expect(call).toEqual([100]);
		expect(c.navigateTo).toHaveBeenCalled();
		expect(el.querySelector('[data-testid="arb-unsettled"]')).toBeNull();
	});
});
