/**
 * The PayPal deposit breakdown the user sees BEFORE paying (نسب الدفع.xlsx: PayPal 7%): the user picks the NET to add to the wallet, PayPal is
 * charged the gross = net / (1 − fee%), e.g. 100 -> 107.53 (fee 7.53). The percent comes from the backend table (GET /levels -> payments), never
 * typed here; with no percent there is no breakdown. The backend computes the same numbers when it creates the order (this only previews them).
 */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface DepositBreakdown { net: number; feePercent: number; fee: number; gross: number }

export function paypalDepositBreakdown(net: number, feePercent: number | null | undefined): DepositBreakdown | null {
	if (feePercent === null || feePercent === undefined || !Number.isFinite(net) || net <= 0 || feePercent < 0 || feePercent >= 100) return null;
	const gross = round2(net / (1 - feePercent / 100));
	return { net: round2(net), feePercent, fee: round2(gross - net), gross };
}
