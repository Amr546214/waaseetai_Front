import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { fieldErrorsFromBody, formatWait, mapHttpError, messageForBackendCode } from './http-error';

const err = (status: number, body?: any, headers?: Record<string, string>) =>
	new HttpErrorResponse({ status, error: body, headers: headers ? new HttpHeaders(headers) : undefined });

describe('mapHttpError', () => {
	it('0 -> network, retryable, Arabic', () => {
		const m = mapHttpError(err(0));
		expect(m.kind).toBe('network');
		expect(m.retryable).toBe(true);
		expect(m.message).toContain('الاتصال');
	});

	it('400 with zod errors[] maps fields; one field -> its message, several -> summary', () => {
		const one = mapHttpError(err(400, { message: 'Validation Error', errors: [{ path: 'email', message: 'صيغة البريد غير صحيحة' }] }));
		expect(one.kind).toBe('backend-validation');
		expect(one.fieldErrors).toEqual({ email: 'صيغة البريد غير صحيحة' });
		expect(one.message).toBe('صيغة البريد غير صحيحة');

		const many = mapHttpError(err(400, { errors: [{ field: 'body.password', message: 'ضعيفة' }, { field: 'body.firstName', message: 'قصير' }] }));
		expect(Object.keys(many.fieldErrors).sort()).toEqual(['firstName', 'password']);
		expect(many.message).toContain('تصحيح الحقول');
	});

	it('400 with only the English "Validation Error" never shows English', () => {
		const m = mapHttpError(err(400, { message: 'Validation Error' }));
		expect(m.message).toContain('غير صالحة');
		expect(m.message).not.toMatch(/[A-Za-z]/);
	});

	it('400 with a raw backend code or an Arabic message', () => {
		expect(mapHttpError(err(400, { message: 'INVALID_URL:githubUrl' })).message).toContain('الروابط');
		expect(mapHttpError(err(400, { message: 'رمز التحقق غير صحيح' })).message).toBe('رمز التحقق غير صحيح');
	});

	it('422 behaves like 400', () => {
		expect(mapHttpError(err(422, { message: 'x' })).kind).toBe('backend-validation');
	});

	it('401: session by default, credentials when asked (wrong password is not "session expired")', () => {
		expect(mapHttpError(err(401, { message: 'Unauthorized' })).kind).toBe('session');
		const c = mapHttpError(err(401, { message: 'CURRENT_PASSWORD_INCORRECT' }), { unauthorizedIs: 'credentials' });
		expect(c.kind).toBe('credentials');
		expect(c.message).toBe('كلمة المرور الحالية غير صحيحة');
		expect(mapHttpError(err(401, {}), { unauthorizedIs: 'credentials' }).message).toContain('غير صحيحة');
	});

	it('403: pending-review vs forbidden', () => {
		const p = mapHttpError(err(403, { message: 'يرجى تفعيل حسابك أولاً باستخدام رمز التحقق (OTP)' }));
		expect(p.kind).toBe('pending-review');
		expect(mapHttpError(err(403, { message: 'Forbidden' })).kind).toBe('forbidden');
		expect(mapHttpError(err(403, { message: 'Forbidden' })).message).not.toMatch(/[A-Za-z]/);
	});

	it('404, 409, 413', () => {
		expect(mapHttpError(err(404)).kind).toBe('not-found');
		const c = mapHttpError(err(409, { message: 'البريد الإلكتروني أو رقم الجوال مسجل بالفعل' }));
		expect(c.kind).toBe('conflict');
		expect(c.message).toContain('مسجل بالفعل');
		expect(mapHttpError(err(413)).kind).toBe('payload');
	});

	it('429 reads Retry-After (seconds), then falls back to the English limiter text, and is always Arabic', () => {
		const a = mapHttpError(err(429, { message: 'Too many requests' }, { 'Retry-After': '120' }));
		expect(a.kind).toBe('rate-limit');
		expect(a.retryAfterSeconds).toBe(120);
		expect(a.message).toContain('دقيقتين');

		const b = mapHttpError(err(429, { message: 'Too many requests from this IP, please try again after 15 minutes' }));
		expect(b.retryAfterSeconds).toBe(900);
		expect(b.message).toContain('15 دقيقة');

		const c = mapHttpError(err(429, { message: 'Too many authentication attempts, please try again after an hour' }));
		expect(c.retryAfterSeconds).toBe(3600);
		expect(c.message).toContain('ساعة');

		const d = mapHttpError(err(429, { message: 'Too many requests' }));
		expect(d.retryAfterSeconds).toBeNull();
		expect(d.message).not.toMatch(/[A-Za-z]/);
		expect(mapHttpError(err(429, { message: 'تجاوز عدد المحاولات، اطلب رمزًا جديدًا' })).message).toBe('تجاوز عدد المحاولات، اطلب رمزًا جديدًا');
	});

	it('5xx never leaks "Internal Server Error"', () => {
		const m = mapHttpError(err(500, { message: 'Internal Server Error' }));
		expect(m.kind).toBe('server');
		expect(m.retryable).toBe(true);
		expect(m.message).not.toMatch(/[A-Za-z]/);
		expect(mapHttpError(err(503)).kind).toBe('server');
	});

	it('unknown shapes do not throw', () => {
		expect(mapHttpError(undefined).kind).toBe('network');
		expect(mapHttpError(new Error('boom')).kind).toBe('network');
		expect(mapHttpError(err(418, 'plain'), { fallback: 'مخصص' }).message).toBe('مخصص');
	});
});

describe('http-error helpers', () => {
	it('fieldErrorsFromBody keeps the last path segment and the first message per field', () => {
		expect(fieldErrorsFromBody({ errors: [{ path: 'body.email', message: 'a' }, { path: 'body.email', message: 'b' }, { path: ['body', 'x'], message: 'c' }] }))
			.toEqual({ email: 'a', x: 'c' });
		expect(fieldErrorsFromBody({})).toEqual({});
	});

	it('messageForBackendCode matches the code before ":"', () => {
		expect(messageForBackendCode('PHONE_ALREADY_USED')).toContain('الجوال');
		expect(messageForBackendCode('INVALID_URL:websiteUrl')).toContain('http');
		expect(messageForBackendCode('something else')).toBeNull();
	});

	it('formatWait', () => {
		expect(formatWait(30)).toBe('30 ثانية');
		expect(formatWait(60)).toBe('دقيقة');
		expect(formatWait(900)).toBe('15 دقيقة');
		expect(formatWait(3600)).toBe('ساعة');
		expect(formatWait(7200)).toBe('ساعتين');
	});
});

describe('mapHttpError: the BE error contract (code, trace id, honest unexpected-error message, gateway answers)', () => {
	const err = (status: number, error: any = null) => ({ status, error } as any);

	it('an unexpected 500 shows the honest message, the next step and the trace id; nothing else of the body', () => {
		const m = mapHttpError(err(500, { success: false, message: 'Invalid `prisma.x` invocation SELECT', code: 'INTERNAL_ERROR', traceId: 'A1B2C3D4', errors: ['stack...'] }));
		expect(m.kind).toBe('server'); expect(m.code).toBe('INTERNAL_ERROR'); expect(m.traceId).toBe('A1B2C3D4');
		expect(m.message).toContain('لا نستطيع تأكيد أن التغيير قد حُفظ'); expect(m.message).toContain('A1B2C3D4');
		expect(m.message).not.toMatch(/prisma|SELECT|stack/); expect(m.retryable).toBe(true); expect(m.outcomeUnknown).toBe(true);
	});

	it('the server\'s own Arabic 5xx text keeps its wording and gets the trace id appended exactly once (even if the text already says «معرّف التتبع» as an instruction)', () => {
		const m = mapHttpError(err(500, { message: 'تعذّر إكمال العملية بسبب خطأ غير متوقع من جهتنا. تواصل مع الدعم وأرفق معرّف التتبع.', code: 'INTERNAL_ERROR', traceId: 'AAAA1111' }));
		expect(m.message.startsWith('تعذّر إكمال العملية بسبب خطأ غير متوقع من جهتنا')).toBe(true);
		expect(m.message.match(/AAAA1111/g)?.length).toBe(1);
		const again = mapHttpError(err(500, { message: 'خطأ. معرّف التتبع: AAAA1111', traceId: 'AAAA1111' }));
		expect(again.message.match(/AAAA1111/g)?.length).toBe(1);
	});

	it('a trace-id that is not a plain token is ignored (never rendered)', () => {
		expect(mapHttpError(err(500, { traceId: '<script>alert(1)</script>' })).traceId).toBeNull();
	});

	it('gateway answers: 504 says the outcome may be unknown; 502 / 503 say the service is not reachable; neither shows a proxy page', () => {
		const t = mapHttpError(err(504, '<html>Gateway Time-out</html>')); expect(t.message).toContain('لا نعرف إن كانت العملية تمّت'); expect(t.outcomeUnknown).toBe(true);
		for (const s of [502, 503]) { const m = mapHttpError(err(s, '<html>Bad Gateway</html>')); expect(m.message).toContain('الخدمة غير متاحة مؤقتًا'); expect(m.message).not.toMatch(/html|Bad Gateway/i); expect(m.retryable).toBe(true); }
	});

	it('a deliberate Arabic 503 (e.g. a verification service that is down) keeps its own explanation', () => {
		const m = mapHttpError(err(503, { message: 'خدمة التحقق غير متاحة حاليًا، حاول لاحقًا', traceId: 'BBBB2222' }));
		expect(m.message).toContain('خدمة التحقق غير متاحة حاليًا'); expect(m.message).toContain('BBBB2222'); expect(m.outcomeUnknown).toBe(false);
	});

	it('network: says what to do, and that a request that was just sent may have arrived (check before repeating)', () => {
		const m = mapHttpError(err(0)); expect(m.kind).toBe('network'); expect(m.message).toContain('تحقق من اتصال الإنترنت'); expect(m.message).toContain('قد يكون الطلب وصل'); expect(m.outcomeUnknown).toBe(true);
	});

	it('a known marker maps to its Arabic text even when the message is a raw code; field errors keep the right field name', () => {
		expect(mapHttpError(err(409, { code: 'REQUEST_ALREADY_PENDING', message: 'REQUEST_ALREADY_PENDING' })).message).toContain('لديك طلب قيد مراجعة الإدارة');
		const v = mapHttpError(err(400, { message: 'بيانات غير صالحة', errors: [{ field: 'identity.frontId', message: 'صورة الهوية مطلوبة' }] }));
		expect(v.fieldErrors).toEqual({ frontId: 'صورة الهوية مطلوبة' });
	});

	it('default texts for 403 / 404 / 409 / unknown name the next step instead of a bare refusal', () => {
		expect(mapHttpError(err(403)).message).toContain('تواصل مع الدعم'); expect(mapHttpError(err(404)).message).toContain('أعد تحميل الصفحة'); expect(mapHttpError(err(409)).message).toContain('أعد تحميل الصفحة'); expect(mapHttpError(err(418)).message).toContain('حاول مرة أخرى');
	});
});
