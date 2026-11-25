import { COUNTRIES_CITIES } from './countries-cities';
import { timezoneForCountry, timezoneOptions } from './country-timezones';

describe('country time zones', () => {
	it('every country of the list has a zone, and every zone is a real IANA zone offered in the drop-down', () => {
		const options = timezoneOptions();
		for (const c of COUNTRIES_CITIES) {
			const zone = timezoneForCountry(c.name);
			expect(zone, c.name).toBeTruthy();
			expect(() => new Intl.DateTimeFormat('en', { timeZone: zone! }), c.name).not.toThrow();
			expect(options.some(o => o.value === zone), c.name).toBe(true);
		}
	});
	it('Saudi Arabia, Egypt and the UAE get their own zones; another country / empty gets none', () => {
		expect(timezoneForCountry('السعودية')).toBe('Asia/Riyadh'); expect(timezoneForCountry('مصر')).toBe('Africa/Cairo'); expect(timezoneForCountry('الإمارات')).toBe('Asia/Dubai');
		expect(timezoneForCountry('دولة أخرى')).toBeNull(); expect(timezoneForCountry('')).toBeNull();
	});
	it('labels carry the real offset of the zone', () => {
		const label = (z: string) => timezoneOptions(new Date('2026-01-15T12:00:00Z')).find(o => o.value === z)!.label;
		expect(label('Asia/Riyadh')).toContain('UTC+3'); expect(label('Asia/Dubai')).toContain('UTC+4'); expect(label('Africa/Cairo')).toContain('UTC+2');
	});
});
