/**
 * Level colours and the provider level names the UI needs for badges, from the brand identity formula: 5 "stations" of 3 consecutive levels per
 * role, hsl(hue, saturation, lightness). The numbers (names, percentages, thresholds) are served by the backend (config/levels.config.ts, GET /levels,
 * the level pages' roadmap); ONLY the colour formula and the 15 provider names (to read a level out of a title string) live here, and
 * core/levels/level-colors.spec.ts pins them to the backend's table so a drift fails in CI.
 */
export type LevelRole = 'PROVIDER' | 'CLIENT' | 'MARKETER';

export const LEVEL_STATION_HUES: Readonly<Record<LevelRole, readonly number[]>> = {
	PROVIDER: [196, 206, 216, 226, 236],
	CLIENT: [150, 162, 172, 182, 192],
	MARKETER: [16, 28, 38, 46, 54],
};
export const LEVEL_SATURATION: Readonly<Record<LevelRole, number>> = { PROVIDER: 90, CLIENT: 85, MARKETER: 92 };
export const LEVEL_LIGHTNESS = { dark: [78, 64, 52, 42, 34], light: [56, 48, 40, 34, 29] } as const;

export const PROVIDER_LEVEL_NAMES: readonly string[] = ['مبتدئ', 'منجز', 'منفذ', 'بارع', 'متقن', 'متمكن', 'أخصائي', 'محترف', 'خبير', 'رصين', 'مستشار', 'رائد', 'مراجع', 'مبتكر', 'مرجع'];

export const clampLevel = (level: number): number => (Number.isInteger(level) ? Math.min(15, Math.max(1, level)) : 1);
export const levelStation = (level: number): number => Math.min(5, Math.max(1, Math.ceil(clampLevel(level) / 3)));

function hslToHex(h: number, s: number, l: number): string {
	const sat = s / 100, lig = l / 100;
	const a = sat * Math.min(lig, 1 - lig);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const c = lig - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
		return Math.round(255 * c).toString(16).padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

export function levelColor(role: LevelRole, level: number, theme: 'dark' | 'light' = 'dark'): string {
	const station = levelStation(level);
	return hslToHex(LEVEL_STATION_HUES[role][station - 1], LEVEL_SATURATION[role], LEVEL_LIGHTNESS[theme][station - 1]);
}

/** Level (1..15) of a provider title such as "خبير", or null when the title is not one of the 15 names. */
export const providerLevelOfTitle = (title: string | null | undefined): number | null => {
	const i = title ? PROVIDER_LEVEL_NAMES.indexOf(title.trim()) : -1;
	return i >= 0 ? i + 1 : null;
};
