/**
 * Batch 5 — single canonical source for how a provider's real level (the
 * `level` string ServiceCatalog responses carry — see
 * marketplace-service.service.ts#resolveProviderCardFields, itself derived
 * from ProviderGamification.currentLevelIndex via resolveProviderProgression,
 * never a display-only formula) is styled as a badge.
 *
 * Only 3 of the real backend's 15 PROVIDER_LEVEL_MATRIX titles get a
 * distinct highlight color by design (see the original marketplace/slug
 * implementations this was extracted from) — every other real level
 * (مبتدئ/منجز/منفذ/بارع/متقن/متمكن/رصين/...) intentionally falls back to a
 * neutral default badge rather than each getting its own invented color.
 * This was a deliberate design decision in the already-correct
 * marketplace/service-detail pages, not something to "complete" here.
 */
export const PROVIDER_LEVEL_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
	'خبير': { bg: 'rgba(123,47,190,.85)', color: '#E0C6FF' },
	'محترف': { bg: 'rgba(43,127,255,.85)', color: '#C6E0FF' },
	'أخصائي': { bg: 'rgba(43,212,199,.75)', color: '#070D24' },
};

export const DEFAULT_LEVEL_BADGE_BG = 'rgba(43,212,199,.6)';
export const DEFAULT_LEVEL_BADGE_COLOR = '#2BD4C7';

/**
 * Resolves the badge {bg, color} for a real level string. `fallbackBg`/
 * `fallbackColor` let a caller pass through a per-model backend-provided
 * default (e.g. model.levelBg/model.levelColor) for a level outside the 3
 * highlighted ones — never used to invent a *label*, only a neutral color
 * for a real level that doesn't have its own highlight treatment.
 */
export function resolveProviderLevelBadgeStyle(
	level: string | null | undefined,
	fallbackBg?: string | null,
	fallbackColor?: string | null,
): { bg: string; color: string } {
	const known = level ? PROVIDER_LEVEL_BADGE_STYLES[level] : undefined;
	if (known) return known;
	return { bg: fallbackBg || DEFAULT_LEVEL_BADGE_BG, color: fallbackColor || DEFAULT_LEVEL_BADGE_COLOR };
}
