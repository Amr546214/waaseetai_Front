// ONE level display model for every role and every page: name, colour pair, icon, percentage and its label. Nothing here is typed per page: the colours come
// from the brand formula (core/levels/level-colors.ts, pinned to the backend), the numbers from the backend `levelInfo` payload (utils/level-info.ts), and the
// provider titles that older endpoints still return as plain strings are read back to their level.
import { levelColor, providerLevelOfTitle, PROVIDER_LEVEL_NAMES, type LevelRole } from './level-colors';

export type LevelPercentKind = 'PLATFORM_COMMISSION' | 'EARNED_COMMISSION' | 'CASHBACK';

/** The backend payload (waseetai-backend/src/utils/level-info.ts) as the dashboards, the public profile and the level pages receive it. */
export interface LevelInfoDto {
	role: LevelRole;
	index: number;
	total?: number;
	name: string;
	percent?: number;
	percentKind?: LevelPercentKind;
	station?: number;
	color?: { dark: string; light: string };
}

export interface LevelDisplay {
	role: LevelRole;
	index: number | null;
	total: number;
	name: string;
	percent: number | null;
	percentKind: LevelPercentKind | null;
	color: { dark: string; light: string };
}

export const PERCENT_LABEL: Readonly<Record<LevelPercentKind, string>> = {
	PLATFORM_COMMISSION: 'عمولة المنصة',
	EARNED_COMMISSION: 'نسبة العمولة',
	CASHBACK: 'نسبة الكاش باك',
};

/** The ONE five-point star every level badge draws (viewBox 0 0 100 100). */
export const LEVEL_STAR_PATH = 'M50 5 L61.8 36.7 L95.1 36.7 L68.6 57.1 L79.4 88.8 L50 70.3 L20.6 88.8 L31.4 57.1 L4.9 36.7 L38.2 36.7 Z';

/** Neutral colour pair for a title that is not on any ladder (a legacy label): nothing is claimed about its level. */
export const UNKNOWN_LEVEL_COLOR = { dark: '#9AA6C7', light: '#5B6788' } as const;

export function levelDisplayFromInfo(info: LevelInfoDto | null | undefined): LevelDisplay | null {
	if (!info || !info.name) return null;
	const index = Number.isInteger(info.index) && info.index >= 1 ? info.index : null;
	return {
		role: info.role,
		index,
		total: info.total ?? 15,
		name: info.name,
		percent: typeof info.percent === 'number' ? info.percent : null,
		percentKind: info.percentKind ?? null,
		color: info.color ?? (index ? { dark: levelColor(info.role, index, 'dark'), light: levelColor(info.role, index, 'light') } : { ...UNKNOWN_LEVEL_COLOR }),
	};
}

/** A provider title string ("مبتدئ", "خبير"...) as a display; a title outside the 15 names keeps its text with the neutral colour. */
export function providerLevelDisplayFromTitle(title: string | null | undefined, fallbackName = ''): LevelDisplay | null {
	const text = (title ?? '').trim();
	const index = providerLevelOfTitle(text);
	if (index === null) return text ? { role: 'PROVIDER', index: null, total: 15, name: text, percent: null, percentKind: null, color: { ...UNKNOWN_LEVEL_COLOR } } : (fallbackName ? { role: 'PROVIDER', index: null, total: 15, name: fallbackName, percent: null, percentKind: null, color: { ...UNKNOWN_LEVEL_COLOR } } : null);
	return { role: 'PROVIDER', index, total: 15, name: PROVIDER_LEVEL_NAMES[index - 1], percent: null, percentKind: null, color: { dark: levelColor('PROVIDER', index, 'dark'), light: levelColor('PROVIDER', index, 'light') } };
}

/** Best display from whatever a page has: the backend payload first, then a provider title. */
export function resolveLevelDisplay(src: { info?: LevelInfoDto | null; providerTitle?: string | null }): LevelDisplay | null {
	return levelDisplayFromInfo(src.info) ?? providerLevelDisplayFromTitle(src.providerTitle);
}
