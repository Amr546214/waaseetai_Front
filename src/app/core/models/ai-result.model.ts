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

/** Mirrors the backend AiResult<D> (ai-result.ts): the ONE shape of every AI-backed result. score / confidence / summary are null when missing (never 0). */
export interface AiResult<D = unknown> {
	status: AiStatus;
	source: AiSource;
	score: number | null;
	confidence: number | null;
	summary: string | null;
	recommendation: string | null;
	details: D | null;
	generatedAt: string | null;
}

/** details of a metric-summary result (client reports / marketer insights / admin cards). */
export interface MetricSummaryDetails {
	observations: { text: string; basedOn?: string[] }[];
	recommendations: { text: string; basedOn?: string[] }[];
	[extra: string]: unknown;
}
