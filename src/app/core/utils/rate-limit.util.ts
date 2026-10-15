import { parseRetryAfter, remainingSeconds } from '../wait/retry-after.util';
import { formatWaitWords, rateLimitSentence } from '../wait/wait-format';

/** The one user-facing text for a rate-limited (HTTP 429) request whose wait the server did not state (honest: no number is invented). */
export const RATE_LIMIT_MESSAGE = rateLimitSentence(null);
/** Neutral text for a check (access state) that could not be completed because of a 429: it never claims "not approved". */
export const RATE_LIMIT_CHECK_MESSAGE = 'تعذّر التحقق مؤقتًا — أعد المحاولة';

const RATE_LIMIT_TEXT = /طلبات كثيرة|عدد الطلبات كبير|محاولات كثيرة|طلبات رمز/;

function bodyMessage(err: any): string {
	const b = err?.error;
	const m = typeof b === 'string' ? b : b?.message;
	return typeof m === 'string' ? m : '';
}

/**
 * True for an HTTP 429. A temporary condition: it says nothing about the user's state (role, approval, data) and must never
 * redirect, log out, empty a list or look like "unauthorized". Also tolerates a rebuilt error whose status was lost but whose body still carries the Arabic text.
 */
export function isRateLimitError(err: unknown): boolean {
	const e: any = err;
	if (!e || typeof e !== 'object') return false;
	if (e.status === 429) return true;
	return (e.status === 0 || e.status === undefined) && RATE_LIMIT_TEXT.test(bodyMessage(e));
}

/** Seconds to wait: the `Retry-After` header (seconds), else the body's retryAfterSeconds, else the minutes/seconds written in the Arabic message. null = unknown. */
export function retryAfterSeconds(err: unknown): number | null {
	const e: any = err;
	if (!e) return null;
	const end = parseRetryAfter(e);
	if (end != null) return remainingSeconds(end);
	const details = e.error?.errors ?? e.error?.details;
	if (Array.isArray(details)) {
		const d = details.find((x: any) => Number.isFinite(Number(x?.retryAfterSeconds)));
		if (d) return Math.ceil(Number(d.retryAfterSeconds));
	}
	const msg = bodyMessage(e);
	if (/دقيقتين/.test(msg)) return 120;
	if (/ثانية|ثانيتين/.test(msg) && !/دقيقة/.test(msg)) { const s = msg.match(/(\d+)\s*ثانية/); return s ? Number(s[1]) : 1; }
	const m = msg.match(/(\d+)\s*دقيقة|(\d+)\s*دقائق/);
	if (m) return Number(m[1] ?? m[2]) * 60;
	if (/دقيقة/.test(msg)) return 60;
	return null;
}

export interface LoadErrorHandlers {
	/** True when a previous successful load is on screen. On a 429 it stays untouched (the central toast already told the user). */
	hasData?: () => boolean;
	/** 429 with data kept: only settle the transient flags (e.g. isLoading=false). Never empty/zero anything. */
	onKeep?: () => void;
	/** 429 with nothing loaded yet: show the page's error state with its retry button (NOT the empty state, NOT zeros). */
	onRateLimit: (err: unknown) => void;
	/** Any other error: the page's existing behaviour, unchanged. */
	onOtherError: (err: unknown) => void;
}

/** The single place a loader decides what an error means; a 429 can never turn into empty / zero / "no data". */
export function handleLoadError(err: unknown, h: LoadErrorHandlers): void {
	if (!isRateLimitError(err)) { h.onOtherError(err); return; }
	if (h.hasData?.()) h.onKeep?.();
	else h.onRateLimit(err);
}

/** "30 ثانية" / "دقيقتين" / "5 دقائق" / "ساعة" for the wait shown to the user. */
export function formatWaitArabic(seconds: number): string { return formatWaitWords(seconds); }

/** Absolute end (epoch ms) of the wait a 429 asked for: Retry-After (seconds or HTTP-date) / body time / body seconds, else the wait written in the Arabic text. null = the server stated none. */
export function rateLimitEndsAt(err: unknown, now: number = Date.now()): number | null {
	const direct = parseRetryAfter(err, now);
	if (direct != null) return direct;
	const s = retryAfterSeconds(err);
	return s != null ? now + s * 1000 : null;
}

/** The honest toast text: the real wait from Retry-After when the server sent one, else the generic text. */
export function rateLimitToastMessage(err: unknown): string {
	const wait = retryAfterSeconds(err);
	return wait != null && wait > 0 ? rateLimitSentence(wait) : RATE_LIMIT_MESSAGE;
}
