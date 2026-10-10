import { levelColor, levelStation, providerLevelOfTitle } from '../levels/level-colors';

/**
 * The single canonical way a provider's real level (the `level` title string ServiceCatalog responses carry, derived from
 * ProviderGamification.currentLevelIndex) is styled as a badge: every one of the 15 levels takes its brand station colour (5 stations of 3 levels,
 * see core/levels/level-colors.ts). Only a title that is NOT one of the 15 names (or no title) gets the neutral default.
 */
export const DEFAULT_LEVEL_BADGE_BG = 'rgba(43,212,199,.6)';
export const DEFAULT_LEVEL_BADGE_COLOR = '#2BD4C7';

/** Dark text on the light stations (1-3), white on the deep ones (4-5): readable on either fill. */
const textOn = (station: number): string => (station <= 3 ? '#070D24' : '#FFFFFF');

export function resolveProviderLevelBadgeStyle(
	level: string | null | undefined,
	fallbackBg?: string | null,
	fallbackColor?: string | null,
): { bg: string; color: string } {
	const index = providerLevelOfTitle(level);
	if (index !== null) return { bg: levelColor('PROVIDER', index, 'dark'), color: textOn(levelStation(index)) };
	return { bg: fallbackBg || DEFAULT_LEVEL_BADGE_BG, color: fallbackColor || DEFAULT_LEVEL_BADGE_COLOR };
}
