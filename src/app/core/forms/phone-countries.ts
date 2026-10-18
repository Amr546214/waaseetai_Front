// A phone is the pair (country code, LOCAL number). The pair must be a real mobile number OF THAT COUNTRY (libphonenumber metadata): an Egyptian number never goes with
// +966 and a Saudi one never with +20. Mirrors the backend rule (waseetai-backend/src/utils/phone-countries.ts), so the page and the server always agree.
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/mobile';

export interface ContactPhone { countryCode: string; nationalNumber: string; display: string; consistent: boolean }

const digitsOf = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const clean = (v: unknown) => String(v ?? '').replace(/[\s()-]/g, '');
const stripTrunkZero = (n: string) => (n.startsWith('0') ? n.slice(1) : n);

/** "+966" / "966" / null -> "966". */
export function callingDigits(code: unknown): string {
	return digitsOf(code) || '966';
}

/** True when `national` is a valid mobile number of the country that owns this calling code. */
export function isValidNationalNumber(callingCode: unknown, national: string): boolean {
	const cc = callingDigits(callingCode);
	if (!/^\d{4,14}$/.test(national)) return false;
	const p = parsePhoneNumberFromString(`+${cc}${national}`);
	return !!p && p.isValid() && String(p.countryCallingCode) === cc;
}

function fromInternational(rawDigits: string): { countryCode: string; national: string } | null {
	const p = parsePhoneNumberFromString(`+${rawDigits}`);
	return p && p.isValid() ? { countryCode: `+${p.countryCallingCode}`, national: String(p.nationalNumber) } : null;
}

/**
 * What the user typed or pasted -> the pair to store, or null when it is not a real number of the chosen country.
 * A "+CC..." number decides the country; digits that start with the chosen country's code are split; digits that are only valid as a full international
 * number decide the country when `allowAutoCountry` (nothing chosen yet).
 */
export function splitPhoneInput(input: unknown, selectedCountryCode?: unknown, allowAutoCountry = false): { countryCode: string; nationalNumber: string } | null {
	const raw = clean(input);
	if (!/^\+?\d+$/.test(raw)) return null;
	if (raw.startsWith('+')) {
		const full = fromInternational(raw.slice(1));
		return full ? { countryCode: full.countryCode, nationalNumber: full.national } : null;
	}
	const cc = callingDigits(selectedCountryCode);
	const national = stripTrunkZero(raw);
	if (isValidNationalNumber(cc, national)) return { countryCode: `+${cc}`, nationalNumber: national };
	if (raw.startsWith(cc) && isValidNationalNumber(cc, stripTrunkZero(raw.slice(cc.length)))) return { countryCode: `+${cc}`, nationalNumber: stripTrunkZero(raw.slice(cc.length)) };
	const full = fromInternational(raw);
	if (full && (allowAutoCountry || full.countryCode !== `+${cc}`)) return { countryCode: full.countryCode, nationalNumber: full.national };
	return null;
}

/** Stored pair -> the pair to show (older rows repaired from their digits, e.g. an Egyptian number saved next to +966). */
export function canonicalStoredPhone(countryCode: unknown, stored: unknown): ContactPhone {
	const raw = clean(stored).replace(/^\+/, '');
	const shown = (cc: string, n: string, consistent: boolean): ContactPhone => ({ countryCode: `+${cc}`, nationalNumber: n, display: n ? `+${cc} ${n}` : '', consistent });
	if (!raw) return shown(callingDigits(countryCode), '', true);
	const cc = callingDigits(countryCode);
	const own = stripTrunkZero(raw);
	if (isValidNationalNumber(cc, own)) return shown(cc, own, !clean(stored).startsWith('+') && own === raw);
	if (raw.startsWith(cc) && isValidNationalNumber(cc, stripTrunkZero(raw.slice(cc.length)))) return shown(cc, stripTrunkZero(raw.slice(cc.length)), false);
	const full = fromInternational(raw);
	if (full) return shown(full.countryCode.slice(1), full.national, false);
	return shown(cc, own, false);
}

/** "+20" -> "EG" (the first region of that calling code: "+1" -> "US"). null when unknown. */
export function isoForCallingCode(callingCode: unknown): CountryCode | null {
	const cc = callingDigits(callingCode);
	return (getCountries() as CountryCode[]).find(c => String(getCountryCallingCode(c)) === cc) ?? null;
}

export interface PhoneCountryView { iso: string | null; countryName: string; dialCode: string; nationalNumber: string; display: string }

/** The stored (canonical) pair as a readable block: country (iso -> the local SVG flag, never an emoji) + country name + code + local number (an empty number gives an empty view). */
export function phoneCountryView(phone: ContactPhone): PhoneCountryView | null {
	if (!phone.nationalNumber) return null;
	// the region comes from the number itself (a shared code such as +1 / +7 is never guessed from the code alone)
	const iso = parseStoredPhone(`${phone.countryCode}${phone.nationalNumber}`).iso;
	const countryName = iso ? (new Intl.DisplayNames(['ar'], { type: 'region' }).of(iso) ?? iso) : '';
	return { iso, countryName, dialCode: phone.countryCode, nationalNumber: phone.nationalNumber, display: phone.display };
}

/** The phone-input value object (structural copy, so this file does not import the component). */
export interface PhoneValueLike { countryCode?: string; dialCode?: string; number?: string; e164Number?: string }

/**
 * The API stores a phone as ONE STRING. The phone-input emits an object {countryCode, dialCode, number, e164Number}: this is the single place that turns it
 * (or an already stored string) into the string to send. Full number kept: dial code + national digits, spaces and the trunk "0" removed, never a doubled
 * country code. Empty -> null (clear). A plain string passes through cleaned (a stored legacy value is never rewritten here).
 */
export function phoneToE164(value: PhoneValueLike | string | null | undefined): string | null {
	if (value == null) return null;
	if (typeof value === 'string') { const s = clean(value); return s || null; }
	const e164 = clean(value.e164Number);
	if (e164) return e164.startsWith('+') ? e164 : `+${digitsOf(e164)}`;
	const rawNumber = clean(value.number);
	const nationalDigits = digitsOf(rawNumber);
	if (!nationalDigits) return null;
	if (rawNumber.startsWith('+')) return `+${nationalDigits}`;
	const dial = digitsOf(value.dialCode);
	if (!dial) return null;
	if (nationalDigits.startsWith(dial) && isValidNationalNumber(dial, stripTrunkZero(nationalDigits.slice(dial.length)))) return `+${dial}${stripTrunkZero(nationalDigits.slice(dial.length))}`;
	return `+${dial}${stripTrunkZero(nationalDigits)}`;
}

export interface StoredPhoneParse {
	/** Region of the number when it is certain, else null. */
	iso: CountryCode | null;
	/** "+20"; null when not even the calling code can be told. */
	dialCode: string | null;
	/** Local number without the calling code (the whole stored text when no code can be told). */
	national: string;
	/** True when the country could not be told (shared code with no deciding digits, or no code at all): show the number + code, let the user pick. */
	ambiguous: boolean;
}

const CALLING_CODES: Set<string> = new Set((getCountries() as CountryCode[]).map(c => String(getCountryCallingCode(c))));
const countriesOfCode = (cc: string): CountryCode[] => (getCountries() as CountryCode[]).filter(c => String(getCountryCallingCode(c)) === cc);

function byCallingCode(cc: string, national: string): StoredPhoneParse {
	const full = parsePhoneNumberFromString(`+${cc}${national}`);
	if (full?.country && String(full.countryCallingCode) === cc) return { iso: full.country, dialCode: `+${cc}`, national, ambiguous: false };
	const owners = countriesOfCode(cc);
	if (owners.length === 1) return { iso: owners[0], dialCode: `+${cc}`, national, ambiguous: false };
	return { iso: null, dialCode: `+${cc}`, national, ambiguous: true };
}

/**
 * A stored number (E.164, spaced, without "+", legacy local with a trunk zero, or the account pair national + `callingCode`) -> the country and local number to SHOW.
 * Longest-prefix on the real calling codes; a number whose country cannot be told keeps its dial code and digits and is flagged `ambiguous` (never a silent default).
 */
export function parseStoredPhone(stored: unknown, callingCode?: unknown): StoredPhoneParse {
	const s = clean(stored);
	if (!s) return { iso: null, dialCode: null, national: '', ambiguous: false };
	const hint = digitsOf(callingCode);
	if (s.startsWith('+')) {
		const full = parsePhoneNumberFromString(s);
		if (full) return byCallingCode(String(full.countryCallingCode), String(full.nationalNumber));
		const d = digitsOf(s);
		for (let n = 1; n <= 3; n++) if (CALLING_CODES.has(d.slice(0, n))) return byCallingCode(d.slice(0, n), d.slice(n));
		return { iso: null, dialCode: null, national: d, ambiguous: true };
	}
	if (hint && CALLING_CODES.has(hint)) {
		const c = canonicalStoredPhone(hint, s);
		return byCallingCode(digitsOf(c.countryCode), c.nationalNumber);
	}
	const intl = fromInternational(digitsOf(s));
	if (intl) return byCallingCode(digitsOf(intl.countryCode), intl.national);
	return { iso: null, dialCode: null, national: s, ambiguous: true };
}
