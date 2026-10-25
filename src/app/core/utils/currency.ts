/**
 * The ONE place an amount becomes text with its currency. Every amount keeps its OWN currency (the record's, never the platform setting), nothing is summed across currencies, and no
 * currency symbol or name is typed anywhere else: the code is the only thing printed ("USD", "SAR"), so a screen can never imply a currency the record does not have.
 * Mirrors the server's formatMoney (be: utils/currency.ts). Supporting a currency here does not enable it anywhere.
 */
export const SUPPORTED_CURRENCIES = ['USD', 'SAR'] as const;
export type Currency = typeof SUPPORTED_CURRENCIES[number];
export const LEGACY_CURRENCY: Currency = 'USD';
const MINOR_UNITS: Record<Currency, number> = { USD: 2, SAR: 2 };
const NAMES: Record<Currency, string> = { USD: 'دولار أمريكي', SAR: 'ريال سعودي' };

export const isSupportedCurrency = (c: unknown): c is Currency => typeof c === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(c);
/** a record without a currency (older responses) is read as the legacy currency, never guessed from settings */
export const currencyOf = (c: unknown): Currency => (isSupportedCurrency(c) ? c : LEGACY_CURRENCY);
export const currencyName = (c: unknown): string => NAMES[currencyOf(c)];

/** "1,234.50 USD": the amount rounded to the currency's minor units, Latin digits, then the currency CODE of the record. */
export function formatMoneyIn(value: number | null | undefined, currency: unknown): string {
	if (value == null || !Number.isFinite(value)) return '—';
	const c = currencyOf(currency); const d = MINOR_UNITS[c];
	return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(value)} ${c}`;
}
/** one line per currency, e.g. "1,200.00 USD · 300.00 SAR" - the only honest way to show amounts of different currencies together */
export function formatByCurrency(map: Record<string, number> | null | undefined): string {
	const parts = Object.entries(map ?? {}).filter(([, v]) => v !== 0).map(([c, v]) => formatMoneyIn(v, c));
	return parts.length ? parts.join(' · ') : '—';
}
