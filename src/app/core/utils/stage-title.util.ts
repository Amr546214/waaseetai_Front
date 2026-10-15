/**
 * A stage title is stored by the provider and very often ALREADY starts with its own number ("المرحلة 1: تصميم الواجهات").
 * Showing «المرحلة {{ number }}: {{ title }}» then duplicates it («المرحلة 1: المرحلة 1: ...»). These helpers strip the leading
 * "المرحلة N" (digits, Arabic-Indic digits or the ordinal words) and rebuild ONE heading, whatever the stored title looks like.
 */
const ORDINALS = 'الأولى|الاولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة';
const PREFIX = new RegExp(`^\\s*(?:تسليم\\s+)?المرحلة\\s+(?:[0-9٠-٩]+|${ORDINALS})\\s*(?:[:：\\-–—،.]\\s*|\\s+)?`);

/** The title without its leading «المرحلة N» (and an optional «تسليم»). Empty when the title was only the prefix. */
export function stripStagePrefix(title: string | null | undefined): string {
	return String(title ?? '').replace(PREFIX, '').trim();
}

/** «المرحلة 1: التصميم» (or just «المرحلة 1» when the title is empty / only the prefix). */
export function stageHeading(stageNumber: number | string | null | undefined, title: string | null | undefined): string {
	const rest = stripStagePrefix(title);
	const label = stageNumber !== null && stageNumber !== undefined && String(stageNumber) !== '' ? `المرحلة ${stageNumber}` : '';
	if (!label) return rest || String(title ?? '').trim();
	return rest ? `${label}: ${rest}` : label;
}

/** «تسليم المرحلة 1: التصميم» */
export function deliveryHeading(stageNumber: number | string | null | undefined, title: string | null | undefined): string {
	return `تسليم ${stageHeading(stageNumber, title)}`;
}
