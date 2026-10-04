import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { applyServerFieldErrors, attemptSubmit, collectInvalidFields, focusFirstInvalid } from './form-helpers';
import { matchFieldsValidator } from './password.validator';

const makeForm = () => new FormGroup({
	details: new FormGroup({
		name: new FormControl('', Validators.required),
		city: new FormControl('', [Validators.required, Validators.minLength(2)]),
	}),
	email: new FormControl('x', Validators.email),
	pw: new FormControl('a'),
	pw2: new FormControl('b'),
	skipped: new FormControl({ value: '', disabled: true }, Validators.required),
}, { validators: matchFieldsValidator('pw', 'pw2') });

const LABELS = { name: 'الاسم', 'details.city': 'المدينة', email: 'البريد الإلكتروني' };

describe('collectInvalidFields', () => {
	it('lists invalid leaf controls in form order with Arabic label and reason, skipping disabled controls', () => {
		const items = collectInvalidFields(makeForm(), LABELS);
		expect(items.map(i => i.path)).toEqual(['details.name', 'details.city', 'email', '']);
		expect(items[0]).toEqual({ path: 'details.name', label: 'الاسم', message: 'الاسم مطلوب' });
		expect(items[1].label).toBe('المدينة');
		expect(items[2].message).toContain('بريدًا إلكترونيًا');
		// the cross-field (group) error is reported too, without a label
		expect(items[3]).toEqual({ path: '', label: '', message: 'القيمتان غير متطابقتين' });
	});

	it('is empty for a valid form', () => {
		expect(collectInvalidFields(new FormGroup({ a: new FormControl('ok', Validators.required) }))).toEqual([]);
	});
});

@Component({
	standalone: true,
	imports: [ReactiveFormsModule],
	template: `
		<form [formGroup]="form">
			<input id="a" formControlName="a">
			<input id="b" formControlName="b">
			<input id="c" formControlName="c">
		</form>`,
})
class HostComponent {
	form = new FormGroup({
		a: new FormControl('ok', Validators.required),
		b: new FormControl('', Validators.required),
		c: new FormControl({ value: '', disabled: true }, Validators.required),
	});
}

describe('attemptSubmit / focusFirstInvalid (DOM)', () => {
	it('marks everything touched, returns what is missing and focuses the first invalid control', () => {
		const f = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(HostComponent);
		f.detectChanges();
		const root = f.nativeElement as HTMLElement;
		const attempt = attemptSubmit(f.componentInstance.form, { root, labels: { b: 'الحقل ب' } });
		f.detectChanges();

		expect(attempt.valid).toBe(false);
		expect(attempt.missing.map(m => m.path)).toEqual(['b']); // c is disabled
		expect(f.componentInstance.form.get('b')!.touched).toBe(true);
		expect(f.componentInstance.form.get('a')!.touched).toBe(true);
		expect(root.querySelector('#b')).toBeTruthy();
	});

	it('focusFirstInvalid returns the first enabled invalid input, or null when none/no root', () => {
		const f = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(HostComponent);
		document.body.appendChild(f.nativeElement);
		f.detectChanges();
		f.componentInstance.form.markAllAsTouched();
		const el = focusFirstInvalid(f.nativeElement);
		expect(el?.id).toBe('b');
		expect(document.activeElement).toBe(el);
		f.componentInstance.form.get('b')!.setValue('x');
		f.detectChanges();
		expect(focusFirstInvalid(f.nativeElement)).toBeNull();
		expect(focusFirstInvalid(null)).toBeNull();
		f.nativeElement.remove();
	});

	it('a valid form returns valid:true and no missing items', () => {
		const form = new FormGroup({ a: new FormControl('x', Validators.required) });
		expect(attemptSubmit(form)).toEqual({ valid: true, missing: [] });
	});
});

describe('applyServerFieldErrors', () => {
	it('sets a server error on the matching (even nested) control, touches it, and reports unmatched fields', () => {
		const form = makeForm();
		const unmatched = applyServerFieldErrors(form, { city: 'المدينة غير مدعومة', ghost: 'x' });
		const city = form.get('details.city')!;
		expect(city.errors?.['server']).toBe('المدينة غير مدعومة');
		expect(city.touched).toBe(true);
		expect(unmatched).toEqual(['ghost']);
	});

	it('the server error disappears when the user edits the field', () => {
		const form = new FormGroup({ email: new FormControl('a@b.co', Validators.email) });
		applyServerFieldErrors(form, { email: 'مستخدم' });
		expect(form.get('email')!.errors?.['server']).toBe('مستخدم');
		form.get('email')!.setValue('c@d.co');
		expect(form.get('email')!.errors).toBeNull();
	});
});
