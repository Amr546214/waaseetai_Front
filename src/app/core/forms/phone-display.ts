// A provider phone is stored as phoneCountryCode ("+966") + phoneNumber (national digits). Older rows may hold a leading 0 or a full "+CC..." number.
// The page shows the country code once (a chip) and the NATIONAL digits in the input, so the code is never repeated or lost.

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** "+966" / "966" / null -> "+966" (the platform default when the account has none). */
export function normalizedCountryCode(code: unknown): string {
	return `+${digits(code) || '966'}`;
}

/** Stored number -> the national digits for the input: no "+", no repeated country code, no leading trunk zero. */
export function nationalPhoneForInput(countryCode: unknown, stored: unknown): string {
	const raw = String(stored ?? '').replace(/[\s()-]/g, '');
	if (!raw) return '';
	let national = raw;
	if (raw.startsWith('+')) {
		const cc = digits(countryCode) || '966';
		const rest = raw.slice(1);
		national = rest.startsWith(cc) ? rest.slice(cc.length) : rest;
	}
	return national.startsWith('0') ? national.slice(1) : national;
}

/** Code + number as one readable value: "+966 501234567" (the + and the code come first, in a left-to-right run so RTL never reorders them). */
export function phoneForDisplay(countryCode: unknown, stored: unknown): string {
	const national = nationalPhoneForInput(countryCode, stored);
	return national ? `${normalizedCountryCode(countryCode)} ${national}` : '';
}
