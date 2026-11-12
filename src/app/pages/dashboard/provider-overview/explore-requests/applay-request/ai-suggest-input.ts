// Client-side validation for POST /api/proposals/ai-suggest:
// Both title and message must be written by the provider first so AI strictly refines their own draft.
export const AI_SUGGEST_MISSING_BOTH = 'اكتب عنوان العرض ونصه معًا ليتمكن الذكاء الاصطناعي من تحسينهما';
export const AI_SUGGEST_MISSING_TITLE = 'اكتب عنوان العرض أولاً، فالاقتراح يحتاج العنوان والنص معًا';
export const AI_SUGGEST_MISSING_MESSAGE = 'اكتب نص العرض أولاً، فالاقتراح يحتاج العنوان والنص معًا';

export function aiSuggestInputError(title: string | null | undefined, message: string | null | undefined): string | null {
	const hasTitle = Boolean(title && title.trim().length > 0);
	const hasMessage = Boolean(message && message.trim().length > 0);
	if (!hasTitle && !hasMessage) return AI_SUGGEST_MISSING_BOTH;
	if (!hasTitle) return AI_SUGGEST_MISSING_TITLE;
	if (!hasMessage) return AI_SUGGEST_MISSING_MESSAGE;
	return null;
}

