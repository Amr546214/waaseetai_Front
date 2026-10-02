// Client-side mirror of the backend rule for POST /api/proposals/ai-suggest:
// WaseetAI needs BOTH a title and a message. Same three messages as the backend.
export const AI_SUGGEST_MISSING_BOTH = 'اكتب عنوان العرض ونصه معًا ليتمكن الذكاء الاصطناعي من تحسينهما';
export const AI_SUGGEST_MISSING_TITLE = 'اكتب عنوان العرض أولاً، فالاقتراح يحتاج العنوان والنص معًا';
export const AI_SUGGEST_MISSING_MESSAGE = 'اكتب نص العرض أولاً، فالاقتراح يحتاج العنوان والنص معًا';

/** Returns the message to show when the draft cannot be sent, or null when both fields are filled. */
export function aiSuggestInputError(title: string | null | undefined, message: string | null | undefined): string | null {
	const hasTitle = !!title?.trim();
	const hasMessage = !!message?.trim();
	if (!hasTitle && !hasMessage) return AI_SUGGEST_MISSING_BOTH;
	if (!hasTitle) return AI_SUGGEST_MISSING_TITLE;
	if (!hasMessage) return AI_SUGGEST_MISSING_MESSAGE;
	return null;
}
