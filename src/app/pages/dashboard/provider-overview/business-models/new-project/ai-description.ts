import type { AiTextCandidate } from '../../../../../core/services/new-project.service';

/**
 * The project description limit, in UTF-16 code units (`String.length`): the same unit as the textarea `maxlength`, the on-screen counter
 * and the backend candidate guard (waseetai-backend utils/ai-description-candidates.ts, AI_DESCRIPTION_MAX_CHARS). Keep the two in sync.
 */
export const PROJECT_DESC_MAX = 1500;

export interface AiSuggestion {
	id: string;
	text: string;
	length: number;
	/** True when the backend cut a longer text at a complete sentence boundary. */
	trimmed: boolean;
	/** Style label («مباشر وواضح»…): the card title only, never part of `text`. */
	label?: string;
}

/** Defensive twin of the backend's extractStyleLabel: a short unpunctuated first line + blank line is a label, not description text. */
export function splitStyleLabel(text: string): { label?: string; body: string } {
	const m = /^([^\n]+)\n\s*\n([\s\S]+)$/.exec(text.trim());
	if (m) {
		const t = m[1].replace(/^#{1,6}\s*/, '').replace(/\*\*|__/g, '').replace(/[:：]\s*$/, '').trim();
		if (t && t.length <= 40 && t.split(/\s+/).length <= 5 && !/[.!?؟۔…。]$/.test(t) && !/^[•\-*\d]/.test(t)) return { label: t, body: m[2].trim() };
	}
	return { body: text.trim() };
}

/** Plain text for the field: presentation markdown never reaches it. */
export function plainAiText(text: string): string {
	return String(text ?? '').replace(/\r\n?/g, '\n')
		.replace(/\*\*/g, '').replace(/^\s*#{1,6}\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ')
		.replace(/\n{3,}/g, '\n\n').trim();
}

export interface AiSuggestionCheck { suggestions: AiSuggestion[]; rejectedTooLong: number }

/**
 * Client-side gate in front of «استخدام هذا الاقتراح»: only non-empty candidates within the limit are ever offered.
 * Never cuts anything (cutting at a sentence boundary is the server's job); an over-limit candidate is dropped, not shortened.
 */
export function checkAiSuggestions(candidates: AiTextCandidate[] | undefined, rawFallback: string, max = PROJECT_DESC_MAX): AiSuggestionCheck {
	// Older backend (no `candidates`): the whole streamed text is ONE candidate, never split client-side.
	const source: AiTextCandidate[] = Array.isArray(candidates) ? candidates : [{ id: 'option-1', text: rawFallback }];
	const seen = new Set<string>();
	const suggestions: AiSuggestion[] = [];
	let rejectedTooLong = 0;
	for (const c of source) {
		if (!c || typeof c.text !== 'string') continue;
		const split = Array.isArray(candidates) ? splitStyleLabel(plainAiText(c.text)) : { body: plainAiText(c.text) };
		const text = split.body;
		const label = (typeof c.label === 'string' && c.label.trim()) ? c.label.trim() : split.label;
		if (!text || seen.has(text)) continue;
		seen.add(text);
		if (text.length > max) { rejectedTooLong++; continue; }
		suggestions.push({ id: typeof c.id === 'string' && c.id ? c.id : `option-${suggestions.length + 1}`, text, length: text.length, trimmed: c.trimmed === true, ...(label ? { label } : {}) });
	}
	return { suggestions, rejectedTooLong };
}

export const AI_OUTPUT_TOO_LONG_MESSAGE = `تجاوز الاقتراح الحد المسموح (${PROJECT_DESC_MAX} حرفاً) ولم نجد صياغة مكتملة ضمن الحد. لم يُعتمد أي نص، حاول مرة أخرى.`;
export const AI_EMPTY_OUTPUT_MESSAGE = 'لم تُرجع خدمة الذكاء الاصطناعي وصفاً صالحاً. حاول مرة أخرى.';
export const AI_WATCHDOG_MESSAGE = 'توقف البث دون اكتمال الاقتراح. لم يتغير وصفك، يمكنك إعادة المحاولة.';
export const AI_WATCHDOG_MS = 60_000;
