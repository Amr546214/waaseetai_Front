import { describe, it, expect } from 'vitest';
import { paypalDepositBreakdown } from './deposit-fee';

// the same reference examples as the backend (fee-policy depositGrossUp / paypal-finance tests)
describe('PayPal deposit breakdown (7%): the user picks the net, PayPal is charged the gross', () => {
	it('net 100 -> fee 7.53, gross 107.53', () => {
		expect(paypalDepositBreakdown(100, 7)).toEqual({ net: 100, feePercent: 7, fee: 7.53, gross: 107.53 });
	});
	it('net 50 -> 53.76, 250 -> 268.82, 1000 -> 1075.27', () => {
		expect(paypalDepositBreakdown(50, 7)!.gross).toBe(53.76);
		expect(paypalDepositBreakdown(250, 7)!.gross).toBe(268.82);
		expect(paypalDepositBreakdown(1000, 7)!.gross).toBe(1075.27);
		expect(paypalDepositBreakdown(1000, 7)!.fee).toBe(75.27);
	});
	it('no percent from the backend table (not loaded / invalid) = no breakdown, never a typed fee', () => {
		for (const p of [null, undefined, -1, 100, 120]) expect(paypalDepositBreakdown(100, p as any)).toBeNull();
		for (const n of [0, -5, NaN]) expect(paypalDepositBreakdown(n, 7)).toBeNull();
	});
});
