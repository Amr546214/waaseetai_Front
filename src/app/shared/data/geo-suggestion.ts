import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { AbstractControl } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { isCityOf } from './countries-cities';

export interface GeoSuggestionDto { countryCode: string | null; city: string | null; timezone: string | null; source: 'cdn-header' | 'geoip-provider' | 'none'; approximate: true }
/** ISO-3166 alpha-2 -> the Arabic country name the country select stores. Only countries of the app's own list; anything else gets NO suggestion (never «دولة أخرى» by guess). */
export const COUNTRY_BY_ISO: Readonly<Record<string, string>> = { SA: 'السعودية', AE: 'الإمارات', KW: 'الكويت', QA: 'قطر', BH: 'البحرين', OM: 'عمان', EG: 'مصر', JO: 'الأردن', IQ: 'العراق', SY: 'سوريا', LB: 'لبنان', PS: 'فلسطين', YE: 'اليمن', LY: 'ليبيا', TN: 'تونس', DZ: 'الجزائر', MA: 'المغرب', SD: 'السودان', MR: 'موريتانيا', TR: 'تركيا', GB: 'المملكة المتحدة', US: 'الولايات المتحدة', CA: 'كندا', DE: 'ألمانيا', FR: 'فرنسا' };
/** English city names a provider returns -> the Arabic name of the app's city list (only well-known ones; a city not listed here is simply not suggested) */
export const CITY_AR: Readonly<Record<string, string>> = { riyadh: 'الرياض', jeddah: 'جدة', mecca: 'مكة المكرمة', makkah: 'مكة المكرمة', medina: 'المدينة المنورة', dammam: 'الدمام', khobar: 'الخبر', taif: 'الطائف', tabuk: 'تبوك', abha: 'أبها',
	dubai: 'دبي', 'abu dhabi': 'أبوظبي', sharjah: 'الشارقة', ajman: 'عجمان', 'al ain': 'العين', doha: 'الدوحة', manama: 'المنامة', muscat: 'مسقط', 'kuwait city': 'مدينة الكويت',
	cairo: 'القاهرة', giza: 'الجيزة', alexandria: 'الإسكندرية', amman: 'عمّان', baghdad: 'بغداد', erbil: 'أربيل', damascus: 'دمشق', beirut: 'بيروت', tunis: 'تونس', casablanca: 'الدار البيضاء', rabat: 'الرباط', khartoum: 'الخرطوم',
	istanbul: 'إسطنبول', ankara: 'أنقرة', izmir: 'إزمير', london: 'لندن', manchester: 'مانشستر', 'new york': 'نيويورك', 'los angeles': 'لوس أنجلوس', toronto: 'تورنتو', berlin: 'برلين', paris: 'باريس' };
export interface FormSuggestion { country: string; city: string | null }
export function suggestionFor(g: GeoSuggestionDto | null | undefined): FormSuggestion | null {
	if (!g || g.source === 'none' || !g.countryCode) return null;
	const country = COUNTRY_BY_ISO[g.countryCode.toUpperCase()]; if (!country) return null;
	const ar = g.city ? CITY_AR[g.city.trim().toLowerCase()] : undefined;
	return { country, city: ar && isCityOf(country, ar) ? ar : null };
}

/**
 * First-registration hint: an approximate country (and city when it is a known one) from the visitor's trusted network address, asked of the server. It only FILLS EMPTY fields, never replaces
 * what the user typed or what is already saved, never runs a second time for a profile that already has them, and a failure changes nothing (the manual fields keep working). It is not GPS and not a legal address.
 */
@Injectable({ providedIn: 'root' })
export class GeoSuggestionService {
	private readonly http = inject(HttpClient); private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	/** `details` is the form group holding `country` and `city`; `onApplied` runs only if a suggestion was really put in. */
	suggestInto(details: AbstractControl | null | undefined, onApplied: () => void): void {
		const country = details?.get('country'), city = details?.get('city');
		if (!this.browser || !country || !city || String(country.value ?? '').trim() || String(city.value ?? '').trim()) return;
		this.http.get<{ data: GeoSuggestionDto }>(`${environment.url_api}/public/geo-suggestion`).subscribe({
			next: r => {
				const s = suggestionFor(r.data); if (!s) return;
				// the answer is late: apply only if the user has not touched or filled either field meanwhile
				if (String(country.value ?? '').trim() || String(city.value ?? '').trim() || country.dirty || city.dirty || country.touched || city.touched) return;
				country.setValue(s.country); if (s.city) city.setValue(s.city);
				onApplied();
			},
			error: () => undefined,
		});
	}
}
