export const IDENTITY_DOCUMENT_TYPES = [
  { code: 'NATIONAL_ID', label: 'بطاقة هوية وطنية' },
  { code: 'PASSPORT', label: 'جواز سفر' },
  { code: 'RESIDENCE_PERMIT', label: 'إقامة' },
  { code: 'DRIVING_LICENCE', label: 'رخصة قيادة' }
] as const;

export const DOCUMENT_NUMBER_PATTERN = /^[\p{L}\p{Nd}][\p{L}\p{Nd} /.-]{0,39}$/u;

const countryCodes: Readonly<Record<string, string>> = {
  السعودية: 'SA', الإمارات: 'AE', الكويت: 'KW', قطر: 'QA', البحرين: 'BH', عمان: 'OM',
  مصر: 'EG', الأردن: 'JO', العراق: 'IQ', سوريا: 'SY', لبنان: 'LB', فلسطين: 'PS',
  اليمن: 'YE', ليبيا: 'LY', تونس: 'TN', الجزائر: 'DZ', المغرب: 'MA', السودان: 'SD',
  موريتانيا: 'MR', تركيا: 'TR', 'المملكة المتحدة': 'GB', 'الولايات المتحدة': 'US',
  كندا: 'CA', ألمانيا: 'DE', فرنسا: 'FR'
};

export function identityCountryCode(country: string | null | undefined): string | null {
  return country && Object.hasOwn(countryCodes, country) ? countryCodes[country] : null;
}

export function documentInputProblem(number: string | null, issuer: string | null, type: string | null) {
  const value = number?.trim() ?? '';
  if (type) {
    if (!issuer) return { key: 'idDocumentType', label: 'نوع وثيقة الهوية', message: 'اختر دولة محددة من حقل الدولة لاستخدام هذا النوع من الوثائق' };
    const normalized = value.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15));
    if (!(issuer === 'EG' && type === 'NATIONAL_ID' ? /^\d{14}$/.test(normalized) : DOCUMENT_NUMBER_PATTERN.test(value))) {
      return { key: 'idNumber', label: 'رقم الوثيقة', message: issuer === 'EG' && type === 'NATIONAL_ID' ? 'رقم الهوية المصرية لازم يكون 14 رقمًا' : 'رقم الوثيقة غير صالح: اكتب الرقم كما يظهر في الوثيقة' };
    }
  } else if (value && !/^[12]\d{9}$/.test(value)) {
    return { key: 'idNumber', label: 'رقم الوثيقة', message: 'رقم الهوية لازم يكون 10 أرقام ويبدأ بـ 1 أو 2، أو اختر نوع الوثيقة المناسب' };
  }
  return null;
}
