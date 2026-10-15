/**
 * One reader for "when may the user try again": returns an ABSOLUTE end time (epoch ms) or null when the server gave none.
 * Nothing is ever invented: no header, no body field, no number.
 *
 * Accepted sources (first one that parses wins):
 *  1. `Retry-After` header: delta-seconds ("42") OR an HTTP-date ("Wed, 21 Oct 2026 07:28:00 GMT");
 *  2. body absolute times: `retryAt` / `resendAvailableAt` / `availableAt` (ISO), at top level, in `data`, or in `errors[]` / `details[]`;
 *  3. body durations: `retryAfterSeconds` (same places).
 * A date in the past is returned as it is (the remaining time is then zero); garbage is null.
 */

type Bag = Record<string, unknown>;

const ISO_KEYS = ['retryAt', 'resendAvailableAt', 'availableAt'] as const;

function asBag(v: unknown): Bag | null {
	return v && typeof v === 'object' && !Array.isArray(v) ? (v as Bag) : null;
}

function headerValue(source: any, name: string): string | null {
	const h = source?.headers;
	if (!h) return null;
	try {
		const v = typeof h.get === 'function' ? h.get(name) : (h[name] ?? h[name.toLowerCase()]);
		if (Array.isArray(v)) return v.length ? String(v[0]) : null;
		return v == null ? null : String(v);
	} catch { return null; }
}

/** `Retry-After` value: delta-seconds or HTTP-date -> end time, else null. */
export function parseRetryAfterHeader(value: string | null | undefined, now: number = Date.now()): number | null {
	if (value == null) return null;
	const v = String(value).trim();
	if (!v) return null;
	if (/^\d+$/.test(v)) return now + Number(v) * 1000;
	// An HTTP-date always carries letters (day name / month); reject bare numbers with signs, decimals or junk that Date.parse might accept.
	if (!/[A-Za-z]/.test(v)) return null;
	const t = Date.parse(v);
	return Number.isNaN(t) ? null : t;
}

function fromBag(b: Bag | null, now: number): number | null {
	if (!b) return null;
	for (const k of ISO_KEYS) {
		const v = b[k];
		if (typeof v === 'string' && v.trim()) { const t = Date.parse(v); if (!Number.isNaN(t)) return t; }
	}
	const s = b['retryAfterSeconds'];
	const n = typeof s === 'number' ? s : typeof s === 'string' && s.trim() ? Number(s) : NaN;
	if (Number.isFinite(n) && n >= 0) return now + Math.ceil(n) * 1000;
	return null;
}

/**
 * @param source an HttpErrorResponse (headers + error body), an HttpResponse body, a Headers/HttpHeaders object, a plain body object,
 *               or the raw `Retry-After` string.
 */
export function parseRetryAfter(source: unknown, now: number = Date.now()): number | null {
	if (source == null) return null;
	if (typeof source === 'string') return parseRetryAfterHeader(source, now);
	if (typeof source !== 'object') return null;
	const s: any = source;
	const fromHeader = parseRetryAfterHeader(headerValue(s, 'Retry-After'), now);
	if (fromHeader != null) return fromHeader;
	// Headers object passed directly
	if (typeof s.get === 'function' && s.error === undefined && s.body === undefined) {
		const direct = parseRetryAfterHeader(headerValue({ headers: s }, 'Retry-After'), now);
		if (direct != null) return direct;
	}
	const body = asBag(s.error) ?? asBag(s.body) ?? asBag(s);
	if (!body) return null;
	const top = fromBag(body, now);
	if (top != null) return top;
	const inData = fromBag(asBag(body['data']), now);
	if (inData != null) return inData;
	for (const listKey of ['errors', 'details']) {
		const list = body[listKey];
		if (Array.isArray(list)) for (const item of list) { const t = fromBag(asBag(item), now); if (t != null) return t; }
	}
	return null;
}

/** Remaining whole seconds (rounded up) until `endsAt`; 0 when it has passed. */
export function remainingSeconds(endsAt: number | null | undefined, now: number = Date.now()): number {
	if (endsAt == null) return 0;
	return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
