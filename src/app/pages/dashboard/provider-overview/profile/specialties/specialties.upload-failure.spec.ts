import { Specialties } from './specialties';

// "Nothing was saved" is only said when the server refused the upload; a lost answer says the outcome is unknown and that repeating is safe (the upload replaces the samples).
describe('specialties samples upload failure text', () => {
	const text = (err: any) => (Specialties.prototype as any).uploadFailureText.call({}, err) as string;
	it('network loss / gateway / unexpected 5xx: unknown outcome, repeat is safe', () => {
		for (const err of [{ status: 0, error: null }, { status: 504, error: null }, { status: 500, error: { code: 'INTERNAL_ERROR', traceId: 'ab12cd34', message: 'حدث خطأ غير متوقع من جهتنا.' } }]) {
			const t = text(err);
			expect(t).toContain('قبل أن نعرف إن كانت النماذج حُفظت');
			expect(t).toContain('بأمان');
			expect(t).not.toContain('لم يُحفظ أي نموذج');
		}
	});
	it('a server refusal keeps its own reason', () => {
		expect(text({ status: 400, error: { message: 'حجم الملف أكبر من الحد المسموح' } })).toBe('حجم الملف أكبر من الحد المسموح');
	});
});
