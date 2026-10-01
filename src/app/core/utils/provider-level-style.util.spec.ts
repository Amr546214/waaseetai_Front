import { describe, it, expect } from 'vitest';
import {
	resolveProviderLevelBadgeStyle,
	PROVIDER_LEVEL_BADGE_STYLES,
	DEFAULT_LEVEL_BADGE_BG,
	DEFAULT_LEVEL_BADGE_COLOR,
} from './provider-level-style.util';

// Batch 5 — this is now the single canonical source of truth for provider
// level badge styling, shared by marketplace.ts, slug.ts, card.ts and
// curated.ts, replacing four previously-separate (and in curated's case,
// outright flat/incorrect) per-file color maps.
describe('resolveProviderLevelBadgeStyle', () => {
	it('returns the exact canonical style for each of the 3 highlighted real levels', () => {
		for (const level of Object.keys(PROVIDER_LEVEL_BADGE_STYLES)) {
			expect(resolveProviderLevelBadgeStyle(level)).toEqual(PROVIDER_LEVEL_BADGE_STYLES[level]);
		}
	});

	it('falls back to the neutral default for a real-but-unhighlighted level (e.g. مبتدئ)', () => {
		expect(resolveProviderLevelBadgeStyle('مبتدئ')).toEqual({ bg: DEFAULT_LEVEL_BADGE_BG, color: DEFAULT_LEVEL_BADGE_COLOR });
	});

	it('does not fabricate a known level for null/undefined/empty — uses the neutral default', () => {
		expect(resolveProviderLevelBadgeStyle(null)).toEqual({ bg: DEFAULT_LEVEL_BADGE_BG, color: DEFAULT_LEVEL_BADGE_COLOR });
		expect(resolveProviderLevelBadgeStyle(undefined)).toEqual({ bg: DEFAULT_LEVEL_BADGE_BG, color: DEFAULT_LEVEL_BADGE_COLOR });
		expect(resolveProviderLevelBadgeStyle('')).toEqual({ bg: DEFAULT_LEVEL_BADGE_BG, color: DEFAULT_LEVEL_BADGE_COLOR });
	});

	it('safely falls back for an unexpected/unknown level value instead of throwing or inventing a color', () => {
		expect(resolveProviderLevelBadgeStyle('مستوى-غير-معروف-123')).toEqual({ bg: DEFAULT_LEVEL_BADGE_BG, color: DEFAULT_LEVEL_BADGE_COLOR });
	});

	it('prefers a per-model backend-provided fallback color over the static default when the level is unhighlighted', () => {
		expect(resolveProviderLevelBadgeStyle('منجز', 'rgba(1,2,3,.5)', '#ABCDEF')).toEqual({ bg: 'rgba(1,2,3,.5)', color: '#ABCDEF' });
	});

	it('ignores any passed-in fallback for one of the 3 highlighted levels — the canonical color always wins', () => {
		expect(resolveProviderLevelBadgeStyle('خبير', 'rgba(9,9,9,.9)', '#000000')).toEqual(PROVIDER_LEVEL_BADGE_STYLES['خبير']);
	});
});
