import { describe, it, expect } from 'vitest';
import { levelColor, levelStation, PROVIDER_LEVEL_NAMES, providerLevelOfTitle, clampLevel } from './level-colors';

// These literals are the SAME ones the backend pins in config/levels.config.test.ts: if either side drifts, one of the two CI runs fails.
describe('level colours (brand formula) and provider names', () => {
	it('the 15 provider names, in order (= backend PROVIDER_LEVELS)', () => {
		expect(PROVIDER_LEVEL_NAMES).toEqual(['مبتدئ', 'منجز', 'منفذ', 'بارع', 'متقن', 'متمكن', 'أخصائي', 'محترف', 'خبير', 'رصين', 'مستشار', 'رائد', 'مراجع', 'مبتكر', 'مرجع']);
	});
	it('5 stations of 3 levels', () => {
		for (const [lvl, st] of [[1, 1], [3, 1], [4, 2], [6, 2], [7, 3], [9, 3], [10, 4], [12, 4], [13, 5], [15, 5]] as const) expect(levelStation(lvl)).toBe(st);
	});
	it('hex values equal the backend ones (provider / client / marketer, dark and light)', () => {
		expect(levelColor('PROVIDER', 1, 'dark')).toBe('#94DEF9');
		expect(levelColor('PROVIDER', 15, 'dark')).toBe('#0913A5');
		expect(levelColor('PROVIDER', 15, 'light')).toBe('#07108D');
		expect(levelColor('CLIENT', 1, 'dark')).toBe('#97F7C7');
		expect(levelColor('CLIENT', 15, 'light')).toBe('#0B7089');
		expect(levelColor('MARKETER', 1, 'dark')).toBe('#FBAF93');
		expect(levelColor('MARKETER', 8, 'dark')).toBe('#F5A314');
		expect(levelColor('PROVIDER', 4, 'dark')).toBe(levelColor('PROVIDER', 6, 'dark'));
		expect(levelColor('PROVIDER', 4, 'dark')).not.toBe(levelColor('CLIENT', 4, 'dark'));
	});
	it('reads a level out of a title and never invents one', () => {
		expect(providerLevelOfTitle('خبير')).toBe(9);
		expect(providerLevelOfTitle(' مرجع ')).toBe(15);
		expect(providerLevelOfTitle('زائر')).toBeNull(); // a CLIENT name is not a provider level
		expect(providerLevelOfTitle(null)).toBeNull();
		expect(clampLevel(99)).toBe(15);
		expect(clampLevel(0)).toBe(1);
	});
});
