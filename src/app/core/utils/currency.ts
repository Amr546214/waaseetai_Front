import { platformRegional } from './regional';

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

/** the currency every payout (PayPal withdrawal) is made in: the only payout rail is USD, whatever the platform base currency is */
export const PAYOUT_CURRENCY: Currency = 'USD';
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

/** The platform BASE currency (public setting `baseCurrency`): the currency of NEW records (forms) and of headline figures. A record that already exists shows ITS OWN currency, never this. */
export const platformCurrency = (): Currency => platformRegional().currency;
/** the currency code ("USD" / "SAR") of a record, or of the platform when none is given */
export const currencyCode = (c?: unknown): Currency => (c === undefined || c === null ? platformCurrency() : currencyOf(c));
/** the currency name for labels and hints ("دولار أمريكي" / "ريال سعودي") of a record's currency, or of the platform when none is given */
export const currencyLabel = (c?: unknown): string => NAMES[currencyCode(c)];

/**
 * An amount with its currency CODE: "1,234.5 USD", "300.00 SAR". `digits` is Angular's number-pipe format so a screen keeps its own decimals. The currency is the RECORD's; a missing one on an
 * existing record reads as USD (legacy), never as the platform setting. Use formatBase for a NEW entry (a form) where no record exists yet.
 */
export function formatAmount(value: number | null | undefined, currency: unknown, digits = '1.0-2'): string {
	if (value == null || !Number.isFinite(value)) return '—';
	const c = currencyOf(currency); const [, frac = '0-2'] = digits.split('.'); const [min, max] = frac.split('-').map(Number);
	const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: Number.isFinite(max) ? max : min }).format(value);
	return `${n} ${c}`;
}
/** an amount in the platform base currency (new entries, platform-wide settings) */
export const formatBase = (value: number | null | undefined, digits = '1.0-2'): string => formatAmount(value, platformCurrency(), digits);
/** the currencies of a per-currency map other than `headline` that hold an amount (what a screen adds under its headline figure) */
export function otherCurrencyAmounts(map: Record<string, number> | null | undefined, headline: unknown = platformCurrency()): Array<{ currency: string; value: number }> {
	return Object.entries(map ?? {}).filter(([c, v]) => c !== headline && v !== 0).map(([currency, value]) => ({ currency, value }));
}
