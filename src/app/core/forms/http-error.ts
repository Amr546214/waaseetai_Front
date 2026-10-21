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
import { parseRetryAfter, remainingSeconds } from '../wait/retry-after.util';
import { rateLimitSentence } from '../wait/wait-format';

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
	/** Absolute end (epoch ms) of the 429 wait when the server stated one (Retry-After / retryAt / resendAvailableAt). */
	retryEndsAt?: number | null;
	/** True when trying again unchanged can reasonably succeed (network, 5xx, 429 later). */
	retryable: boolean;
	/** The server's fixed marker (`code` in the body), e.g. IDENTITY_REQUEST_WAITING / OTP_ATTEMPTS_LOCKED / INTERNAL_ERROR; null when none. Branch on this, never on the text. */
	code?: string | null;
	/** The server's trace id of an unexpected failure (also in the server log): shown so support can find it. Never a stack, never a SQL text. */
	traceId?: string | null;
	/**
	 * True when the request may HAVE been processed although the answer did not arrive or was a gateway failure (network drop, 502/504, a 5xx from the server):
	 * a write that creates something must be checked (or be idempotent) before it is offered again.
	 */
	outcomeUnknown?: boolean;
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
	INVALID_PHONE_COUNTRY: 'رمز الدولة في الرقم لا يطابق رمز دولة حسابك. اكتب الرقم المحلي بدون رمز الدولة.',
	INVALID_ALTERNATIVE_PHONE: 'رقم الجوال البديل غير صالح',
	EMAIL_ALREADY_USED: 'هذا البريد الإلكتروني مستخدم بالفعل',
	PHONE_ALREADY_USED: 'رقم الجوال هذا مستخدم بالفعل',
	ID_DOCUMENT_REQUIRED: 'مستند الهوية مطلوب',
	REQUEST_ALREADY_PENDING: 'لديك طلب قيد مراجعة الإدارة بالفعل، لا حاجة لإرساله مرة أخرى',
	INVALID_DOCUMENT_URL: 'أحد المستندات المرفوعة غير صالح، أعد رفعه',
	OTP_EMAIL_DELIVERY_FAILED: 'تعذّر إرسال رمز التحقق إلى بريدك، حاول مجددًا',
	CURRENT_PASSWORD_INCORRECT: 'كلمة المرور الحالية غير صحيحة',
	PASSWORD_UNCHANGED: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية',
	WEAK_PASSWORD: 'كلمة المرور ضعيفة: استخدم 8 أحرف على الأقل مع حرف كبير ورقم',
	REQUEST_NOT_PENDING_OTP: 'انتهت صلاحية هذا الطلب، ابدأ من جديد',
	REQUEST_NOT_PENDING_REVIEW: 'هذا الطلب لم يعد قيد المراجعة',
	OTP_REQUIRED: 'يلزم إدخال رمز التحقق لإتمام هذا الإجراء',
	INVALID_OR_EXPIRED_OTP: 'رمز التحقق غير صحيح أو منتهي الصلاحية',
	INVALID_IBAN: 'رقم الآيبان غير صالح',
	INVALID_BANK_NAME: 'اسم البنك غير صالح',
	INVALID_ACCOUNT_HOLDER: 'اسم صاحب الحساب غير صالح',
	PASSWORD_FIELDS_REQUIRED: 'أدخل كلمة المرور الحالية والجديدة',
	SESSION_NOT_FOUND: 'الجلسة غير موجودة أو انتهت',
	CANNOT_REVOKE_CURRENT_SESSION: 'لا يمكن إنهاء الجلسة الحالية من هنا',
	AUDIT_LOG_NOT_FOUND: 'السجل المطلوب غير موجود',
};

/** Fixed Arabic texts for statuses whose body is often not ours (a proxy's HTML, or a short English line). */
export const STATUS_MESSAGES: Record<number, string> = {
	413: 'حجم الملفات أو البيانات كبير جدًا وأكبر من الحد المسموح. قلّل الحجم وحاول مجددًا.',
	415: 'نوع الملف غير مدعوم، ارفع ملفًا بصيغة JPG أو PNG أو WEBP أو PDF',
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
	// Retry-After (seconds or HTTP-date), body retryAt / resendAvailableAt / retryAfterSeconds (top level, data, errors[]).
	const end = parseRetryAfter(err);
	if (end != null) { const s = remainingSeconds(end); return s > 0 ? s : null; }
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
	const bodyCode = typeof body?.code === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(body.code) ? (body.code as string) : null;
	const traceId = typeof body?.traceId === 'string' && /^[0-9A-Za-z-]{4,40}$/.test(body.traceId) ? (body.traceId as string) : null;
	// a known marker maps to its fixed Arabic text first; then a raw code sent as the message
	const code = messageForBackendCode(bodyCode) || messageForBackendCode(serverMessage);
	const arabicServer = hasArabic(serverMessage) ? serverMessage : null;
	const fallback = options.fallback || 'تعذّر إكمال العملية ولم نتعرف على السبب، حاول مرة أخرى.';
	const traceSuffix = traceId ? ` (معرّف التتبع: ${traceId})` : '';

	const make = (kind: HttpErrorKind, title: string, message: string, extra: Partial<MappedHttpError> = {}): MappedHttpError => ({
		kind, status, title, message, fieldErrors: {}, retryAfterSeconds: null, retryable: false, code: bodyCode, traceId, ...extra,
	});

	if (status === 0) {
		return make('network', 'تعذّر الاتصال', 'تعذّر الاتصال بالخادم. تحقق من اتصال الإنترنت ثم حاول مجددًا. إن كنت قد ضغطت «إرسال» قبل انقطاع الاتصال فقد يكون الطلب وصل: تحقق من الصفحة قبل تكراره.', { retryable: true, outcomeUnknown: true });
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
		return make('forbidden', 'غير مسموح', code || arabicServer || 'ليست لديك صلاحية لتنفيذ هذا الإجراء بهذا الحساب. تأكد من أنك تستخدم الحساب والدور المناسبين، أو تواصل مع الدعم إن كان هذا غير متوقع.');
	}

	if (status === 404) return make('not-found', 'غير موجود', code || arabicServer || 'لم يتم العثور على العنصر المطلوب. ربما حُذف أو تغيّر رابطه، أعد تحميل الصفحة أو ارجع إلى القائمة.');

	if (status === 409) {
		return make('conflict', 'تعارض', code || arabicServer || 'تغيّرت حالة هذا العنصر منذ تحميل الصفحة، أو أنه موجود مسبقًا. أعد تحميل الصفحة ثم أعد المحاولة.');
	}

	if (status === 413) {
		return make('payload', 'حجم كبير', arabicServer || STATUS_MESSAGES[413]);
	}

	if (status === 415) {
		return make('payload', 'نوع ملف غير مدعوم', arabicServer || STATUS_MESSAGES[415]);
	}

	if (status === 429) {
		const wait = waitSecondsFrom(e, serverMessage);
		// The Arabic server text already carries the wait; when it does not, the known wait is appended.
		const message = (arabicServer && wait && !/\d|ثانية|دقيقة|دقيقتين|ساعة|ساعتين/.test(arabicServer) ? `${arabicServer} (${formatWait(wait)})` : arabicServer)
			|| rateLimitSentence(wait);
		return make('rate-limit', 'محاولات كثيرة', message, { retryAfterSeconds: wait, retryEndsAt: parseRetryAfter(e), retryable: true });
	}

	// A deliberate 5xx from the backend (e.g. a verification service that is not available) carries its own Arabic explanation (and a trace id).
	if (status >= 500 && arabicServer && !/^(Internal Server Error|Bad Gateway|Service Unavailable|Gateway Time-?out)$/i.test(arabicServer)) return make('server', status === 503 ? 'الخدمة غير متاحة' : 'خطأ في الخادم', `${arabicServer}${traceId && arabicServer.includes(traceId) ? '' : traceSuffix}`, { retryable: true, outcomeUnknown: status !== 503 });

	// A gateway answer (502 / 503 / 504): the page of a proxy, not ours. 504 = no answer in time (the operation may have completed); 502 / 503 = the service is not reachable right now.
	if (status === 504) return make('server', 'لم يصل الرد في الوقت المناسب', 'لم يردّ الخادم في الوقت المناسب، فقد لا نعرف إن كانت العملية تمّت. تحقق من الصفحة قبل تكرارها.', { retryable: true, outcomeUnknown: true });
	if (status === 502 || status === 503) return make('server', 'الخدمة غير متاحة', 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل، وإن استمرت المشكلة تواصل مع الدعم.', { retryable: true });

	if (status >= 500) {
		return make('server', 'خطأ في الخادم', `تعذّر إكمال العملية بسبب خطأ غير متوقع من جهتنا. لا نستطيع تأكيد أن التغيير قد حُفظ، فتحقّق من الصفحة قبل تكرار العملية، وإن استمرت المشكلة تواصل مع الدعم${traceId ? ` وأرفق معرّف التتبع: ${traceId}` : ''}.`, { retryable: true, outcomeUnknown: true });
	}

	return make('unknown', 'تعذّر التنفيذ', code || arabicServer || fallback);
}
