import { effectiveTimeZone } from '../../../../../shared/ws-date/ws-date.pipe';

/** «منذ ٦ نوفمبر ٢٠٢٦»: the registration date of an account in readable Arabic (Gregorian, in the viewer's time zone). Empty when the server sent no usable date. */
export function memberSince(value: unknown): string {
	if (value === null || value === undefined || value === '') return '';
	const d = new Date(value as string | number);
	if (Number.isNaN(d.getTime())) return '';
	let zone = effectiveTimeZone();
	try { return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: zone }).format(d); }
	catch { zone = undefined; return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(d); }
}
