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
