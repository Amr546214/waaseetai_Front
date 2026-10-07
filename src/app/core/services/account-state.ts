/** Backend wording for an account that cannot use the app right now (requireActiveUser 403s and the socket handshake refusal). */
export const ACCOUNT_BLOCKED_HTTP = /معطل|مراجعة الإيقاف/;
export const ACCOUNT_NOT_ACTIVE_CODE = 'ACCOUNT_NOT_ACTIVE';
export const ACCOUNT_NOT_ACTIVE_FALLBACK = 'حسابك غير نشط حاليًا، يرجى التواصل مع الدعم.';

/** True for a 403 whose message says the account is suspended / under suspension review. */
export const isAccountBlockedResponse = (status: number | undefined, message: unknown): boolean =>
	status === 403 && typeof message === 'string' && ACCOUNT_BLOCKED_HTTP.test(message);

/** The text to show for an account-state refusal: the backend's own Arabic message when it has one. */
export const accountBlockedText = (message: unknown): string => (typeof message === 'string' && /[\u0600-\u06FF]/.test(message) ? message : ACCOUNT_NOT_ACTIVE_FALLBACK);
