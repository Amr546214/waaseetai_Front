/**
 * The ONE shared money formatter. Amounts are rounded to at most 2 decimals at display time, so a
 * float artifact such as 8.729999999999999 is shown as 8.73 and 61.06999999999999 as 61.07.
 * Templates use `| number:'1.0-2'` (same rule); TypeScript code uses these helpers.
 */
export function roundMoney(value: unknown): number {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	const rounded = Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
	return n < 0 && rounded !== 0 ? -rounded : rounded;
}

/** "1,234.5" / "8.73": at most 2 decimals, thousands separators, never a float artifact. */
export function formatMoney(value: unknown, minFractionDigits = 0): string {
	return new Intl.NumberFormat('en-US', { minimumFractionDigits: minFractionDigits, maximumFractionDigits: 2 }).format(roundMoney(value));
}
