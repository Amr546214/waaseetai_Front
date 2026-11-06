import { memberSince } from './member-since';

describe('memberSince', () => {
	it('shows a readable Arabic date, never the ISO text', () => {
		const out = memberSince('2026-11-06T14:41:53.055Z');
		expect(out).toContain('نوفمبر'); expect(out).toContain('٢٠٢٦'); expect(out).not.toMatch(/T\d\d:\d\d|Z$|\d{4}-\d\d-\d\d/);
	});
	it('empty or invalid input gives an empty string, not «Invalid Date»', () => {
		for (const v of [null, undefined, '', 'not-a-date']) expect(memberSince(v)).toBe('');
	});
});
