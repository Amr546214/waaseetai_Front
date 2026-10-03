/**
 * Single local source for every country + city <select> in the app (profile setup / edit / data, all roles).
 * No external API, keys or network: add a country or a city here and every form picks it up.
 *
 * Stored values are the Arabic display names (that is what the backend already holds for
 * `country` / `city`), so existing saved profiles keep working.
 */

/** Last option of every city list ("other city"), also the only city of "other country". */
export const OTHER_CITY = 'مدينة أخرى';
export const OTHER_COUNTRY = 'دولة أخرى';

export interface CountryEntry {
	readonly name: string;
	/** Real cities of this country only. OTHER_CITY is appended by citiesOf(). */
	readonly cities: readonly string[];
}

export const COUNTRIES_CITIES: readonly CountryEntry[] = [
	{ name: 'السعودية', cities: ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الظهران', 'الطائف', 'تبوك', 'أبها', 'خميس مشيط', 'بريدة', 'حائل', 'جازان', 'نجران', 'الجبيل', 'ينبع', 'الأحساء', 'الباحة', 'عرعر', 'سكاكا'] },
	{ name: 'الإمارات', cities: ['دبي', 'أبوظبي', 'الشارقة', 'عجمان', 'رأس الخيمة', 'الفجيرة', 'أم القيوين', 'العين'] },
	{ name: 'الكويت', cities: ['مدينة الكويت', 'حولي', 'السالمية', 'الفروانية', 'الجهراء', 'الأحمدي', 'الفحيحيل', 'صباح السالم'] },
	{ name: 'قطر', cities: ['الدوحة', 'الوكرة', 'الريان', 'الخور', 'أم صلال', 'الشمال', 'الضعاين'] },
	{ name: 'البحرين', cities: ['المنامة', 'المحرق', 'الرفاع', 'مدينة حمد', 'مدينة عيسى', 'سترة', 'البديع'] },
	{ name: 'عمان', cities: ['مسقط', 'صلالة', 'صحار', 'نزوى', 'صور', 'عبري', 'الرستاق', 'بهلاء', 'خصب'] },
	{ name: 'مصر', cities: ['القاهرة', 'الجيزة', 'الإسكندرية', 'شرم الشيخ', 'الغردقة', 'الأقصر', 'أسوان', 'المنصورة', 'طنطا', 'الزقازيق', 'بورسعيد', 'السويس', 'الإسماعيلية', 'أسيوط', 'الفيوم', 'دمياط', 'المنيا', 'سوهاج', 'العاشر من رمضان', '6 أكتوبر'] },
	{ name: 'الأردن', cities: ['عمّان', 'إربد', 'الزرقاء', 'العقبة', 'السلط', 'مادبا', 'الكرك', 'جرش', 'عجلون', 'المفرق'] },
	{ name: 'العراق', cities: ['بغداد', 'البصرة', 'الموصل', 'أربيل', 'السليمانية', 'النجف', 'كربلاء', 'كركوك', 'دهوك', 'الناصرية'] },
	{ name: 'سوريا', cities: ['دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس', 'دير الزور', 'الرقة', 'درعا', 'السويداء'] },
	{ name: 'لبنان', cities: ['بيروت', 'طرابلس', 'صيدا', 'صور', 'جونية', 'زحلة', 'بعلبك', 'النبطية', 'جبيل'] },
	{ name: 'فلسطين', cities: ['القدس', 'رام الله', 'غزة', 'الخليل', 'نابلس', 'بيت لحم', 'جنين', 'طولكرم', 'خان يونس', 'رفح'] },
	{ name: 'اليمن', cities: ['صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب', 'المكلا', 'مأرب', 'ذمار'] },
	{ name: 'ليبيا', cities: ['طرابلس', 'بنغازي', 'مصراتة', 'سبها', 'البيضاء', 'طبرق', 'الزاوية', 'زليتن'] },
	{ name: 'تونس', cities: ['تونس', 'صفاقس', 'سوسة', 'القيروان', 'بنزرت', 'قابس', 'المنستير', 'نابل'] },
	{ name: 'الجزائر', cities: ['الجزائر العاصمة', 'وهران', 'قسنطينة', 'عنابة', 'سطيف', 'باتنة', 'بجاية', 'تلمسان', 'البليدة'] },
	{ name: 'المغرب', cities: ['الدار البيضاء', 'الرباط', 'مراكش', 'فاس', 'طنجة', 'أغادير', 'مكناس', 'وجدة', 'تطوان', 'القنيطرة'] },
	{ name: 'السودان', cities: ['الخرطوم', 'أم درمان', 'بورتسودان', 'كسلا', 'الأبيض', 'نيالا', 'مدني', 'القضارف'] },
	{ name: 'موريتانيا', cities: ['نواكشوط', 'نواذيبو', 'كيفة', 'روصو', 'أطار'] },
	{ name: 'تركيا', cities: ['إسطنبول', 'أنقرة', 'إزمير', 'بورصة', 'أنطاليا', 'أضنة', 'قونيا', 'غازي عنتاب', 'طرابزون'] },
	{ name: 'المملكة المتحدة', cities: ['لندن', 'مانشستر', 'برمنغهام', 'ليفربول', 'ليدز', 'غلاسكو', 'إدنبرة', 'كارديف'] },
	{ name: 'الولايات المتحدة', cities: ['نيويورك', 'لوس أنجلوس', 'شيكاغو', 'هيوستن', 'ميامي', 'واشنطن', 'سان فرانسيسكو', 'ديترويت'] },
	{ name: 'كندا', cities: ['تورنتو', 'مونتريال', 'فانكوفر', 'أوتاوا', 'كالغاري', 'إدمونتون'] },
	{ name: 'ألمانيا', cities: ['برلين', 'ميونخ', 'هامبورغ', 'فرانكفورت', 'كولونيا', 'دوسلدورف', 'شتوتغارت'] },
	{ name: 'فرنسا', cities: ['باريس', 'مرسيليا', 'ليون', 'تولوز', 'نيس', 'ليل', 'ستراسبورغ'] },
];

/** Country names in display order, followed by OTHER_COUNTRY. */
export const COUNTRY_NAMES: readonly string[] = [...COUNTRIES_CITIES.map((c) => c.name), OTHER_COUNTRY];

/** Older stored / displayed spellings that map to a country in the list. */
const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
	'غير ذلك': OTHER_COUNTRY,
	'المملكة العربية السعودية': 'السعودية',
	'الإمارات العربية المتحدة': 'الإمارات',
	'سلطنة عمان': 'عمان',
};

/** Canonical country name for a stored value ('' when empty/unknown). */
export function normalizeCountry(value: string | null | undefined): string {
	const v = (value ?? '').trim();
	if (!v) return '';
	const aliased = COUNTRY_ALIASES[v] ?? v;
	return COUNTRY_NAMES.includes(aliased) ? aliased : '';
}

/**
 * Cities of exactly this country (OTHER_CITY last). Empty before a country is chosen, so the city
 * select has nothing to show, and never another country's cities.
 */
export function citiesOf(country: string | null | undefined): string[] {
	const name = normalizeCountry(country);
	if (!name) return [];
	const entry = COUNTRIES_CITIES.find((c) => c.name === name);
	return [...(entry?.cities ?? []), OTHER_CITY];
}

export function isCityOf(country: string | null | undefined, city: string | null | undefined): boolean {
	return !!city && citiesOf(country).includes(city);
}

/** Placeholder text of the city select. */
export function cityPlaceholder(country: string | null | undefined): string {
	return normalizeCountry(country) ? 'اختر المدينة' : 'اختر الدولة أولاً';
}
