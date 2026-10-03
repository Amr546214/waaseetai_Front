import { describe, expect, it } from 'vitest';
import { COUNTRIES_CITIES, COUNTRY_NAMES, OTHER_CITY, OTHER_COUNTRY, cityPlaceholder, citiesOf, isCityOf, normalizeCountry } from './countries-cities';

const SAUDI_CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'تبوك', 'أبها'];

describe('countries-cities data', () => {
	it('before a country is chosen there are no cities and the placeholder asks for the country first', () => {
		expect(citiesOf('')).toEqual([]);
		expect(citiesOf(null)).toEqual([]);
		expect(cityPlaceholder('')).toBe('اختر الدولة أولاً');
		expect(cityPlaceholder('مصر')).toBe('اختر المدينة');
	});

	it('Egypt lists Egyptian cities only: none of the Saudi cities', () => {
		const eg = citiesOf('مصر');
		expect(eg).toContain('القاهرة');
		expect(eg).toContain('الإسكندرية');
		for (const saudi of SAUDI_CITIES) expect(eg).not.toContain(saudi);
	});

	it('Saudi Arabia lists Saudi cities and none of Egypt\'s', () => {
		const sa = citiesOf('السعودية');
		for (const c of ['الرياض', 'جدة', 'مكة المكرمة', 'الدمام', 'تبوك']) expect(sa).toContain(c);
		expect(sa).not.toContain('القاهرة');
	});

	it('every country has its own non-empty city list, ending with "مدينة أخرى", and no real city is shared with another country list except genuine namesakes', () => {
		for (const c of COUNTRIES_CITIES) {
			const list = citiesOf(c.name);
			expect(c.cities.length).toBeGreaterThan(0);
			expect(list[list.length - 1]).toBe(OTHER_CITY);
			expect(new Set(list).size).toBe(list.length);
		}
		// Regression: the old forms offered the same Saudi list for every country.
		const saudi = citiesOf('السعودية').join('|');
		for (const c of COUNTRIES_CITIES.filter((x) => x.name !== 'السعودية')) {
			expect(citiesOf(c.name).join('|')).not.toBe(saudi);
			const overlap = c.cities.filter((city) => SAUDI_CITIES.includes(city));
			expect(overlap, `${c.name} must not list Saudi cities`).toEqual([]);
		}
	});

	it('"other country" only offers "other city"; unknown countries offer nothing', () => {
		expect(citiesOf(OTHER_COUNTRY)).toEqual([OTHER_CITY]);
		expect(citiesOf('كوكب آخر')).toEqual([]);
		expect(COUNTRY_NAMES[COUNTRY_NAMES.length - 1]).toBe(OTHER_COUNTRY);
	});

	it('normalizes saved spellings and checks city membership per country', () => {
		expect(normalizeCountry('غير ذلك')).toBe(OTHER_COUNTRY);
		expect(normalizeCountry('المملكة العربية السعودية')).toBe('السعودية');
		expect(isCityOf('مصر', 'القاهرة')).toBe(true);
		expect(isCityOf('مصر', 'الرياض')).toBe(false);
		expect(isCityOf('', 'الرياض')).toBe(false);
	});
});
