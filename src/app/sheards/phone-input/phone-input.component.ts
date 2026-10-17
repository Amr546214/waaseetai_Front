import {
	Component,
	DoCheck,
	ElementRef,
	forwardRef,
	HostListener,
	Input,
	OnInit,
	ViewChild,
	ViewEncapsulation,
} from '@angular/core';
import {
	ControlValueAccessor,
	NG_VALIDATORS,
	NG_VALUE_ACCESSOR,
	ValidationErrors,
	Validator,
	AbstractControl,
	ReactiveFormsModule,
	FormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { splitPhoneInput } from '../../core/forms/phone-countries';
import {
	getCountries,
	getCountryCallingCode,
	parsePhoneNumberFromString,
	CountryCode,
	AsYouType,
} from 'libphonenumber-js/mobile';

export interface PhoneValue {
	countryCode: CountryCode;
	dialCode: string;
	number: string; // raw local number typed by user
	e164Number: string; // full E.164 e.g. +966501234567
}

interface CountryOption {
	code: CountryCode;
	name: string;
	dialCode: string;
	flag: string;
}

// Build a sorted country list once at module level (performance)
const ALL_COUNTRIES: CountryOption[] = getCountries()
	.map((code) => ({
		code,
		name: new Intl.DisplayNames(['ar', 'en'], { type: 'region' }).of(code) ?? code,
		dialCode: '+' + getCountryCallingCode(code),
		flag: getFlagEmoji(code),
	}))
	.sort((a, b) => a.name.localeCompare(b.name));

function getFlagEmoji(countryCode: string): string {
	return countryCode
		.toUpperCase()
		.split('')
		.map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
		.join('');
}

@Component({
	selector: 'app-phone-input',
	templateUrl: './phone-input.component.html',
	styleUrls: ['./phone-input.component.scss'],
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, FormsModule],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => PhoneInputComponent),
			multi: true,
		},
		{
			provide: NG_VALIDATORS,
			useExisting: forwardRef(() => PhoneInputComponent),
			multi: true,
		},
	],
})
export class PhoneInputComponent implements ControlValueAccessor, Validator, OnInit, DoCheck {
	@ViewChild('phoneField') private phoneField?: ElementRef<HTMLInputElement>;

	@Input() placeholder = 'رقم الجوال';
	@Input() preferredCountries: CountryCode[] = ['SA', 'AE', 'KW', 'QA', 'BH', 'OM'];
	@Input() defaultCountry: CountryCode = 'SA';
	/** When true an empty value is valid (the field is optional); a non-empty value must still be a valid number. */
	@Input() optional = false;

	countries: CountryOption[] = ALL_COUNTRIES;
	selectedCountry: CountryOption = ALL_COUNTRIES.find(c => c.code === 'SA') || ALL_COUNTRIES[0];
	phoneNumber = '';
	isDisabled = false;

	isOpen = false;
	searchTerm = '';

	get filteredCountries(): CountryOption[] {
		if (!this.searchTerm.trim()) return this.countries;
		const term = this.searchTerm.toLowerCase().trim();
		return this.countries.filter((c) =>
			c.name.toLowerCase().includes(term) ||
			c.dialCode.includes(term) ||
			c.code.toLowerCase().includes(term)
		);
	}

	get dynamicPlaceholder(): string {
		const map: Record<string, string> = {
			'SA': '5XXXXXXXX',
			'AE': '5X XXX XXXX',
			'KW': 'X XXXX XXX',
			'BH': '3X XX XXXX',
			'QA': '3XXX XXXX',
			'OM': '9X XXX XXX'
		};
		return map[this.selectedCountry?.code] || 'XXXXXXXXX';
	}

	private onChange: (val: PhoneValue | null) => void = () => { };
	private onTouched: () => void = () => { };

	constructor(private elementRef: ElementRef) { }

	/**
	 * The form-level helpers (focus first invalid, aria-invalid sync) address the <app-phone-input formControlName> host:
	 * the host is programmatically focusable and hands the focus to the real number box, and the invalid state the form
	 * puts on the host is mirrored on that box so a screen reader announces it where the cursor is.
	 */
	@HostListener('focus') onHostFocus(): void { this.focusField(); }

	focusField(): void { this.phoneField?.nativeElement.focus(); }

	ngDoCheck(): void {
		const host = this.elementRef.nativeElement as HTMLElement;
		const inner = this.phoneField?.nativeElement;
		if (!host || !inner) return;
		if (host.getAttribute('tabindex') === null) host.setAttribute('tabindex', '-1');
		const invalid = host.getAttribute('aria-invalid');
		if (invalid) inner.setAttribute('aria-invalid', invalid); else inner.removeAttribute('aria-invalid');
		const desc = host.getAttribute('aria-describedby');
		if (desc) inner.setAttribute('aria-describedby', desc); else inner.removeAttribute('aria-describedby');
	}

	ngOnInit(): void {
		const preferred = this.preferredCountries
			.map((c) => ALL_COUNTRIES.find((x) => x.code === c))
			.filter(Boolean) as CountryOption[];

		const rest = ALL_COUNTRIES.filter(
			(c) => !this.preferredCountries.includes(c.code)
		);

		this.countries = [...preferred, ...rest];
		
		if (this.selectedCountry) {
			const found = this.countries.find(c => c.code === this.selectedCountry.code);
			if (found) this.selectedCountry = found;
		} else {
			this.selectedCountry = this.countries.find((c) => c.code === this.defaultCountry) ?? this.countries[0];
		}
	}

	@HostListener('document:click', ['$event'])
	onDocumentClick(event: MouseEvent): void {
		const target = event.target as HTMLElement;
		if (this.isOpen && !this.elementRef.nativeElement.contains(target)) {
			this.isOpen = false;
		}
	}

	toggleDropdown(event?: Event): void {
		if (event) event.stopPropagation();
		if (this.isDisabled) return;
		this.isOpen = !this.isOpen;
		if (this.isOpen) {
			this.searchTerm = '';
		}
	}

	selectCountry(country: CountryOption, event?: Event): void {
		if (event) event.stopPropagation();
		this.selectedCountry = country;
		this.isOpen = false;
		this.emitValue();
	}

	// ─── ControlValueAccessor ───────────────────────────────────
	writeValue(val: PhoneValue | string | null): void {
		if (!val) {
			this.phoneNumber = '';
			return;
		}
		if (typeof val === 'string') {
			const parsed = parsePhoneNumberFromString(val);
			if (parsed && parsed.country) {
				const country = this.countries.find((c) => c.code === parsed.country);
				if (country) this.selectedCountry = country;
				this.phoneNumber = parsed.nationalNumber as string;
			}
		} else {
			if (val.countryCode) {
				const country = this.countries.find((c) => c.code === val.countryCode);
				if (country) this.selectedCountry = country;
			}
			this.phoneNumber = val.number || '';
		}
	}

	registerOnChange(fn: (val: PhoneValue | null) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.isDisabled = isDisabled;
	}

	// ─── Validator ──────────────────────────────────────────────
	validate(_control: AbstractControl): ValidationErrors | null {
		if (!this.phoneNumber) return this.optional ? null : { required: true };
		const parsed = parsePhoneNumberFromString(
			this.phoneNumber,
			this.selectedCountry.code
		);
		if (!parsed || !parsed.isValid()) return { invalidPhone: true };
		return null;
	}

	// ─── Internal handlers ──────────────────────────────────────
	onPhoneInput(event: Event): void {
		const input = event.target as HTMLInputElement;
		let val = input.value;

		// A full number typed or pasted with its country code ("+201025073026", "201025073026"): split it, pick the matching country and keep the LOCAL number only.
		const typed = val.replace(/[\s()-]/g, '');
		if (/^\+?\d{8,}$/.test(typed) && (typed.startsWith('+') || !val.startsWith('0'))) {
			const split = splitPhoneInput(typed, this.selectedCountry.dialCode);
			if (split) {
				const target = this.countries.find((c) => c.dialCode === split.countryCode && c.code === this.selectedCountry.code)
					?? this.countries.find((c) => c.dialCode === split.countryCode);
				if (target) this.selectedCountry = target;
				val = split.nationalNumber;
			}
		}
		if (val.startsWith('0')) {
			val = val.substring(1);
		}

		const formatter = new AsYouType(this.selectedCountry.code);
		const formatted = formatter.input(val);
		this.phoneNumber = formatted;
		input.value = formatted;
		this.emitValue();
	}

	onBlur(): void {
		this.onTouched();
	}

	private emitValue(): void {
		if (!this.phoneNumber) {
			this.onChange(null);
			return;
		}
		const parsed = parsePhoneNumberFromString(
			this.phoneNumber,
			this.selectedCountry.code
		);
		const value: PhoneValue = {
			countryCode: this.selectedCountry.code,
			dialCode: this.selectedCountry.dialCode,
			number: this.phoneNumber,
			e164Number: parsed?.format('E.164') ?? '',
		};
		this.onChange(value);
	}
}
