import {
	Component,
	AfterViewInit,
	DoCheck,
	ElementRef,
	forwardRef,
	HostListener,
	Input,
	OnDestroy,
	OnChanges,
	OnInit,
	SimpleChanges,
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
import { splitPhoneInput, parseStoredPhone } from '../../core/forms/phone-countries';
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
}

// Build a sorted country list once at module level (performance)
const ALL_COUNTRIES: CountryOption[] = getCountries()
	.map((code) => ({
		code,
		name: new Intl.DisplayNames(['ar', 'en'], { type: 'region' }).of(code) ?? code,
		dialCode: '+' + getCountryCallingCode(code),
	}))
	.sort((a, b) => a.name.localeCompare(b.name));

let nextPhoneInputId = 0;

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
export class PhoneInputComponent implements ControlValueAccessor, Validator, OnChanges, OnInit, DoCheck, AfterViewInit, OnDestroy {
	@ViewChild('phoneField') private phoneField?: ElementRef<HTMLInputElement>;

	@Input() placeholder = 'رقم الجوال';
	@Input() preferredCountries: CountryCode[] = ['SA', 'AE', 'KW', 'QA', 'BH', 'OM'];
	@Input() defaultCountry: CountryCode = 'SA';
	/** When true an empty value is valid (the field is optional); a non-empty value must still be a valid number. */
	@Input() optional = false;
	/** Id of the real number box, so `<label for="…">` reaches it. Default: unique per instance (`ws-phone-N`). The host itself keeps no id of this value. */
	@Input() inputId = '';
	private readonly autoId = `ws-phone-${++nextPhoneInputId}`;
	get fieldId(): string { return this.inputId || this.autoId; }

	countries: CountryOption[] = ALL_COUNTRIES;
	selectedCountry: CountryOption = ALL_COUNTRIES.find(c => c.code === 'SA') || ALL_COUNTRIES[0];
	phoneNumber = '';
	/** What the user typed was NOT empty but had no digits to keep (letters/symbols only): that is invalid input, never an empty (= delete) value. */
	private rejectedInput = false;
	isDisabled = false;
	/**
	 * A stored number whose country cannot be told (shared code with no deciding digits, or a legacy number with no code): its digits stay visible with the dial
	 * code it has (or none), a neutral globe instead of a guessed flag, and nothing is rewritten until the user picks a country or edits the number.
	 */
	unresolved = false;
	unresolvedDial: string | null = null;
	/** A stored value (or the user) already decided the country: the default country must not override it. */
	private countryDecided = false;
	get dialLabel(): string { return this.unresolved ? (this.unresolvedDial ?? '+') : (this.selectedCountry?.dialCode ?? ''); }

	isOpen = false;
	searchTerm = '';
	/** Flags are bundled SVG files (public/assets/flags/XX.svg), never emoji: they look the same on every OS/font. A file that fails to load shows a neutral globe. */
	private brokenFlags = new Set<string>();
	flagSrc(code: string): string { return `assets/flags/${code}.svg`; }
	flagBroken(code: string | undefined): boolean { return !code || this.brokenFlags.has(code); }
	onFlagError(code: string): void { this.brokenFlags.add(code); }

	get triggerLabel(): string {
		return `اختيار الدولة: ${this.unresolved ? '' : (this.selectedCountry?.name ?? '')} ${this.dialLabel}`.trim();
	}

	onTriggerKey(event: Event): void { event.preventDefault(); this.toggleDropdown(event); }

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

	private ariaObserver: MutationObserver | null = null;

	ngAfterViewInit(): void {
		this.ngDoCheck();
		// The form-level a11y sync writes aria-invalid/aria-describedby on the host from a requestAnimationFrame callback, outside Angular's
		// change detection: without this the real number box stays one interaction behind (not announced as invalid right after a submit).
		if (typeof MutationObserver !== 'undefined') {
			this.ariaObserver = new MutationObserver(() => this.ngDoCheck());
			this.ariaObserver.observe(this.elementRef.nativeElement as HTMLElement, { attributes: true, attributeFilter: ['aria-invalid', 'aria-describedby', 'aria-errormessage', 'aria-required', 'required'] });
		}
	}

	ngOnDestroy(): void { this.ariaObserver?.disconnect(); this.ariaObserver = null; }

	ngDoCheck(): void {
		const host = this.elementRef.nativeElement as HTMLElement;
		const inner = this.phoneField?.nativeElement;
		if (!host || !inner) return;
		if (host.getAttribute('tabindex') === null) host.setAttribute('tabindex', '-1');
		const invalid = host.getAttribute('aria-invalid');
		if (invalid) inner.setAttribute('aria-invalid', invalid); else inner.removeAttribute('aria-invalid');
		const desc = host.getAttribute('aria-describedby');
		if (desc) inner.setAttribute('aria-describedby', desc); else inner.removeAttribute('aria-describedby');
		const err = host.getAttribute('aria-errormessage');
		if (err) inner.setAttribute('aria-errormessage', err); else inner.removeAttribute('aria-errormessage');
		const req = host.getAttribute('aria-required') ?? (host.hasAttribute('required') && host.getAttribute('required') !== 'false' ? 'true' : null);
		if (req) inner.setAttribute('aria-required', req); else inner.removeAttribute('aria-required');
	}

	ngOnInit(): void {
		const preferred = this.preferredCountries
			.map((c) => ALL_COUNTRIES.find((x) => x.code === c))
			.filter(Boolean) as CountryOption[];

		const rest = ALL_COUNTRIES.filter(
			(c) => !this.preferredCountries.includes(c.code)
		);

		this.countries = [...preferred, ...rest];
		
		if (this.countryDecided) {
			const found = this.countries.find(c => c.code === this.selectedCountry.code);
			if (found) this.selectedCountry = found;
		} else {
			this.selectedCountry = this.countries.find((c) => c.code === this.defaultCountry) ?? this.countries[0];
		}
	}

	ngOnChanges(changes: SimpleChanges): void {
		// the account country can arrive after the field was created: it only replaces the built-in default, never a country a value or the user chose
		if (changes['defaultCountry'] && !changes['defaultCountry'].firstChange && !this.countryDecided) {
			this.selectedCountry = this.countries.find((c) => c.code === this.defaultCountry) ?? this.selectedCountry;
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
		this.countryDecided = true;
		this.unresolved = false;
		this.unresolvedDial = null;
		this.isOpen = false;
		this.emitValue();
	}

	// ─── ControlValueAccessor ───────────────────────────────────
	writeValue(val: PhoneValue | string | null): void {
		this.unresolved = false;
		this.unresolvedDial = null;
		this.rejectedInput = false;
		if (!val) {
			this.phoneNumber = '';
			return;
		}
		if (typeof val === 'string') {
			// A stored number (E.164, spaced, without "+", legacy local): shown with ITS country, never the default one.
			const stored = parseStoredPhone(val);
			if (!stored.national) { this.phoneNumber = ''; return; }
			this.countryDecided = true;
			if (stored.iso) {
				const country = this.countries.find((c) => c.code === stored.iso);
				if (country) this.selectedCountry = country;
				this.phoneNumber = new AsYouType(stored.iso).input(stored.national);
			} else {
				this.unresolved = true;
				this.unresolvedDial = stored.dialCode;
				this.phoneNumber = stored.national;
			}
		} else {
			if (val.countryCode) {
				const country = this.countries.find((c) => c.code === val.countryCode);
				if (country) { this.selectedCountry = country; this.countryDecided = true; }
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
		if (!this.phoneNumber) return this.rejectedInput ? { invalidPhone: true } : (this.optional ? null : { required: true });
		if (this.unresolved) {
			const p = this.unresolvedDial ? parsePhoneNumberFromString(`${this.unresolvedDial}${this.phoneNumber.replace(/\D/g, '')}`) : undefined;
			return p && p.isValid() ? null : { invalidPhone: true };
		}
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
		const typedRaw = val;

		// A full number typed or pasted with its country code ("+201025073026", "201025073026"): split it, pick the matching country and keep the LOCAL number only.
		const typed = val.replace(/[\s()-]/g, '');
		if (/^\+?\d{8,}$/.test(typed) && (typed.startsWith('+') || !val.startsWith('0'))) {
			const split = splitPhoneInput(typed, this.selectedCountry.dialCode);
			if (split) {
				const target = this.countries.find((c) => c.dialCode === split.countryCode && c.code === this.selectedCountry.code)
					?? this.countries.find((c) => c.dialCode === split.countryCode);
				if (target) { this.selectedCountry = target; this.countryDecided = true; this.unresolved = false; this.unresolvedDial = null; }
				val = split.nationalNumber;
			}
		}
		if (this.unresolved) {
			// the country of this number is still unknown: keep what is typed, resolve it only when the digits decide the country
			this.phoneNumber = val;
			input.value = val;
			this.rejectedInput = !val && typedRaw.trim() !== '';
			this.emitValue();
			return;
		}
		if (val.startsWith('0')) {
			val = val.substring(1);
		}

		const formatter = new AsYouType(this.selectedCountry.code);
		const formatted = formatter.input(val);
		this.phoneNumber = formatted;
		input.value = formatted;
		this.rejectedInput = !formatted && typedRaw.trim() !== '';
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
		if (this.unresolved) {
			const digits = this.phoneNumber.replace(/\D/g, '');
			const full = this.unresolvedDial ? parsePhoneNumberFromString(`${this.unresolvedDial}${digits}`) : undefined;
			if (full?.country) {
				const country = this.countries.find((c) => c.code === full.country);
				if (country) { this.selectedCountry = country; this.countryDecided = true; this.unresolved = false; this.unresolvedDial = null; }
			}
			const dialCode = this.unresolved ? (this.unresolvedDial ?? '') : this.selectedCountry.dialCode;
			this.onChange({
				countryCode: this.selectedCountry.code,
				dialCode,
				number: this.phoneNumber,
				e164Number: dialCode && digits ? `${dialCode}${digits}` : '',
			});
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
