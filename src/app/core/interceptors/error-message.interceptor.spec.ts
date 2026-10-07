import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorMessageInterceptor } from './error-message.interceptor';
import { mapHttpError, messageForBackendCode } from '../forms/http-error';

// #18 — raw backend codes (and 413/415 bodies that are not ours) reach every screen as Arabic.
describe('errorMessageInterceptor', () => {
	let http: HttpClient;
	let ctrl: HttpTestingController;
	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([errorMessageInterceptor])), provideHttpClientTesting()] });
		http = TestBed.inject(HttpClient);
		ctrl = TestBed.inject(HttpTestingController);
	});
	afterEach(() => ctrl.verify());

	const fail = (status: number, body: any): any => {
		let caught: any;
		http.get('/api/x').subscribe({ error: e => (caught = e) });
		ctrl.expectOne('/api/x').flush(body, { status, statusText: 'err' });
		return caught;
	};

	it('a raw code in message becomes Arabic; the original (with its argument) is kept in rawMessage', () => {
		for (const [raw, expected] of [['REQUIRED_PROFILE_FIELDS', 'أكمل الحقول المطلوبة'], ['INVALID_URL:githubUrl', 'الروابط'], ['PROFILE_FIELD_TOO_LONG', 'أطول'], ['OTP_REQUIRED', 'رمز التحقق'], ['INVALID_IBAN', 'آيبان']] as const) {
			const err = fail(400, { success: false, message: raw });
			expect(err.error.message).toContain(expected);
			expect(err.error.message).not.toMatch(/^[A-Z_]+/);
			expect(err.error.rawMessage).toBe(raw);
			expect(err.status).toBe(400);
		}
	});

	it('mapHttpError on the translated error still names the right message (and a field-errors body is untouched)', () => {
		const err = fail(400, { success: false, message: 'REQUIRED_PROFILE_FIELDS' });
		expect(mapHttpError(err).message).toBe(messageForBackendCode('REQUIRED_PROFILE_FIELDS'));
		const withFields = fail(400, { success: false, message: 'بيانات غير صحيحة', errors: [{ field: 'agreements.terms', message: 'يجب الموافقة على الشروط والأحكام' }] });
		expect(withFields.error.rawMessage).toBeUndefined();
		expect(mapHttpError(withFields).fieldErrors['terms']).toBe('يجب الموافقة على الشروط والأحكام');
	});

	it('413 and 415 with a proxy page / non-Arabic body get a fixed Arabic message; an Arabic backend message is kept', () => {
		expect(fail(413, '<html><body>413 Request Entity Too Large</body></html>').error.message).toContain('أكبر من الحد المسموح');
		expect(fail(415, { message: 'Unsupported Media Type' }).error.message).toContain('نوع الملف غير مدعوم');
		expect(fail(413, { message: 'حجم الملف أكبر من الحد المسموح' }).error.message).toBe('حجم الملف أكبر من الحد المسموح');
	});

	it('other errors pass through unchanged (409 generic Arabic, 500 English)', () => {
		const dup = fail(409, { success: false, message: 'تعذر حفظ رقم الجوال، تأكد من الرقم أو جرّب رقمًا آخر' });
		expect(dup.error.message).toBe('تعذر حفظ رقم الجوال، تأكد من الرقم أو جرّب رقمًا آخر');
		expect(mapHttpError(dup).message).toBe('تعذر حفظ رقم الجوال، تأكد من الرقم أو جرّب رقمًا آخر');
		expect(fail(500, { message: 'Internal Server Error' }).error.message).toBe('Internal Server Error');
	});
});

describe('mapHttpError: new backend statuses', () => {
	it('413 / 415 / 409 / 400 give Arabic messages', () => {
		expect(mapHttpError({ status: 413, error: '<html>' }).message).toContain('أكبر من الحد المسموح');
		expect(mapHttpError({ status: 415, error: { message: 'x' } }).message).toContain('نوع الملف غير مدعوم');
		expect(mapHttpError({ status: 415, error: { message: 'نوع الملف غير مسموح به' } }).message).toBe('نوع الملف غير مسموح به');
		expect(mapHttpError({ status: 409, error: { message: 'هذه القيمة مستخدمة مسبقًا، يرجى اختيار قيمة أخرى' } }).message).toBe('هذه القيمة مستخدمة مسبقًا، يرجى اختيار قيمة أخرى');
		expect(mapHttpError({ status: 400, error: { message: 'صيغة الطلب غير صحيحة (JSON غير صالح)' } }).message).toBe('صيغة الطلب غير صحيحة (JSON غير صالح)');
	});
	it('every raw code the backend throws has an Arabic text', () => {
		for (const c of ['OTP_REQUIRED', 'INVALID_IBAN', 'SESSION_NOT_FOUND', 'REQUEST_NOT_PENDING_REVIEW', 'PASSWORD_FIELDS_REQUIRED', 'INVALID_OR_EXPIRED_OTP', 'INVALID_BANK_NAME', 'INVALID_ACCOUNT_HOLDER', 'CANNOT_REVOKE_CURRENT_SESSION', 'AUDIT_LOG_NOT_FOUND', 'WEAK_PASSWORD', 'INVALID_PHONE', 'INVALID_EMAIL', 'PHONE_ALREADY_USED', 'EMAIL_ALREADY_USED']) {
			expect(messageForBackendCode(c), c).toMatch(/[؀-ۿ]/);
		}
	});
});
