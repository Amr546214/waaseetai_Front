/** Mirrors the backend's honest AI shapes (ai-result.ts). A UI may show the AI label / icon only via isRealAi(). */
export type AiSource = 'GEMINI' | 'WASEET_AI' | 'RULES' | 'NONE';
export type AiStatus = 'READY' | 'FAILED' | 'NOT_ENOUGH_DATA' | 'PENDING';

/** Advisory AI pre-review of a governed profile-change request (never carries a score or a confidence). */
export interface ProfileAiReview {
	status: AiStatus;
	source: AiSource;
	summary: string | null;
	recommendation: string | null;
	generatedAt: string | null;
	observations: string[];
}

export const CLIENT_PASSWORD_CHANGE_CATEGORY = 'CLIENT_PASSWORD_CHANGE';

/** True only for a real, finished AI result (READY and produced by Gemini / WaseetAI). */
export function isRealAi(r: { status?: string | null; source?: string | null } | null | undefined): boolean {
	return !!r && r.status === 'READY' && (r.source === 'GEMINI' || r.source === 'WASEET_AI');
}
