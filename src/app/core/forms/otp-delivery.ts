import { AuthResponse } from '../models/auth.model';
import { formatWait } from './http-error';

/**
 * What the user may be told about an activation-code email. "sent" is claimed ONLY when the backend says
 * `emailSent === true`; anything else never says a code was sent, and never starts a resend countdown.
 */
export const OTP_SENT_MESSAGE = 'تم إرسال رمز التحقق إلى بريدك';
export const OTP_SEND_FAILED_MESSAGE = 'تعذر إرسال رمز التحقق، حاول مرة أخرى بعد قليل أو تواصل مع الدعم';
export const REGISTER_NOT_SENT_MESSAGE = 'تم إنشاء الحساب، لكن تعذر إرسال رمز التحقق. حاول إعادة الإرسال بعد قليل.';
export const UNVERIFIED_NEUTRAL_MESSAGE = 'حسابك غير مفعّل بعد. أدخل رمز التحقق المرسل إلى بريدك أو اطلب رمزًا جديدًا.';

export interface OtpNotice {
	/** True only when the backend confirmed the email went out. Gates the "sent" wording AND the resend countdown. */
	sent: boolean;
	message: string;
}

/** POST /auth/register: the account exists either way; the notice says whether the code email went out. */
export function registerNotice(res: Pick<AuthResponse, 'data'> | null | undefined): OtpNotice {
	return res?.data?.emailSent === true
		? { sent: true, message: OTP_SENT_MESSAGE }
		: { sent: false, message: REGISTER_NOT_SENT_MESSAGE };
}

/** POST /auth/login for an ACTIVE account: the mandatory login code goes to the account email (never SMS). */
export function loginOtpNotice(data: AuthResponse['data'] | null | undefined): OtpNotice {
	if (data?.emailSent === true) return { sent: true, message: 'أرسلنا رمز تسجيل الدخول إلى بريدك الإلكتروني، أدخله لإكمال الدخول.' };
	const wait = data?.retryAfterSeconds;
	if (data?.emailSent === false && typeof wait === 'number' && wait > 0) {
		return { sent: false, message: `يمكنك استخدام الرمز السابق أو إعادة المحاولة بعد ${formatWait(wait)}.` };
	}
	return { sent: false, message: OTP_SEND_FAILED_MESSAGE };
}

/** POST /auth/login (or Google) for an account that is not verified yet. */
export function unverifiedLoginNotice(data: AuthResponse['data'] | null | undefined): OtpNotice {
	if (data?.emailSent === true) return { sent: true, message: 'حسابك غير مفعّل بعد. ' + OTP_SENT_MESSAGE + '، أدخله لإكمال التفعيل.' };
	const wait = data?.retryAfterSeconds;
	if (data?.emailSent === false && typeof wait === 'number' && wait > 0) {
		// The send was throttled: the code the user already has is still valid.
		return { sent: false, message: `يمكنك استخدام الرمز السابق أو إعادة المحاولة بعد ${formatWait(wait)}.` };
	}
	if (data?.emailSent === false) return { sent: false, message: OTP_SEND_FAILED_MESSAGE };
	return { sent: false, message: UNVERIFIED_NEUTRAL_MESSAGE };
}

/** POST /auth/resend-otp: `success:false` / `emailSent:false` means nothing went out. */
export function resendNotice(res: Pick<AuthResponse, 'success' | 'data'> & { emailSent?: boolean } | null | undefined): OtpNotice {
	const sent = res?.success === true && (res?.emailSent ?? res?.data?.emailSent) === true;
	return sent ? { sent: true, message: OTP_SENT_MESSAGE } : { sent: false, message: OTP_SEND_FAILED_MESSAGE };
}
