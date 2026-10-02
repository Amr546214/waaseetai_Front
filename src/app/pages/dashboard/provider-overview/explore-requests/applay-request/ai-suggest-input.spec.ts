import { aiSuggestInputError, AI_SUGGEST_MISSING_BOTH, AI_SUGGEST_MISSING_MESSAGE, AI_SUGGEST_MISSING_TITLE } from './ai-suggest-input';

describe('aiSuggestInputError (title and message are both required)', () => {
	it('both empty or blank -> the "both" message', () => {
		expect(aiSuggestInputError('', '')).toBe(AI_SUGGEST_MISSING_BOTH);
		expect(aiSuggestInputError('  ', '\n')).toBe(AI_SUGGEST_MISSING_BOTH);
		expect(aiSuggestInputError(undefined, null)).toBe(AI_SUGGEST_MISSING_BOTH);
	});

	it('only the message filled -> asks for the title', () => {
		expect(aiSuggestInputError('', 'نص العرض')).toBe(AI_SUGGEST_MISSING_TITLE);
		expect(aiSuggestInputError('   ', 'نص العرض')).toBe(AI_SUGGEST_MISSING_TITLE);
	});

	it('only the title filled -> asks for the message', () => {
		expect(aiSuggestInputError('عنوان العرض', '')).toBe(AI_SUGGEST_MISSING_MESSAGE);
		expect(aiSuggestInputError('عنوان العرض', '  ')).toBe(AI_SUGGEST_MISSING_MESSAGE);
	});

	it('both filled -> no error, so the request proceeds', () => {
		expect(aiSuggestInputError('عنوان', 'نص')).toBeNull();
	});

	it('uses the same wording as the backend', () => {
		expect(AI_SUGGEST_MISSING_BOTH).toBe('اكتب عنوان العرض ونصه معًا ليتمكن الذكاء الاصطناعي من تحسينهما');
		expect(AI_SUGGEST_MISSING_TITLE).toBe('اكتب عنوان العرض أولاً، فالاقتراح يحتاج العنوان والنص معًا');
		expect(AI_SUGGEST_MISSING_MESSAGE).toBe('اكتب نص العرض أولاً، فالاقتراح يحتاج العنوان والنص معًا');
	});
});
