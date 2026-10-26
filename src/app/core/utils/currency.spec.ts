import { formatMoneyIn, formatByCurrency, currencyOf, currencyName, isSupportedCurrency } from './currency';
import { MoneyPipe } from '../../shared/money/money.pipe';

describe('currency formatter', () => {
	it('prints the amount with the record\'s own currency code, 2 digits, Latin digits - never a symbol', () => {
		expect(formatMoneyIn(1234.5, 'USD')).toBe('1,234.50 USD'); expect(formatMoneyIn(1234.5, 'SAR')).toBe('1,234.50 SAR'); expect(formatMoneyIn(1234.5, 'USD')).not.toContain('$');
	});
	it('a missing or unknown currency reads as the legacy currency (never guessed from a setting); an invalid amount is a dash', () => {
		expect(currencyOf(undefined)).toBe('USD'); expect(currencyOf('EUR')).toBe('USD'); expect(isSupportedCurrency('SAR')).toBe(true); expect(isSupportedCurrency('EUR')).toBe(false);
		expect(formatMoneyIn(NaN, 'USD')).toBe('—'); expect(formatMoneyIn(null, 'SAR')).toBe('—');
	});
	it('amounts of different currencies are listed side by side, never added', () => {
		expect(formatByCurrency({ USD: 1200, SAR: 300 })).toBe('1,200.00 USD · 300.00 SAR'); expect(formatByCurrency({})).toBe('—'); expect(formatByCurrency({ USD: 0 })).toBe('—');
		expect(currencyName('SAR')).toBe('ريال سعودي');
	});
	it('the money pipe is the same formatter', () => { const p = new MoneyPipe(); expect(p.transform(5, 'SAR')).toBe('5.00 SAR'); expect(p.transform(5)).toBe('5.00 USD'); });
});

import { formatAmount, otherCurrencyAmounts } from './currency';
import { WsAmountPipe } from '../../shared/money/money.pipe';
describe('currency - screen style', () => {
	it('USD keeps the "$" suffix and the screen\'s own decimals; every other currency prints its code', () => {
		expect(formatAmount(1234.5, 'USD')).toBe('1,234.5 $'); expect(formatAmount(8000, 'USD', '1.2-2')).toBe('8,000.00 $'); expect(formatAmount(300, 'SAR', '1.2-2')).toBe('300.00 SAR'); expect(formatAmount(undefined, 'USD')).toBe('—');
		expect(new WsAmountPipe().transform(5, undefined)).toBe('5 $'); expect(new WsAmountPipe().transform(5, 'SAR', '1.2-2')).toBe('5.00 SAR');
	});
	it('only the non-USD amounts of a per-currency map are listed under a USD headline', () => {
		expect(otherCurrencyAmounts({ USD: 10, SAR: 5, X: 0 })).toEqual([{ currency: 'SAR', value: 5 }, { currency: 'X', value: 0 }].filter(r => r.value !== 0)); expect(otherCurrencyAmounts({ USD: 10 })).toEqual([]); expect(otherCurrencyAmounts(null)).toEqual([]);
	});
});
