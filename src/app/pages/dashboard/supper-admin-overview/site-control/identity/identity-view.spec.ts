import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { describeFailure } from './identity-view';

const err = (status: number, error: unknown) => new HttpErrorResponse({ status, error });
const REJECT = 'SITE_IDENTITY_FILE_REJECTED';

// owner report 2026-10-28: a rejected design-token VALUE must not tell the admin to «choose another file»
describe('describeFailure: a rejected value is not a rejected file', () => {
	it('a token VALUE (errors[0].field = "value") says «القيمة» and asks to correct the value, never to choose another file', () => {
		const f = describeFailure(err(400, { code: REJECT, errors: [{ field: 'value', name: '--teal', reason: 'BAD_COLOR', message: 'لون غير صالح. المسموح: #rgb' }] }), 'التحقق من القيم');
		expect(f.kind).toBe('rejected');
		expect(f.message).toContain('رفض الخادم القيمة'); expect(f.message).toContain('--teal'); expect(f.message).toContain('لون غير صالح'); expect(f.message).toContain('صحّح القيمة');
		expect(f.message).not.toContain('ملفًا آخر'); expect(f.message).not.toContain('الملف');
	});
	it('the token name is not repeated when the server message already names it', () => {
		const f = describeFailure(err(400, { code: REJECT, errors: [{ field: 'value', name: '--pg', message: '«لون الخلفية العامة (--pg): لون غير صالح.»' }] }), 'x');
		expect(f.message.match(/--pg/g)!.length).toBe(1);
	});
	it('an uploaded FILE (field "file") keeps the file wording', () => {
		const f = describeFailure(err(400, { code: REJECT, errors: [{ field: 'file', reason: 'FORMAT_NOT_ALLOWED', message: 'الصيغة غير مسموحة.' }] }), 'رفع');
		expect(f.message).toContain('رفض الخادم الملف'); expect(f.message).toContain('اختر ملفًا آخر');
	});
	it('413 stays a file problem', () => { expect(describeFailure(err(413, {}), 'رفع').message).toContain('اختر ملفًا آخر'); });
});
