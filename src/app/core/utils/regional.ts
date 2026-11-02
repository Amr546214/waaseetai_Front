/**
 * The platform's regional display settings (server settings `defaultTimezone`, `dateFormat`, `calendarSystem`, `defaultLanguage`), kept in plain module state so ANY formatter - Angular pipes,
 * hand-written Intl calls, the wsDate pipe - reads the same answer. Order of authority for a time zone: the signed-in user's own saved zone (provider / marketer preference) > the platform zone
 * > the browser's own zone (today's behaviour, the initial platform setting).
 */
export type PlatformDateFormat = 'legacy' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export interface PlatformRegional { timezone: string; dateFormat: PlatformDateFormat; calendar: 'gregorian' | 'hijri'; language: 'ar' | 'en' }

let state: PlatformRegional = { timezone: 'browser', dateFormat: 'legacy', calendar: 'gregorian', language: 'ar' };
export const platformRegional = (): PlatformRegional => state;
export function setPlatformRegional(v: Partial<{ defaultTimezone: unknown; dateFormat: unknown; calendarSystem: unknown; defaultLanguage: unknown }>) {
	const tz = v.defaultTimezone === 'Asia/Riyadh' || v.defaultTimezone === 'UTC' ? v.defaultTimezone : 'browser';
	const df = v.dateFormat === 'DD/MM/YYYY' || v.dateFormat === 'YYYY-MM-DD' ? v.dateFormat : 'legacy';
	state = { timezone: tz, dateFormat: df, calendar: v.calendarSystem === 'hijri' ? 'hijri' : 'gregorian', language: v.defaultLanguage === 'en' ? 'en' : 'ar' };
}
/** the platform IANA zone, or undefined when it is "browser" */
export const platformTimeZone = (): string | undefined => (state.timezone === 'browser' ? undefined : state.timezone);

/** DatePipe takes an offset ("+0300"), not an IANA name: the offset the zone has at the given instant */
export function zoneOffsetString(zone: string, at: Date = new Date()): string | undefined {
	try {
		const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? '';
		const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part);
		return m ? `${m[1]}${m[2]}${m[3] ?? '00'}` : '+0000';
	} catch { return undefined; }
}
export const platformDateOffset = (): string | undefined => { const z = platformTimeZone(); return z ? zoneOffsetString(z) : undefined; };

/** "YYYY-MM-DDTHH:mm" as the wall clock of `zone` at the given instant (for a datetime-local input shown in the platform zone) */
export function wallClockInZone(at: Date, zone: string): string {
	const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at).map(x => [x.type, x.value]));
	return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`;
}
/** the instant at which `zone`'s wall clock reads `local` ("YYYY-MM-DDTHH:mm"); the reference time that is stored and sent to the server (UTC) */
export function instantOfWallClock(local: string, zone: string): Date {
	const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local); if (!m) return new Date(NaN);
	const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
	let guess = asUtc;
	for (let i = 0; i < 2; i++) { const o = /([+-])(\d{2})(\d{2})/.exec(zoneOffsetString(zone, new Date(guess)) ?? '+0000')!; guess = asUtc - (o[1] === '-' ? -1 : 1) * (+o[2] * 60 + +o[3]) * 60_000; }
	return new Date(guess);
}
