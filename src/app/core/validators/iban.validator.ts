import { AbstractControl, ValidationErrors } from '@angular/forms';

// Standard ISO 13616 IBAN structure + mod-97 checksum (the real validity
// check — a wrong-but-well-formed IBAN, e.g. two swapped digits, still
// fails this). Previously defined only inside provider-overview's own
// profile/data/data.ts as a private `ibanValidator` — extracted here so it
// can be shared with the marketer/affiliate forms (Phase 3 item 1: "تحقق
// متسق مع البيانات المدعومة"), and reattached to the provider's own
// bankingForm.ibanNumber control, which defined this exact function but
// never actually attached it to the control (Validators.required only).
export function ibanValidator(control: AbstractControl): ValidationErrors | null {
	const iban = String(control.value || '').replace(/\s/g, '').toUpperCase();
	if (!iban) return null; // presence is Validators.required's job, not this one's
	if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return { iban: true };
	const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
	const numeric = rearranged.replace(/[A-Z]/g, char => String(char.charCodeAt(0) - 55));
	let remainder = 0;
	for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
	return remainder === 1 ? null : { iban: true };
}
