import { formatMoney, roundMoney } from './money.util';

describe('money util', () => {
	it('rounds float artifacts to 2 decimals', () => {
		expect(roundMoney(8.729999999999999)).toBe(8.73);
		expect(roundMoney(61.06999999999999)).toBe(61.07);
		expect(formatMoney(8.729999999999999)).toBe('8.73');
		expect(formatMoney(61.06999999999999)).toBe('61.07');
		expect(formatMoney(1234.5)).toBe('1,234.5');
		expect(formatMoney(1234.5, 2)).toBe('1,234.50');
		expect(formatMoney(1.005)).toBe('1.01');
		expect(formatMoney(null)).toBe('0');
		expect(formatMoney(-8.729999999999999)).toBe('-8.73');
	});
});
