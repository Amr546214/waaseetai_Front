import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ArbPaymentBanner } from './arb-payment-banner';
import { ArbDepositService, ArbView } from '../../core/services/arb-deposit.service';

const view = (state: ArbView['state'], over: Partial<ArbView> = {}): ArbView => ({ reference: 'ref-1', state, message: 'رسالة ' + state, nextStep: 'الخطوة التالية', redirectUrl: null, creditedUsd: null, chargedSar: null, bankFinal: false, requiresAcknowledgement: false, previousReference: null, ...over });

function setup(opts: { arbParam: string | null; status?: any; open?: any }) {
	const svc: any = { abandon: vi.fn(() => of({ success: true, data: view('CANCELLED') })), status: vi.fn(opts.status ?? (() => of({ success: true, data: view('VERIFYING') }))), open: vi.fn(opts.open ?? (() => of({ success: true, data: null }))) };
	TestBed.configureTestingModule({ imports: [ArbPaymentBanner], providers: [provideRouter([]), { provide: ArbDepositService, useValue: svc }, { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => opts.arbParam } } } }] });
	const f = TestBed.createComponent(ArbPaymentBanner); f.detectChanges();
	return { f, c: f.componentInstance, svc, el: f.nativeElement as HTMLElement };
}

describe('arb payment banner: shows only what the server verified', () => {
	afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });

	it('nothing in the address and no open attempt: no banner at all', () => {
		const { el, svc } = setup({ arbParam: null });
		expect(svc.open).toHaveBeenCalled(); expect(svc.status).not.toHaveBeenCalled();
		expect(el.querySelector('[data-testid="arb-banner"]')).toBeNull();
	});

	it('?arb=<ref>: asks the SERVER for the state (the address is a pointer, never a result)', () => {
		const { el, svc } = setup({ arbParam: 'ref-1' });
		expect(svc.status).toHaveBeenCalledWith('ref-1');
		expect(el.querySelector('[data-testid="arb-banner"]')?.getAttribute('data-state')).toBe('VERIFYING');
		expect(el.querySelector('[data-testid="arb-next"]')?.textContent).toContain('الخطوة التالية');
	});

	it('a non-final state keeps asking and never offers to pay again; PAID stops, shows the credited amount and tells the wallet to reload', () => {
		vi.useFakeTimers();
		let n = 0;
		const { f, c, svc, el } = setup({ arbParam: 'ref-1', status: () => of({ success: true, data: ++n < 3 ? view('VERIFYING') : view('PAID', { creditedUsd: 100 }) }) });
		const paid = vi.fn(); c.paid.subscribe(paid);
		vi.advanceTimersByTime(4000); vi.advanceTimersByTime(4000); f.detectChanges();
		expect(svc.status).toHaveBeenCalledTimes(3);
		expect(paid).toHaveBeenCalledTimes(1);
		expect(el.querySelector('[data-testid="arb-credited"]')?.textContent).toContain('100.00');
		vi.advanceTimersByTime(60_000); expect(svc.status).toHaveBeenCalledTimes(3); // stopped
		expect(el.textContent).not.toContain('أعد الدفع');
	});

	it('a failed CHECK (network) is not a failed payment: last state kept, calm notice, keeps trying', () => {
		vi.useFakeTimers();
		let n = 0;
		const { f, svc, el } = setup({ arbParam: 'ref-1', status: () => (++n === 1 ? of({ success: true, data: view('VERIFYING') }) : n === 2 ? throwError(() => ({ status: 0 })) : of({ success: true, data: view('DECLINED') })) });
		vi.advanceTimersByTime(4000); f.detectChanges();
		expect(el.querySelector('[data-testid="arb-banner"]')?.getAttribute('data-state')).toBe('VERIFYING');
		expect(el.querySelector('[data-testid="arb-poll-error"]')?.textContent).toContain('لا يعني ذلك أن الدفع فشل');
		vi.advanceTimersByTime(4000); f.detectChanges();
		expect(svc.status).toHaveBeenCalledTimes(3);
		expect(el.querySelector('[data-testid="arb-banner"]')?.getAttribute('data-state')).toBe('DECLINED');
		expect(el.querySelector('[data-testid="arb-poll-error"]')).toBeNull();
	});

	it('?arb=unknown explains without a result and without inviting a second payment', () => {
		const { el } = setup({ arbParam: 'unknown' });
		const t = el.querySelector('[data-testid="arb-banner"]')?.textContent || '';
		expect(t).toContain('لا تُعد الدفع قبل أن نؤكد');
	});

	it('refresh without the address: the open attempt is picked up', () => {
		const { el } = setup({ arbParam: null, open: () => of({ success: true, data: view('WAITING_PAGE', { redirectUrl: 'https://bank.example/p?PaymentID=1' }) }) });
		expect(el.querySelector('[data-testid="arb-banner"]')?.getAttribute('data-state')).toBe('WAITING_PAGE');
		expect(el.querySelector('[data-testid="arb-resume"]')?.getAttribute('href')).toBe('https://bank.example/p?PaymentID=1');
	});

	it('«I left the bank page»: asks the server to close the attempt softly, then shows the cancelled state; a failure keeps the page and says nothing changed', () => {
		const { f, svc, el, c } = setup({ arbParam: 'ref-1', status: () => of({ success: true, data: view('WAITING_PAGE', { redirectUrl: 'https://bank.example/p?PaymentID=1' }) }) });
		(el.querySelector('[data-testid="arb-abandon"]') as HTMLButtonElement).click(); f.detectChanges();
		expect(svc.abandon).toHaveBeenCalledWith('ref-1');
		expect(el.querySelector('[data-testid="arb-banner"]')?.getAttribute('data-state')).toBe('CANCELLED');
		svc.abandon.mockReturnValueOnce(throwError(() => ({ status: 0 })));
		c.view.set(view('WAITING_PAGE', { redirectUrl: 'https://bank.example/p' })); f.detectChanges();
		(el.querySelector('[data-testid="arb-abandon"]') as HTMLButtonElement).click(); f.detectChanges();
		expect(el.querySelector('[data-testid="arb-abandon-error"]')?.textContent).toContain('لم يتغير شيء');
	});

	it('a LOCALLY cancelled attempt the bank has not finalized keeps being checked and carries the server warning; a bank-final one stops', () => {
		vi.useFakeTimers();
		let n = 0;
		const { svc, el, f } = setup({ arbParam: 'ref-1', status: () => of({ success: true, data: ++n < 3 ? view('CANCELLED', { message: 'أغلقنا المحاولة من جهتنا، لكن البنك لم يؤكد بعد', bankFinal: false }) : view('DECLINED', { bankFinal: true }) }) });
		expect(el.querySelector('[data-testid="arb-message"]')?.textContent).toContain('لم يؤكد بعد');
		vi.advanceTimersByTime(4000); vi.advanceTimersByTime(4000); f.detectChanges();
		expect(svc.status).toHaveBeenCalledTimes(3);
		vi.advanceTimersByTime(60_000); expect(svc.status).toHaveBeenCalledTimes(3);
	});
});
