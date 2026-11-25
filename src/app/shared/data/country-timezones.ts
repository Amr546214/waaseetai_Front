import { zoneOffsetString } from '../../core/utils/regional';

/**
 * The time zone that goes with each country of the country list (stored values are the Arabic country names). One zone per country (the capital's zone for the
 * countries that span several). Every zone here is also accepted by the backend (provider-preferences.dto TIMEZONES).
 */
const COUNTRY_ZONE: Record<string, string> = {
	'السعودية': 'Asia/Riyadh', 'الإمارات': 'Asia/Dubai', 'الكويت': 'Asia/Kuwait', 'قطر': 'Asia/Qatar', 'البحرين': 'Asia/Bahrain', 'عمان': 'Asia/Muscat',
	'مصر': 'Africa/Cairo', 'الأردن': 'Asia/Amman', 'العراق': 'Asia/Baghdad', 'سوريا': 'Asia/Damascus', 'لبنان': 'Asia/Beirut', 'فلسطين': 'Asia/Hebron', 'اليمن': 'Asia/Aden',
	'ليبيا': 'Africa/Tripoli', 'تونس': 'Africa/Tunis', 'الجزائر': 'Africa/Algiers', 'المغرب': 'Africa/Casablanca', 'السودان': 'Africa/Khartoum', 'موريتانيا': 'Africa/Nouakchott',
	'تركيا': 'Europe/Istanbul', 'المملكة المتحدة': 'Europe/London', 'الولايات المتحدة': 'America/New_York', 'كندا': 'America/Toronto', 'ألمانيا': 'Europe/Berlin', 'فرنسا': 'Europe/Paris',
};

/** the zone of a country, or null when it has none (another country / empty) */
export const timezoneForCountry = (country: string | null | undefined): string | null => COUNTRY_ZONE[String(country ?? '').trim()] ?? null;

/** the drop-down: «توقيت <country> (UTC+h)» for each country, plus GMT; the offset is read from the zone itself (so it follows summer time) */
export function timezoneOptions(at: Date = new Date()): { value: string; label: string }[] {
	const fmt = (zone: string) => { const o = zoneOffsetString(zone, at) ?? '+0000'; const h = Number(o.slice(1, 3)), m = o.slice(3); return `UTC${o[0]}${h}${m !== '00' ? ':' + m : ''}`; };
	return [...Object.entries(COUNTRY_ZONE).map(([country, zone]) => ({ value: zone, label: `توقيت ${country} (${fmt(zone)})` })), { value: 'GMT', label: 'توقيت غرينتش (UTC+0)' }];
}
