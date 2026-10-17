// Client-side validation for POST /api/proposals/ai-suggest:
// WaseetAI can draft a full proposal from the title + project details, or refine an existing draft.
export const AI_SUGGEST_MISSING_BOTH = 'اكتب عنوان العرض أولاً ليتمكن الذكاء الاصطناعي من صياغة العرض بناءً على العنوان والمشروع';
export const AI_SUGGEST_MISSING_TITLE = 'اكتب عنوان العرض أولاً ليتمكن الذكاء الاصطناعي من صياغة العرض بناءً على العنوان والمشروع';
export const AI_SUGGEST_MISSING_MESSAGE = 'اكتب نص العرض أولاً، فالاقتراح يحتاج العنوان والنص معًا';

/** Returns null because WaseetAI can draft both title and message directly from the project details when fields are empty, or refine existing input. */
export function aiSuggestInputError(_title: string | null | undefined, _message: string | null | undefined): string | null {
	return null;
}

