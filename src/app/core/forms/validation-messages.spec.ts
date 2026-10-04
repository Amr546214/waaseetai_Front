import { FormControl, Validators } from '@angular/forms';
import { passwordRulesMessage, validationMessage } from './validation-messages';
import { matchFieldsValidator, strongPasswordValidator } from './password.validator';
import { FormGroup } from '@angular/forms';

describe('validationMessage (Arabic validator messages)', () => {
	const errs = (v: any, ...validators: any[]) => new FormControl(v, validators).errors;

	it('returns null when there are no errors', () => {
		expect(validationMessage(null)).toBeNull();
		expect(validationMessage(undefined)).toBeNull();
	});

	it('required, with and without a label', () => {
		expect(validationMessage(errs('', Validators.required))).toBe('هذا الحقل مطلوب');
		expect(validationMessage(errs('', Validators.required), 'الاسم الأول')).toBe('الاسم الأول مطلوب');
	});

	it('email, minlength, maxlength, min, max, pattern', () => {
		expect(validationMessage(errs('not-an-email', Validators.email))).toContain('بريدًا إلكترونيًا صالحًا');
		expect(validationMessage(errs('ab', Validators.minLength(5)), 'الاسم')).toBe('الاسم يجب ألا تقل عن 5 أحرف');
		expect(validationMessage(errs('abcdef', Validators.maxLength(3)))).toBe('القيمة يجب ألا تزيد على 3 أحرف');
		expect(validationMessage(errs(1, Validators.min(300)), 'المبلغ')).toBe('المبلغ يجب ألا تقل عن 300');
		expect(validationMessage(errs(9, Validators.max(5)))).toBe('القيمة يجب ألا تزيد على 5');
		expect(validationMessage(errs('x', Validators.pattern(/^\d+$/)), 'الجوال')).toBe('صيغة الجوال غير صحيحة');
	});

	it('a server message wins over every other error', () => {
		expect(validationMessage({ required: true, server: 'البريد مستخدم' }, 'البريد')).toBe('البريد مستخدم');
	});

	it('custom keys: mismatch, iban, url; unknown key falls back', () => {
		expect(validationMessage({ mismatch: true })).toBe('القيمتان غير متطابقتين');
		expect(validationMessage({ iban: true })).toBe('أدخل رقم IBAN صالحًا');
		expect(validationMessage({ url: true })).toContain('http');
		expect(validationMessage({ weird: true }, 'الحقل')).toBe('الحقل غير صالح');
	});
});

describe('strongPasswordValidator (backend rule: 8+, uppercase, digit)', () => {
	const check = (v: string) => strongPasswordValidator(new FormControl(v));

	it('empty passes (required handles it)', () => {
		expect(check('')).toBeNull();
	});

	it('names exactly which rules fail', () => {
		expect(check('abcdefg1')?.['strongPassword']).toEqual({ minLength: false, uppercase: true, digit: false });
		expect(check('Abcdefgh')?.['strongPassword']).toEqual({ minLength: false, uppercase: false, digit: true });
		expect(check('Ab1')?.['strongPassword']).toEqual({ minLength: true, uppercase: false, digit: false });
		expect(check('Abcdefg1')).toBeNull();
	});

	it('the message lists only the unmet rules', () => {
		const msg = validationMessage(check('abcdefg1'));
		expect(msg).toContain('حرف إنجليزي كبير');
		expect(msg).not.toContain('رقم');
		expect(passwordRulesMessage()).toContain('8 أحرف');
	});

	it('matchFieldsValidator flags a mismatch on the group only when both are filled', () => {
		const g = new FormGroup({ a: new FormControl(''), b: new FormControl('') }, { validators: matchFieldsValidator('a', 'b') });
		expect(g.errors).toBeNull();
		g.patchValue({ a: 'x', b: 'y' });
		expect(g.errors).toEqual({ mismatch: true });
		g.patchValue({ b: 'x' });
		expect(g.errors).toBeNull();
	});
});
