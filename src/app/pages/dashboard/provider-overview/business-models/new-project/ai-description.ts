import type { AiTextCandidate } from '../../../../../core/services/new-project.service';
import { formatBase } from '../../../../../core/utils/currency';

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
	/** Concrete details the model added that are absent from the user's data (numbers / tech names): flagged by the backend, shown as a warning. */
	unmentioned?: string[];
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
		suggestions.push({ id: typeof c.id === 'string' && c.id ? c.id : `option-${suggestions.length + 1}`, text, length: text.length, trimmed: c.trimmed === true, ...(label ? { label } : {}), ...(Array.isArray(c.unmentioned) && c.unmentioned.length ? { unmentioned: c.unmentioned.filter(x => typeof x === 'string').slice(0, 8) } : {}) });
	}
	return { suggestions, rejectedTooLong };
}

export const AI_OUTPUT_TOO_LONG_MESSAGE = `تجاوز الاقتراح الحد المسموح (${PROJECT_DESC_MAX} حرفاً) ولم نجد صياغة مكتملة ضمن الحد. لم يُعتمد أي نص، حاول مرة أخرى.`;
export const AI_EMPTY_OUTPUT_MESSAGE = 'لم تُرجع خدمة الذكاء الاصطناعي وصفاً صالحاً. حاول مرة أخرى.';
export const AI_WATCHDOG_MESSAGE = 'توقف البث دون اكتمال الاقتراح. لم يتغير وصفك، يمكنك إعادة المحاولة.';
export const AI_WATCHDOG_MS = 60_000;

/** Marker the backend uses to find the facts block of a seeded request (keep in sync with ai-description-candidates.ts). */
export const SEED_FACTS_MARKER = 'البيانات المقدمة:';

export interface DescriptionSeedContext {
	title: string;
	specialty?: string;
	subSpecialty?: string;
	model?: string;
	skills?: string[];
	budgetUsd?: number | null;
	days?: number | null;
}

export const SEED_CLARIFICATION_MESSAGE = 'أضف عنوانًا أوضح للمشروع (كلمتان على الأقل) أو بعض التفاصيل مثل التخصص والمهارات ليتمكن الذكاء الاصطناعي من اقتراح وصف. لم يُرسل أي طلب.';
export const SEED_HONESTY_NOTE = 'مقترح مبني على العنوان وبيانات النموذج فقط — راجع التفاصيل قبل الاعتماد.';

const meaningfulWords = (t: string) => t.split(/\s+/).filter(w => w.replace(/[\p{P}\p{S}_]+/gu, '').length > 1).length;

/**
 * The text sent to the enhance service when the description field is EMPTY. It states only what the user actually provided and tells the model
 * not to invent anything. It goes to the service only: it is never written into the description field.
 * Returns null when the context is too thin (title under 2 meaningful words and nothing else): the page then asks for clarification and sends nothing.
 */
export function buildDescriptionSeed(ctx: DescriptionSeedContext, max = PROJECT_DESC_MAX): string | null {
	const title = (ctx.title ?? '').trim();
	const facts: string[] = [];
	if (title) facts.push(`عنوان المشروع: ${title}`);
	if (ctx.specialty?.trim()) facts.push(`التصنيف: ${ctx.specialty.trim()}`);
	if (ctx.subSpecialty?.trim()) facts.push(`التخصص الفرعي: ${ctx.subSpecialty.trim()}`);
	if (ctx.model?.trim()) facts.push(`النموذج المرتبط: ${ctx.model.trim()}`);
	const skills = (ctx.skills ?? []).map(s => s.trim()).filter(Boolean);
	if (skills.length) facts.push(`المهارات: ${skills.join('، ')}`);
	if (ctx.budgetUsd && ctx.budgetUsd > 0) facts.push(`الميزانية الإجمالية: ${formatBase(ctx.budgetUsd)}`);
	if (ctx.days && ctx.days > 0) facts.push(`المدة الإجمالية: ${ctx.days} يومًا`);
	const others = facts.length - (title ? 1 : 0);
	if (meaningfulWords(title) < 2 && others === 0) return null;
	return [
		'صُغ وصفًا احترافيًا لمشروع يقدّمه مقدّم الخدمة اعتمادًا على البيانات المقدمة أدناه فقط.',
		'قواعد صارمة: لا تضف خبرات أو تقنيات أو أدوات أو مخرجات أو أسعارًا أو مواعيد أو التزامات غير مذكورة في البيانات. اكتب أي بند غير محدد كنقطة مفتوحة يتم الاتفاق عليها مع العميل. لا تخترع أرقامًا أو أسماء. لا يتجاوز كل وصف ' + max + ' حرف.',
		SEED_FACTS_MARKER,
		...facts,
	].join('\n');
}
