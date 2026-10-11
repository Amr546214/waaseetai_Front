import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { DepositModal } from './deposit-modal';
import { LevelsService } from '../../core/levels/levels.service';
import { PaypalDepositService } from '../../core/services/paypal-deposit.service';
import { AuthStore } from '../../core/store/auth.store';

// Wallet deposit: the user sees the NET added, the PayPal fee (percent from the backend table) and the total they will pay, BEFORE confirming.
describe('client deposit modal: PayPal fee breakdown', () => {
	const mount = (percent: number | null) => {
		const payload = percent === null ? null : { payments: { clientDeposit: { paypal: percent }, marketerWithdrawal: {} } };
		TestBed.configureTestingModule({
			imports: [DepositModal],
			providers: [
				{ provide: LevelsService, useValue: { payload: signal(payload), ensureLoaded: () => undefined } },
				{ provide: PaypalDepositService, useValue: {} },
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }) } },
			],
		});
		const f = TestBed.createComponent(DepositModal);
		f.detectChanges();
		return { f, el: f.nativeElement as HTMLElement };
	};
	const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	afterEach(() => TestBed.resetTestingModule());

	it('net 100 shows: net 100.00, PayPal fee (7%) 7.53, total 107.53', () => {
		const { f, el } = mount(7);
		f.componentInstance.amount.set(100); f.detectChanges();
		expect(q(el, 'deposit-net')!.textContent).toContain('100.00');
		expect(q(el, 'deposit-fee')!.textContent).toContain('7.53');
		expect(q(el, 'deposit-gross')!.textContent).toContain('107.53');
		expect(q(el, 'deposit-breakdown')!.textContent).toContain('رسوم PayPal (7%)');
	});

	it('the balance after the deposit grows by the NET only (never by what PayPal charges)', () => {
		const { f } = mount(7);
		f.componentRef.setInput('currentBalance', 500);
		f.componentInstance.amount.set(100); f.detectChanges();
		expect(f.componentInstance.balanceAfter).toBe(600);
	});

	it('without the backend table nothing is shown: no typed fee', () => {
		const { f, el } = mount(null);
		f.componentInstance.amount.set(100); f.detectChanges();
		expect(q(el, 'deposit-breakdown')).toBeNull();
		expect(el.textContent).not.toContain('7.53');
	});

	it('only PayPal is offered (no mada / visa / international transfer in the UI)', () => {
		const { el } = mount(7);
		for (const x of ['مدى', 'فيزا', 'ماستر', 'تحويل دولي']) expect(el.textContent).not.toContain(x);
		expect(el.textContent).toContain('PayPal');
	});
});
