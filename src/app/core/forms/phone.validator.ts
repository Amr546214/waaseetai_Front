import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Backend rule for `phoneNumber` (auth.schema.ts): digits only, at least 9 digits. */
export const PHONE_MIN_DIGITS = 9;

/** Digits only: strips the spaces/dashes the phone input adds while formatting. */
export function phoneDigits(value: unknown): string {
	return String(value ?? '').replace(/\D/g, '');
}

/**
 * For the app-phone-input value ({ number, dialCode, ... }) or a plain string. Empty passes (pair with
 * Validators.required). Fails with `phoneDigits` when fewer than 9 digits, which the backend would reject.
 */
export const backendPhoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
	const raw = control.value;
	const number = raw && typeof raw === 'object' ? (raw as any).number : raw;
	if (number === null || number === undefined || number === '') return null;
	const actualLength = phoneDigits(number).length;
	return actualLength < PHONE_MIN_DIGITS ? { phoneDigits: { requiredLength: PHONE_MIN_DIGITS, actualLength } } : null;
};
