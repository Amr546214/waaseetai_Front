// Create-request "تحسين وصياغة AI" works on text the client already wrote: no generation from nothing.
// The WaseetAI enhance endpoint takes nothing but {description} (no instruction field, its prompt is the vendor's), so the rewrite-only rule is enforced
// on OUR side for the INPUT: nothing is sent unless the client wrote enough. Preview text may contain several choices;
// its own bounded parser preserves those choices, and the selected editable draft must fit the 2000-character form limit.
// Input thresholds mirror waseetai-backend/src/utils/description-rewrite-guard.ts.

export const REWRITE_MIN_DESCRIPTION_CHARS = 30;
export const REWRITE_MIN_DESCRIPTION_WORDS = 4;
export const REWRITE_INPUT_REQUIRED_MESSAGE = 'اكتب عنوان الطلب ووصفه أولًا، ثم استخدم تحسين الصياغة.';

const GENERIC_TITLES = new Set([
  'تجربة', 'اختبار', 'مشروع', 'مشروع جديد', 'طلب', 'طلب جديد', 'خدمة', 'خدمة جديدة',
  'test', 'testing', 'project', 'new project', 'request', 'service'
]);

export function isMeaningfulProjectTitle(title: string): boolean {
  const normalized = title.replace(/[\p{P}\p{S}_]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const words = normalized.split(' ').filter(word => word.length > 1);
  return normalized.length >= 8 && words.length >= 2 && !GENERIC_TITLES.has(normalized.toLowerCase());
}

const wordsOf = (text: string) => text.replace(/[\p{P}\p{S}_]+/gu, ' ').split(/\s+/).filter(w => w.length > 1);

/** True when the client wrote enough to be restated: a few words are not a draft to rewrite. */
export function hasEnoughDescriptionToRewrite(description: string): boolean {
  const text = description.trim();
  return text.length >= REWRITE_MIN_DESCRIPTION_CHARS && wordsOf(text).length >= REWRITE_MIN_DESCRIPTION_WORDS;
}

export function canRewrite(title: string, description: string): boolean {
  return isMeaningfulProjectTitle(title.trim()) && hasEnoughDescriptionToRewrite(description);
}

export const REWRITE_MAX_CHARS = 2000;

export type RewriteCheck = { ok: true; text: string } | { ok: false; reason: 'empty' };

/**
 * An empty reply is refused. Full preview text is preserved for formatting and option selection;
 * a long draft must be shortened explicitly rather than silently cutting the model response.
 */
export function checkRewriteOutput(_input: string, output: string): RewriteCheck {
  const text = output.trim();
  if (!text) return { ok: false, reason: 'empty' };
  // Preview includes alternatives and advice. The selected editable draft is checked against the form limit separately.
  return { ok: true, text };
}
