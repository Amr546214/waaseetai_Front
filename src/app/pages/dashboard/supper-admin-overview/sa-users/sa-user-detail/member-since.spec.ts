import { arabicDate, memberSince } from './member-since';

describe('memberSince', () => {
	it('arabicDate: date only or with time, both readable; the header line adds «منذ»', () => {
		expect(arabicDate('2026-11-06T14:41:53.055Z')).toContain('نوفمبر');
		expect(arabicDate('2026-11-06T14:41:53.055Z', true)).toMatch(/[٠-٩]+:[٠-٩]{2}/);
		expect(memberSince('2026-11-06T14:41:53.055Z')).toMatch(/^منذ /); expect(arabicDate('nope', true)).toBe('');
	});
	it('shows a readable Arabic date, never the ISO text', () => {
		const out = memberSince('2026-11-06T14:41:53.055Z');
		expect(out).toContain('نوفمبر'); expect(out).toContain('٢٠٢٦'); expect(out).not.toMatch(/T\d\d:\d\d|Z$|\d{4}-\d\d-\d\d/);
	});
	it('empty or invalid input gives an empty string, not «Invalid Date»', () => {
		for (const v of [null, undefined, '', 'not-a-date']) expect(memberSince(v)).toBe('');
	});
});
