import { resendNotice, OTP_SEND_FAILED_MESSAGE, RESEND_SENT_MESSAGE } from './otp-delivery';

// A resend answered with a WAIT (emailSent:false + retryAfterSeconds) is not a mail failure: the earlier code still works. Found on the deployed screen
// (it showed «تعذر إرسال رمز التحقق» for a throttled resend).
describe('resendNotice: wait versus failure', () => {
	it('sent', () => expect(resendNotice({ success: true, emailSent: true } as any)).toEqual({ sent: true, message: RESEND_SENT_MESSAGE }));
	it('throttled (top level or in data): says the earlier code still works and how long to wait, not that the mail failed', () => {
		for (const res of [{ success: true, emailSent: false, retryAfterSeconds: 45 }, { success: true, data: { emailSent: false, retryAfterSeconds: 45 } }]) {
			const n = resendNotice(res as any);
			expect(n.sent).toBe(false);
			expect(n.message).toContain('الرمز السابق');
			expect(n.message).toContain('45');
			expect(n.message).not.toBe(OTP_SEND_FAILED_MESSAGE);
		}
	});
	it('a real failure (no wait) keeps the failure wording, and nothing is claimed for an empty answer', () => {
		expect(resendNotice({ success: true, emailSent: false } as any).message).toBe(OTP_SEND_FAILED_MESSAGE);
		expect(resendNotice(null).message).toBe(OTP_SEND_FAILED_MESSAGE);
	});
});
