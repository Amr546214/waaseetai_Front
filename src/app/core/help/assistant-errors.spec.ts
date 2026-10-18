import { HELP_ASSISTANT_UNAVAILABLE_MESSAGE, isObsoleteKnowledgeRefusal, normalizeAssistantError, normalizeAssistantMessageText } from './assistant-errors';

const oldRefusal = 'لم يجد المساعد الذكي إجابة معتمدة لهذا السؤال في قاعدة المعرفة. يمكنك إعادة صياغة سؤالك أو التواصل مع فريق الدعم البشري.';

describe('assistant legacy error compatibility', () => {
	it('replaces the obsolete knowledge-only refusal without pretending an answer succeeded', () => {
		expect(normalizeAssistantError({ code: 'NO_ANSWER', message: oldRefusal, humanSupportFallback: true })).toEqual({ code: 'UNAVAILABLE', message: HELP_ASSISTANT_UNAVAILABLE_MESSAGE, humanSupportFallback: false });
		expect(normalizeAssistantError({ code: 'UNAVAILABLE', message: oldRefusal })).toEqual({ code: 'UNAVAILABLE', message: HELP_ASSISTANT_UNAVAILABLE_MESSAGE, humanSupportFallback: false });
		expect(normalizeAssistantError({ code: 'NO_ANSWER', message: 'لا توجد إجابة' }).message).toBe(HELP_ASSISTANT_UNAVAILABLE_MESSAGE);
	});
	it('recognizes formatting whitespace and Arabic marks in an older refusal', () => {
		expect(isObsoleteKnowledgeRefusal('**لم يجد المساعدُ الذكي\nإجابة معتمدة**')).toBe(true);
		expect(isObsoleteKnowledgeRefusal('لم يجد **المساعد الذكي** إجابة معتمدة')).toBe(true);
		expect(isObsoleteKnowledgeRefusal('إجابة عامة مفيدة')).toBe(false);
	});
	it('preserves user questions, legitimate answers and other actionable errors', () => {
		const question = `ليه الرسالة دي بتظهر: "${oldRefusal}"؟`;
		expect(normalizeAssistantMessageText(question, 'user')).toBe(question);
		expect(normalizeAssistantMessageText(oldRefusal, 'assistant')).toBe(HELP_ASSISTANT_UNAVAILABLE_MESSAGE);
		expect(normalizeAssistantMessageText('الضمان يحمي الطرفين.', 'assistant')).toBe('الضمان يحمي الطرفين.');
		expect(normalizeAssistantError({ code: 'RATE_LIMITED', message: 'انتظر دقيقة.', humanSupportFallback: false })).toEqual({ code: 'RATE_LIMITED', message: 'انتظر دقيقة.', humanSupportFallback: false });
		expect(normalizeAssistantError({ code: 'AUTH_REQUIRED', message: 'يجب تسجيل الدخول.' }).code).toBe('AUTH_REQUIRED');
	});
});
