import { FormControl } from '@angular/forms';
import { backendPhoneValidator, phoneDigits } from './phone.validator';
import { validationMessage } from './validation-messages';

describe('backendPhoneValidator (backend: digits only, 9+)', () => {
	const run = (v: any) => backendPhoneValidator(new FormControl(v));

	it('empty passes (required handles it)', () => {
		expect(run('')).toBeNull();
		expect(run(null)).toBeNull();
	});

	it('counts digits of the phone-input value, ignoring formatting', () => {
		expect(run({ number: '55 123 4567' })).toBeNull();
		expect(run({ number: '5512' })?.['phoneDigits']).toEqual({ requiredLength: 9, actualLength: 4 });
		expect(run('0551234567')).toBeNull();
	});

	it('message is Arabic and states the minimum', () => {
		expect(validationMessage(run({ number: '123' }))).toBe('رقم الجوال يجب أن يتكون من 9 أرقام على الأقل');
		expect(validationMessage({ invalidPhone: true })).toContain('جوال');
	});

	it('phoneDigits strips everything but digits', () => {
		expect(phoneDigits('+966 55-123 4567')).toBe('966551234567');
		expect(phoneDigits(undefined)).toBe('');
	});
});
