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

// National ID formats: UAE ICP, Kuwait CSB, Qatar MCIT, Bahrain SIO.
const nationalIdFormats: Readonly<Record<string, { pattern: RegExp; message: string }>> = {
  AE: { pattern: /^(?:784\d{12}|784-\d{4}-\d{7}-\d)$/, message: 'رقم الهوية الإماراتية لازم يكون 15 رقمًا ويبدأ بـ 784' },
  KW: { pattern: /^\d{12}$/, message: 'الرقم المدني الكويتي لازم يكون 12 رقمًا' },
  QA: { pattern: /^\d{11}$/, message: 'رقم الهوية القطرية لازم يكون 11 رقمًا' },
  BH: { pattern: /^\d{9}$/, message: 'الرقم الشخصي البحريني لازم يكون 9 أرقام' },
};

export function documentInputProblem(number: string | null, issuer: string | null, type: string | null) {
  const value = number?.trim() ?? '';
  const numberError = (message: string) => ({ key: 'idNumber', label: 'رقم الوثيقة', message });
  if (type) {
    if (!issuer) return { key: 'idDocumentType', label: 'نوع وثيقة الهوية', message: 'اختر دولة محددة من حقل الدولة لاستخدام هذا النوع من الوثائق' };
    if (!value) return numberError('أدخل رقم الوثيقة');
    const normalized = value.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15));
    const format = type === 'NATIONAL_ID' ? nationalIdFormats[issuer] : undefined;
    if (format && !format.pattern.test(normalized)) return numberError(format.message);
    if (issuer === 'EG' && type === 'NATIONAL_ID') {
      if (!/^\d+$/.test(normalized)) return numberError('رقم الهوية المصرية لازم يحتوي على أرقام فقط');
      if (normalized.length !== 14) return numberError('رقم الهوية المصرية لازم يكون 14 رقمًا');
    } else if (issuer === 'SA' && (type === 'NATIONAL_ID' || type === 'RESIDENCE_PERMIT')) {
      if (!/^\d+$/.test(normalized)) return numberError('رقم الوثيقة السعودية لازم يحتوي على أرقام فقط');
      if (normalized.length !== 10) return numberError('رقم الوثيقة السعودية لازم يكون 10 أرقام');
      if (!normalized.startsWith(type === 'NATIONAL_ID' ? '1' : '2')) {
        return numberError(type === 'NATIONAL_ID' ? 'رقم الهوية السعودية لازم يبدأ بـ 1' : 'رقم الإقامة السعودية لازم يبدأ بـ 2');
      }
    } else {
      if (Array.from(value).length > 40) return numberError('رقم الوثيقة لازم يكون 40 حرفًا أو رقمًا كحد أقصى');
      if (!/^[\p{L}\p{Nd}]/u.test(value)) return numberError('رقم الوثيقة لازم يبدأ بحرف أو رقم');
      if (!DOCUMENT_NUMBER_PATTERN.test(value)) return numberError('رقم الوثيقة فيه رمز غير مسموح');
    }
  } else if (value && !/^[12]\d{9}$/.test(value)) {
    return { key: 'idDocumentType', label: 'نوع وثيقة الهوية', message: 'اختر نوع الوثيقة للتحقق من صيغة الرقم' };
  }
  return null;
}
