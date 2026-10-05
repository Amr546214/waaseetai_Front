/**
 * One place that turns any failed HTTP call into something the user can act on, and says WHICH kind of problem it is:
 *
 *  - 'backend-validation' : the server rejected the data (400/422). `fieldErrors` names the fields when the server says so.
 *  - 'pending-review'     : the account/request is waiting for review/verification (403 with that meaning).
 *  - 'credentials'        : 401 where the user's own credentials are wrong (login, "current password").
 *  - 'session'            : 401 where the session expired.
 *  - 'forbidden'          : 403, not allowed.
 *  - 'conflict'           : 409, already exists / wrong state.
 *  - 'payload'            : 413, files too large.
 *  - 'rate-limit'         : 429, with a wait time when it can be read.
 *  - 'network'            : status 0, nothing reached the server.
 *  - 'server'             : 5xx.
 *  - 'not-found'          : 404.
 *  - 'unknown'            : anything else.
 *
 * The result message is always Arabic: server text is used only when it already is Arabic, otherwise a fixed Arabic
 * message is used (the backend still answers with English for zod failures, rate limits and 500s).
 */
export type HttpErrorKind =
	| 'backend-validation' | 'pending-review' | 'credentials' | 'session' | 'forbidden' | 'conflict'
	| 'payload' | 'rate-limit' | 'network' | 'server' | 'not-found' | 'unknown';

export interface MappedHttpError {
	kind: HttpErrorKind;
	status: number;
	/** Short Arabic title for banners. */
	title: string;
	/** The Arabic message to show the user. */
	message: string;
	/** Server-reported per-field messages, keyed by the field name (last path segment). */
	fieldErrors: Record<string, string>;
	/** Seconds the user should wait (429 only), when known. */
	retryAfterSeconds: number | null;
	/** True when trying again unchanged can reasonably succeed (network, 5xx, 429 later). */
	retryable: boolean;
}

export interface MapHttpErrorOptions {
	/**
	 * What a 401 means for this call. Default 'session' (token expired). Use 'credentials' for login and for
	 * "current password is wrong" so the user is not told their session expired.
	 */
	unauthorizedIs?: 'session' | 'credentials';
	/** Arabic fallback when nothing better is known. */
	fallback?: string;
}

const ARABIC = /[؀-ۿ]/;
const PENDING = /قيد\s*(المراجعة|التحقق)|تفعيل حسابك|بانتظار|OTP|PENDING/i;

/** Raw backend codes (thrown as `new Error('CODE')`) that reach the client as the message. Matched before the ':'. */
export const BACKEND_CODE_MESSAGES: Record<string, string> = {
	REQUIRED_PROFILE_FIELDS: 'أكمل الحقول المطلوبة: الاسم الأول والأخير والمسمى والتخصص',
	PROFILE_FIELD_TOO_LONG: 'أحد الحقول أطول من الحد المسموح',
	INVALID_URL: 'أحد الروابط غير صالح، يجب أن يبدأ بـ http:// أو https://',
	INVALID_EMAIL: 'البريد الإلكتروني غير صالح',
	INVALID_PHONE: 'رقم الجوال غير صالح',
	INVALID_ALTERNATIVE_PHONE: 'رقم الجوال البديل غير صالح',
	EMAIL_ALREADY_USED: 'هذا البريد الإلكتروني مستخدم بالفعل',
	PHONE_ALREADY_USED: 'رقم الجوال هذا مستخدم بالفعل',
	ID_DOCUMENT_REQUIRED: 'مستند الهوية مطلوب',
	INVALID_DOCUMENT_URL: 'أحد المستندات المرفوعة غير صالح، أعد رفعه',
	OTP_EMAIL_DELIVERY_FAILED: 'تعذّر إرسال رمز التحقق إلى بريدك، حاول مجددًا',
	CURRENT_PASSWORD_INCORRECT: 'كلمة المرور الحالية غير صحيحة',
	PASSWORD_UNCHANGED: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية',
	WEAK_PASSWORD: 'كلمة المرور ضعيفة: استخدم 8 أحرف على الأقل مع حرف كبير ورقم',
	REQUEST_NOT_PENDING_OTP: 'انتهت صلاحية هذا الطلب، ابدأ من جديد',
};

function hasArabic(s: unknown): s is string {
	return typeof s === 'string' && ARABIC.test(s);
}

function serverMessageOf(body: any): string | null {
	if (typeof body === 'string') return body.trim() || null;
	const m = body?.message ?? body?.error;
	return typeof m === 'string' && m.trim() ? m.trim() : null;
}

/** Maps a raw backend code ("INVALID_URL:githubUrl") to Arabic; null when it is not a known code. */
export function messageForBackendCode(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const code = raw.split(':')[0].trim();
	return BACKEND_CODE_MESSAGES[code] ?? null;
}

/** Reads the zod/validateDto `errors[]` ({path|field, message}) into { field: message }. First message per field wins. */
export function fieldErrorsFromBody(body: any): Record<string, string> {
	const out: Record<string, string> = {};
	const list = body?.errors ?? body?.issues;
	if (!Array.isArray(list)) return out;
	for (const e of list) {
		if (!e || typeof e.message !== 'string') continue;
		const rawPath = e.field ?? e.path;
		const parts = Array.isArray(rawPath) ? rawPath : typeof rawPath === 'string' ? rawPath.split('.') : [];
		const key = String(parts[parts.length - 1] ?? '').trim();
		if (!key || out[key]) continue;
		out[key] = e.message;
	}
	return out;
}

function waitSecondsFrom(err: any, serverMessage: string | null): number | null {
	const fromBody = (Array.isArray(err?.error?.errors) ? err.error.errors : [])
		.map((x: any) => Number(x?.retryAfterSeconds)).find((n: number) => Number.isFinite(n) && n > 0);
	const header = err?.headers?.get?.('Retry-After');
	if (header) {
		const n = Number(header);
		if (Number.isFinite(n) && n >= 0) return Math.ceil(n);
		const t = Date.parse(header);
		if (!Number.isNaN(t)) return Math.max(0, Math.ceil((t - Date.now()) / 1000));
	}
	if (fromBody) return Math.ceil(fromBody);
	// The backend limiter says "...try again after 15 minutes" / "after an hour".
	if (serverMessage) {
		const m = /(\d+)\s*minute/i.exec(serverMessage);
		if (m) return Number(m[1]) * 60;
		const h = /(\d+)\s*hour/i.exec(serverMessage);
		if (h) return Number(h[1]) * 3600;
		if (/an hour/i.test(serverMessage)) return 3600;
	}
	return null;
}

/** "15 دقيقة" / "ساعة" / "30 ثانية". */
export function formatWait(seconds: number): string {
	if (seconds >= 3600) {
		const h = Math.round(seconds / 3600);
		return h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : `${h} ساعات`;
	}
	if (seconds >= 60) {
		const m = Math.ceil(seconds / 60);
		return m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : `${m} ${m <= 10 ? 'دقائق' : 'دقيقة'}`;
	}
	return `${Math.max(1, seconds)} ثانية`;
}

export function mapHttpError(err: unknown, options: MapHttpErrorOptions = {}): MappedHttpError {
	const e = err as any;
	const status: number = typeof e?.status === 'number' ? e.status : 0;
	const body = e?.error;
	const serverMessage = serverMessageOf(body);
	const code = messageForBackendCode(serverMessage);
	const arabicServer = hasArabic(serverMessage) ? serverMessage : null;
	const fallback = options.fallback || 'حدث خطأ غير متوقع، حاول مرة أخرى';

	const make = (kind: HttpErrorKind, title: string, message: string, extra: Partial<MappedHttpError> = {}): MappedHttpError => ({
		kind, status, title, message, fieldErrors: {}, retryAfterSeconds: null, retryable: false, ...extra,
	});

	if (status === 0) {
		return make('network', 'تعذّر الاتصال', 'تعذّر الاتصال بالخادم. تحقق من اتصال الإنترنت ثم حاول مجددًا.', { retryable: true });
	}

	if (status === 400 || status === 422) {
		const fieldErrors = fieldErrorsFromBody(body);
		const fields = Object.keys(fieldErrors);
		let message: string;
		if (code) message = code;
		else if (fields.length === 1) message = fieldErrors[fields[0]];
		else if (fields.length > 1) message = 'يرجى تصحيح الحقول المحددة ثم المحاولة مجددًا';
		else if (arabicServer && !/Validation Error/i.test(arabicServer)) message = arabicServer;
		else message = 'البيانات المُدخلة غير صالحة، راجع الحقول وحاول مجددًا';
		return make('backend-validation', 'بيانات غير صالحة', message, { fieldErrors });
	}

	if (status === 401) {
		if (options.unauthorizedIs === 'credentials') {
			return make('credentials', 'بيانات غير صحيحة', code || arabicServer || 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
		}
		return make('session', 'انتهت الجلسة', 'انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.');
	}

	if (status === 403) {
		if (serverMessage && PENDING.test(serverMessage)) {
			return make('pending-review', 'قيد المراجعة', code || arabicServer || 'حسابك أو طلبك قيد المراجعة/التحقق حاليًا');
		}
		return make('forbidden', 'غير مسموح', code || arabicServer || 'ليست لديك صلاحية لتنفيذ هذا الإجراء');
	}

	if (status === 404) return make('not-found', 'غير موجود', code || arabicServer || 'لم يتم العثور على العنصر المطلوب');

	if (status === 409) {
		return make('conflict', 'تعارض', code || arabicServer || 'هذا العنصر موجود مسبقًا أو حالته لا تسمح بهذا الإجراء');
	}

	if (status === 413) {
		return make('payload', 'حجم كبير', 'حجم الملفات أو البيانات كبير جدًا. قلّل الحجم وحاول مجددًا.');
	}

	if (status === 429) {
		const wait = waitSecondsFrom(e, serverMessage);
		// The Arabic server text already carries the wait; when it does not, the known wait is appended.
		const message = (arabicServer && wait && !/\d|ثانية|دقيقة|دقيقتين|ساعة|ساعتين/.test(arabicServer) ? `${arabicServer} (${formatWait(wait)})` : arabicServer)
			|| (wait ? `تجاوزت عدد المحاولات المسموح بها. حاول مرة أخرى بعد ${formatWait(wait)}.` : 'تجاوزت عدد المحاولات المسموح بها. انتظر قليلًا ثم حاول مجددًا.');
		return make('rate-limit', 'محاولات كثيرة', message, { retryAfterSeconds: wait, retryable: true });
	}

	// A deliberate 503 from the backend (e.g. SMS verification not available) carries its own Arabic explanation.
	if (status === 503 && arabicServer) return make('server', 'الخدمة غير متاحة', arabicServer, { retryable: true });

	if (status >= 500) {
		return make('server', 'خطأ في الخادم', 'حدث خطأ في الخادم. حاول مرة أخرى بعد قليل.', { retryable: true });
	}

	return make('unknown', 'تعذّر التنفيذ', code || arabicServer || fallback);
}
