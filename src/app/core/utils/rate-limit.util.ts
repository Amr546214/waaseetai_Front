/** The one user-facing text for a rate-limited (HTTP 429) request. */
export const RATE_LIMIT_MESSAGE = 'عدد الطلبات كبير، حاول مرة أخرى بعد قليل';
/** Neutral text for a check (access state) that could not be completed because of a 429: it never claims "not approved". */
export const RATE_LIMIT_CHECK_MESSAGE = 'تعذّر التحقق مؤقتًا — أعد المحاولة';

const RATE_LIMIT_TEXT = /طلبات كثيرة|عدد الطلبات كبير|محاولات كثيرة/;

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
	const h = e.headers?.get?.('Retry-After');
	const n = h != null ? Number(h) : NaN;
	if (Number.isFinite(n) && n >= 0) return Math.ceil(n);
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
