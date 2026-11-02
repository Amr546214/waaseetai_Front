import { EMAIL_DISABLED_BY_PLATFORM, CODE_MAIL_ALWAYS_NOTE, emailDisabledByPlatform, isEmailDisabledError } from './notification-preferences.service';

describe('optional e-mail: platform state helpers', () => {
	it('uses the exact owner wording', () => {
		expect(EMAIL_DISABLED_BY_PLATFORM).toBe('معطّل بواسطة إدارة المنصة');
		expect(CODE_MAIL_ALWAYS_NOTE).toContain('إيصالات العمليات ودعوات العقود ورموز الدخول والتفعيل والاستعادة تصل دائمًا');
	});
	it('is disabled only when the server says emailEnabled === false (missing field keeps today\'s behaviour)', () => {
		expect(emailDisabledByPlatform({ data: { platform: { emailEnabled: false } } })).toBe(true);
		expect(emailDisabledByPlatform({ data: { platform: { emailEnabled: true } } })).toBe(false);
		expect(emailDisabledByPlatform({ data: {} })).toBe(false);
		expect(emailDisabledByPlatform(null)).toBe(false);
	});
	it('recognises the stable 409 code', () => {
		expect(isEmailDisabledError({ status: 409, error: { code: 'EMAIL_CHANNEL_DISABLED_BY_PLATFORM' } })).toBe(true);
		expect(isEmailDisabledError({ status: 409, error: { code: 'OTHER' } })).toBe(false);
		expect(isEmailDisabledError(null)).toBe(false);
	});
});
