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
