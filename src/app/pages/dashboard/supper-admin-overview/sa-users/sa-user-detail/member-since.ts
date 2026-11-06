import { effectiveTimeZone } from '../../../../../shared/ws-date/ws-date.pipe';

/** A date in readable Arabic: «٦ نوفمبر ٢٠٢٦» (Gregorian, viewer's time zone), with the time when `withTime`. Empty when the server sent no usable date. */
export function arabicDate(value: unknown, withTime = false): string {
	if (value === null || value === undefined || value === '') return '';
	const d = new Date(value as string | number);
	if (Number.isNaN(d.getTime())) return '';
	let zone = effectiveTimeZone();
	try { return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}), timeZone: zone }).format(d); }
	catch { zone = undefined; return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(d); }
}

/** «منذ ٦ نوفمبر ٢٠٢٦» for the header line. */
export function memberSince(value: unknown): string { const d = arabicDate(value); return d ? `منذ ${d}` : ''; }
