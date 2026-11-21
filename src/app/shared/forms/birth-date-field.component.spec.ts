import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { BirthDateFieldComponent } from './birth-date-field.component';
import { birthDateValidator } from '../../core/forms/birth-date';

@Component({ standalone: true, imports: [ReactiveFormsModule, BirthDateFieldComponent], template: `<form [formGroup]="form"><ws-birth-date-field formControlName="dob" inputId="d" /></form>` })
class Host { form = new FormBuilder().group({ dob: ['', [birthDateValidator]] }); }

describe('BirthDateFieldComponent (day / month / year drop-downs)', () => {
	const make = () => { const f = TestBed.createComponent(Host); f.detectChanges(); return f; };
	const sel = (f: any, id: string) => f.nativeElement.querySelector(`[data-testid=${id}]`) as HTMLSelectElement;
	const pick = (f: any, id: string, value: string) => { const s = sel(f, id); s.value = value; s.dispatchEvent(new Event('change')); f.detectChanges(); };
	const ctl = (f: any) => f.componentInstance.form.get('dob');
	const YEAR = String(new Date().getFullYear() - 30);

	it('shows Arabic labels (يوم / شهر / سنة) and month names, and the first drop-down carries the id for <label for>', () => {
		const f = make();
		expect(f.nativeElement.querySelector('#d')).toBe(sel(f, 'birth-day'));
		expect(f.nativeElement.textContent).toContain('اليوم'); expect(f.nativeElement.textContent).toContain('الشهر'); expect(f.nativeElement.textContent).toContain('السنة');
		expect(f.nativeElement.textContent).toContain('يناير'); expect(f.nativeElement.textContent).toContain('ديسمبر');
		expect(f.nativeElement.querySelector('input[type=date]')).toBeNull();
	});
	it('picking all three gives the ISO date; the form value is empty until then', () => {
		const f = make();
		expect(ctl(f).value).toBe('');
		pick(f, 'birth-year', YEAR); pick(f, 'birth-month', '5'); expect(ctl(f).value).toBe('');
		pick(f, 'birth-day', '17'); expect(ctl(f).value).toBe(`${YEAR}-05-17`); expect(ctl(f).valid).toBe(true);
	});
	it('a half-filled date is an error (birthDatePartial), not silently ignored; an empty one is fine (optional field)', () => {
		const f = make();
		expect(ctl(f).valid).toBe(true);
		pick(f, 'birth-year', YEAR); expect(ctl(f).errors).toEqual({ birthDatePartial: true });
		pick(f, 'birth-year', ''); expect(ctl(f).valid).toBe(true);
	});
	it('31 February is not possible: the day is moved to the last day of that month', () => {
		const f = make();
		pick(f, 'birth-year', '1990'); pick(f, 'birth-month', '1'); pick(f, 'birth-day', '31'); expect(ctl(f).value).toBe('1990-01-31');
		pick(f, 'birth-month', '2'); expect(ctl(f).value).toBe('1990-02-28');
		expect(sel(f, 'birth-day').querySelectorAll('option').length).toBe(1 + 28);
	});
	it('a stored value is shown in the drop-downs; years start at today minus 10 and stop at 1900', () => {
		const f = make(); ctl(f).setValue('1985-03-09'); f.detectChanges();
		expect(sel(f, 'birth-day').value).toBe('9'); expect(sel(f, 'birth-month').value).toBe('3'); expect(sel(f, 'birth-year').value).toBe('1985');
		const years = Array.from(sel(f, 'birth-year').querySelectorAll('option')).map(o => o.value).filter(Boolean).map(Number);
		expect(years[0]).toBe(new Date().getFullYear() - 10); expect(years.at(-1)).toBe(1900);
	});
	it('disabled follows the control (a verified identity freezes the date)', () => {
		const f = make(); ctl(f).disable(); f.detectChanges();
		expect(sel(f, 'birth-day').disabled).toBe(true); expect(sel(f, 'birth-month').disabled).toBe(true); expect(sel(f, 'birth-year').disabled).toBe(true);
	});
});
