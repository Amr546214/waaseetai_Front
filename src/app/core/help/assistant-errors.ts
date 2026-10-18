/** Compatibility with older help gateways that reject questions outside their knowledge base. */
export const HELP_ASSISTANT_UNAVAILABLE_MESSAGE = 'تعذر الحصول على رد من المساعد الذكي حالياً. حاول مرة أخرى بعد قليل.';

function comparableText(value: string): string {
	return value.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640\\*_`]/g, '').replace(/[\s\u061C\u200B-\u200F\u202A-\u202E]+/g, ' ').trim();
}

export function isObsoleteKnowledgeRefusal(text: string): boolean {
	return comparableText(text).includes('لم يجد المساعد الذكي إجابة معتمدة');
}

/** Questions are user content: quoting an old error must never change the question. */
export function normalizeAssistantMessageText(text: string, role: 'user' | 'assistant'): string {
	return role === 'assistant' && isObsoleteKnowledgeRefusal(text) ? HELP_ASSISTANT_UNAVAILABLE_MESSAGE : text;
}

export function normalizeAssistantError(error: { code?: string; message?: string; humanSupportFallback?: boolean }): { code: string; message: string; humanSupportFallback: boolean } {
	if (error.code === 'NO_ANSWER' || isObsoleteKnowledgeRefusal(error.message ?? '')) {
		return { code: 'UNAVAILABLE', message: HELP_ASSISTANT_UNAVAILABLE_MESSAGE, humanSupportFallback: false };
	}
	return { code: error.code || 'UNAVAILABLE', message: error.message || HELP_ASSISTANT_UNAVAILABLE_MESSAGE, humanSupportFallback: error.humanSupportFallback === true };
}
