import { AuthResponse } from '../models/auth.model';
import { formatWait } from './http-error';

/**
 * What the user may be told about an activation-code email. "sent" is claimed ONLY when the backend says
 * `emailSent === true`; anything else never says a code was sent, and never starts a resend countdown.
 */
export const OTP_SENT_MESSAGE = 'تم إرسال رمز التحقق إلى بريدك';
/**
 * Shown on the code step after EVERY registration request (the answer is identical for a new and an in-use address, so the page cannot know
 * which one it was): it claims no code and no account state. The code step is for whoever received a code; the links are for the rest.
 */
export const REGISTER_CODE_STEP_MESSAGE = 'إن كان بريدك بحاجة إلى تفعيل فقد أرسلنا إليه رمز التحقق. أدخله هنا، أو اطلب رمزًا جديدًا إن لم يصلك.';
/** Resend from the registration code step is a generic always-200 answer: it claims only a condition. */
export const REGISTER_RESEND_MESSAGE = 'إن كان هناك حساب بانتظار التفعيل لهذا البريد فقد أرسلنا إليه رمزًا جديدًا';
/** Resend is unauthenticated and answers the same for every id: conditional wording as well. */
export const RESEND_SENT_MESSAGE = 'إذا كان الحساب بانتظار التفعيل فقد أرسلنا رمز التحقق إلى بريدك';
export const OTP_SEND_FAILED_MESSAGE = 'تعذر إرسال رمز التحقق، حاول مرة أخرى بعد قليل أو تواصل مع الدعم';
export const UNVERIFIED_NEUTRAL_MESSAGE = 'حسابك غير مفعّل بعد. أدخل رمز التحقق المرسل إلى بريدك أو اطلب رمزًا جديدًا.';

export interface OtpNotice {
	/** True only when the backend confirmed the email went out. Gates the "sent" wording AND the resend countdown. */
	sent: boolean;
	message: string;
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
	return sent ? { sent: true, message: RESEND_SENT_MESSAGE } : { sent: false, message: OTP_SEND_FAILED_MESSAGE };
}
