import { ValidatorFn, Validators } from '@angular/forms';

/**
 * PayPal payout email (the only payout destination the platform supports for now).
 * Angular's built-in Validators.email accepts "a@b", so a stricter pattern (name@domain.tld) is added;
 * the backend still has the final say (updateProfileSchema.paypalPayoutEmail).
 */
export const PAYPAL_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const paypalEmailValidators: ValidatorFn[] = [
	Validators.required,
	Validators.email,
	Validators.pattern(PAYPAL_EMAIL_PATTERN),
];

/** Arabic message for the current error of a PayPal email control (null when valid). */
export function paypalEmailError(errors: Record<string, unknown> | null | undefined): string | null {
	if (!errors) return null;
	if (errors['required']) return 'بريد PayPal مطلوب';
	if (errors['email'] || errors['pattern']) return 'أدخل بريد PayPal صالحًا مثل name@example.com';
	return null;
}
