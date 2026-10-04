import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** The registration/reset password rule enforced by the backend (auth.schema.ts): 8+ chars, one uppercase letter, one digit. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Empty values pass (pair it with Validators.required). The error value says which rules fail so the UI can name them.
 */
export const strongPasswordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
	const v = control.value;
	if (v === null || v === undefined || v === '') return null;
	const s = String(v);
	const detail = { minLength: s.length < PASSWORD_MIN_LENGTH, uppercase: !/[A-Z]/.test(s), digit: !/[0-9]/.test(s) };
	return detail.minLength || detail.uppercase || detail.digit ? { strongPassword: detail } : null;
};

/** Group validator: `{ mismatch: true }` on the group when the two controls differ (both must be non-empty). */
export function matchFieldsValidator(controlName: string, otherName: string): ValidatorFn {
	return (group: AbstractControl): ValidationErrors | null => {
		const a = group.get(controlName)?.value;
		const b = group.get(otherName)?.value;
		return a && b && a !== b ? { mismatch: true } : null;
	};
}
