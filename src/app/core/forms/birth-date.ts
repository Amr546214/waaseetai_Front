import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Date of birth (optional): empty is fine; otherwise a real date, not in the future and not before 1900. */
export function birthDateValidator(control: AbstractControl): ValidationErrors | null {
	const v = String(control.value ?? '').trim();
	if (!v) return null;
	const d = new Date(v);
	if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() || d.getFullYear() < 1900) return { birthDate: true };
	return null;
}

/** A stored ISO date ("1990-05-17T00:00:00.000Z") -> the value of an <input type="date"> ("1990-05-17"); '' when missing/invalid. */
export function dobInputValue(stored: unknown): string {
	if (!stored) return '';
	const d = new Date(String(stored));
	return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** The same date for reading: "17/05/1990" (day/month/year, Latin digits, no timezone shift). */
export function dobDisplay(stored: unknown): string {
	const v = dobInputValue(stored);
	if (!v) return '';
	const [y, m, day] = v.split('-');
	return `${day}/${m}/${y}`;
}
