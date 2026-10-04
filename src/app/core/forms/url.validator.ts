import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Optional http(s) URL (empty passes; pair with Validators.required when mandatory). Error key `url`, which
 * validationMessage() already words in Arabic. Matches what the backend's zod `.url()` accepts for the profile links,
 * and is stricter on the scheme (http/https only).
 */
export const httpUrlValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
	const v = control.value;
	if (v === null || v === undefined || String(v).trim() === '') return null;
	try {
		const u = new URL(String(v).trim());
		return u.protocol === 'http:' || u.protocol === 'https:' ? null : { url: true };
	} catch {
		return { url: true };
	}
};
