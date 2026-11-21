import { ChangeDetectionStrategy, Component, forwardRef, input, signal, computed } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { MIN_AGE_YEARS } from '../../core/forms/birth-date';

export const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'] as const;
const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate();

/**
 * A date of birth as three Arabic drop-downs (day / month / year) instead of the browser's native date box, whose localized placeholder showed with its letters
 * mirrored («ةنس/رهش/موي») in a right-to-left page. The form value is the same ISO string ("1990-05-17") the native box produced, and '' while the date is empty.
 * A half-filled date is reported as an error (`birthDatePartial`) instead of silently being ignored; an impossible one (31 February) as `birthDate`.
 */
@Component({
	selector: 'ws-birth-date-field',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [
		{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => BirthDateFieldComponent), multi: true },
		{ provide: NG_VALIDATORS, useExisting: forwardRef(() => BirthDateFieldComponent), multi: true },
	],
	template: `
		<div class="ws-bdf" dir="rtl" role="group" [attr.aria-label]="label()" data-testid="birth-date-field">
			<select [id]="inputId()" [class]="inputClass()" [disabled]="disabled()" (change)="setDay($any($event.target).value)" (blur)="touched()" aria-label="اليوم" data-testid="birth-day" [attr.aria-required]="required() ? 'true' : null">
				<option value="">اليوم</option>
				@for (d of dayOptions(); track d) { <option [value]="d" [selected]="d === day()">{{ d }}</option> }
			</select>
			<select [class]="inputClass()" [disabled]="disabled()" (change)="setMonth($any($event.target).value)" (blur)="touched()" aria-label="الشهر" data-testid="birth-month">
				<option value="">الشهر</option>
				@for (m of months; track m; let i = $index) { <option [value]="i + 1" [selected]="i + 1 === month()">{{ m }}</option> }
			</select>
			<select [class]="inputClass()" [disabled]="disabled()" (change)="setYear($any($event.target).value)" (blur)="touched()" aria-label="السنة" data-testid="birth-year">
				<option value="">السنة</option>
				@for (y of yearOptions(); track y) { <option [value]="y" [selected]="y === year()">{{ y }}</option> }
			</select>
		</div>
	`,
	styles: [`:host { display: block; } .ws-bdf { display: grid; grid-template-columns: 1fr 1.6fr 1.2fr; gap: 8px; } .ws-bdf select { min-width: 0; width: 100%; }`],
})
export class BirthDateFieldComponent implements ControlValueAccessor, Validator {
	/** id of the first drop-down, so a <label for> reaches the field */
	readonly inputId = input('');
	/** the same utility classes the sibling inputs of the page use */
	readonly inputClass = input('');
	readonly label = input('تاريخ الميلاد');
	readonly required = input(false);
	/** earliest year offered */
	readonly minYear = input(1900);

	readonly months = ARABIC_MONTHS;
	readonly day = signal<number | null>(null);
	readonly month = signal<number | null>(null);
	readonly year = signal<number | null>(null);
	readonly disabled = signal(false);

	/** newest selectable year: the youngest accepted age */
	private readonly newestYear = new Date().getFullYear() - MIN_AGE_YEARS;
	readonly yearOptions = computed(() => { const out: number[] = []; for (let y = this.newestYear; y >= this.minYear(); y--) out.push(y); return out; });
	readonly dayOptions = computed(() => Array.from({ length: this.year() && this.month() ? daysIn(this.year()!, this.month()!) : 31 }, (_, i) => i + 1));

	private onChange: (v: string) => void = () => {};
	private onTouched: () => void = () => {};
	private onValidatorChange: () => void = () => {};

	writeValue(value: unknown): void {
		const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
		this.year.set(m ? Number(m[1]) : null); this.month.set(m ? Number(m[2]) : null); this.day.set(m ? Number(m[3]) : null);
	}
	registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
	registerOnTouched(fn: () => void): void { this.onTouched = fn; }
	registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }
	setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
	touched(): void { this.onTouched(); }

	setDay(v: string): void { this.day.set(v ? Number(v) : null); this.emit(); }
	setMonth(v: string): void { this.month.set(v ? Number(v) : null); this.emit(); }
	setYear(v: string): void { this.year.set(v ? Number(v) : null); this.emit(); }

	private emit(): void {
		const d = this.day(), m = this.month(), y = this.year();
		// a day that does not exist in the chosen month/year (31 February) is dropped from the choice, so the date stays valid
		let day = d;
		if (day && y && m && day > daysIn(y, m)) { day = daysIn(y, m); this.day.set(day); }
		this.onChange(day && m && y ? `${y}-${pad(m)}-${pad(day)}` : '');
		this.onValidatorChange();
	}

	validate(_control: AbstractControl): ValidationErrors | null {
		const filled = [this.day(), this.month(), this.year()].filter(v => v !== null).length;
		return filled === 0 || filled === 3 ? null : { birthDatePartial: true };
	}
}
