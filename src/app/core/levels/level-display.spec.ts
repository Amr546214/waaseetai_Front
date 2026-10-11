import { describe, expect, it } from 'vitest';
import { levelColor } from './level-colors';
import { levelDisplayFromInfo, providerLevelDisplayFromTitle, resolveLevelDisplay, UNKNOWN_LEVEL_COLOR } from './level-display';

describe('level display (one source for every role)', () => {
	it('builds the display from the backend payload, colour pair included', () => {
		const d = levelDisplayFromInfo({ role: 'CLIENT', index: 1, total: 15, name: 'زائر', percent: 1, percentKind: 'CASHBACK' })!;
		expect(d.name).toBe('زائر');
		expect(d.color).toEqual({ dark: levelColor('CLIENT', 1, 'dark'), light: levelColor('CLIENT', 1, 'light') });
		expect(d.percentKind).toBe('CASHBACK');
	});

	it('a provider title is read back to its level and takes the same colours as the payload would', () => {
		const fromTitle = providerLevelDisplayFromTitle('مبتدئ')!;
		const fromInfo = levelDisplayFromInfo({ role: 'PROVIDER', index: 1, name: 'مبتدئ' })!;
		expect(fromTitle.index).toBe(1);
		expect(fromTitle.color).toEqual(fromInfo.color);
		expect(fromTitle.name).toBe(fromInfo.name);
	});

	it('an unknown title keeps its text with the neutral colour (no level is claimed)', () => {
		const d = providerLevelDisplayFromTitle('لقب قديم')!;
		expect(d.index).toBeNull();
		expect(d.color).toEqual(UNKNOWN_LEVEL_COLOR);
	});

	it('nothing in, nothing claimed', () => {
		expect(levelDisplayFromInfo(null)).toBeNull();
		expect(providerLevelDisplayFromTitle('')).toBeNull();
		expect(resolveLevelDisplay({})).toBeNull();
	});

	it('the payload wins over the title', () => {
		const d = resolveLevelDisplay({ info: { role: 'PROVIDER', index: 4, name: 'بارع' }, providerTitle: 'مبتدئ' })!;
		expect(d.name).toBe('بارع');
	});
});
