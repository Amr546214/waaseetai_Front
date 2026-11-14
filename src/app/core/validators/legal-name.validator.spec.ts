import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { cleanLegalName, legalNameProblem, legalNameValidator } from './legal-name.validator';

describe('legal name validator (same rule as the backend)', () => {
	it('accepts a normal Arabic or Latin legal name', () => {
		expect(legalNameProblem('عمرو محمود')).toBeNull();
		expect(legalNameProblem('Amr Mahmoud-Ali')).toBeNull();
		expect(cleanLegalName('  عمرو   محمود ')).toBe('عمرو محمود');
	});
	it('refuses one word, digits, symbols and too-long values with a reason', () => {
		expect(legalNameProblem('عمرو')).toMatch(/جزأين/);
		expect(legalNameProblem('عمرو 2')).toMatch(/حروفًا/);
		expect(legalNameProblem('Amr @ Mahmoud')).toMatch(/حروفًا/);
		expect(legalNameProblem('أ'.repeat(70) + ' ' + 'ب'.repeat(70))).toMatch(/120/);
	});
	it('empty is left to the required validator; an invalid name sets the server-style message', () => {
		expect(legalNameValidator(new FormControl(''))).toBeNull();
		expect(legalNameValidator(new FormControl('عمرو'))).toEqual({ server: expect.stringContaining('جزأين') });
	});
});
