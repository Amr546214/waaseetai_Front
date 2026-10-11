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

export interface PhoneCountryView { iso: string | null; flag: string; countryName: string; dialCode: string; nationalNumber: string; display: string }

const flagOf = (iso: string) => iso.toUpperCase().split('').map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');

/** The stored (canonical) pair as a readable block: flag + country name + code + local number (an empty number gives an empty view). */
export function phoneCountryView(phone: ContactPhone): PhoneCountryView | null {
	if (!phone.nationalNumber) return null;
	const iso = isoForCallingCode(phone.countryCode);
	const countryName = iso ? (new Intl.DisplayNames(['ar'], { type: 'region' }).of(iso) ?? iso) : '';
	return { iso, flag: iso ? flagOf(iso) : '', countryName, dialCode: phone.countryCode, nationalNumber: phone.nationalNumber, display: phone.display };
}
