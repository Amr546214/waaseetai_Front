import { describe, it, expect } from 'vitest';
import { resolveProviderLevelBadgeStyle, DEFAULT_LEVEL_BADGE_BG, DEFAULT_LEVEL_BADGE_COLOR } from './provider-level-style.util';
import { PROVIDER_LEVEL_NAMES, levelColor } from '../levels/level-colors';

// Every one of the 15 provider levels has its own station colour now (previously only 3 titles were highlighted).
describe('resolveProviderLevelBadgeStyle', () => {
	it('every real level gets its brand station colour and a readable text colour', () => {
		PROVIDER_LEVEL_NAMES.forEach((name, i) => {
			const s = resolveProviderLevelBadgeStyle(name);
			expect(s.bg).toBe(levelColor('PROVIDER', i + 1, 'dark'));
			expect(s.color).toBe(i + 1 <= 9 ? '#070D24' : '#FFFFFF');
		});
	});

	it('levels of the same station share a colour; neighbouring stations differ', () => {
		expect(resolveProviderLevelBadgeStyle('مبتدئ').bg).toBe(resolveProviderLevelBadgeStyle('منفذ').bg);
		expect(resolveProviderLevelBadgeStyle('منفذ').bg).not.toBe(resolveProviderLevelBadgeStyle('بارع').bg);
		expect(resolveProviderLevelBadgeStyle('مبتدئ').bg).toBe('#94DEF9');
		expect(resolveProviderLevelBadgeStyle('مرجع').bg).toBe('#0913A5');
	});

	it('does not fabricate a level for null/undefined/empty/unknown — uses the neutral default', () => {
		for (const v of [null, undefined, '', 'مستوى-غير-معروف-123']) expect(resolveProviderLevelBadgeStyle(v)).toEqual({ bg: DEFAULT_LEVEL_BADGE_BG, color: DEFAULT_LEVEL_BADGE_COLOR });
	});

	it('a passed-in fallback is used only for a title that is not one of the 15 names', () => {
		expect(resolveProviderLevelBadgeStyle('غير-معروف', 'rgba(1,2,3,.5)', '#ABCDEF')).toEqual({ bg: 'rgba(1,2,3,.5)', color: '#ABCDEF' });
		expect(resolveProviderLevelBadgeStyle('خبير', 'rgba(9,9,9,.9)', '#000000').bg).toBe(levelColor('PROVIDER', 9, 'dark'));
	});
});
