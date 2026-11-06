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

const egyptianBirthCodes = new Set('01 02 03 04 11 12 13 14 15 16 17 18 19 21 22 23 24 25 26 27 28 29 31 32 33 34 35 88'.split(' '));

// Turkish T.C. Kimlik No: the last two digits are computed from the first nine.
function validTurkishNationalId(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const digits = Array.from(value, Number);
  const odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const even = digits[1] + digits[3] + digits[5] + digits[7];
  return digits[9] === ((7 * odd - even) % 10 + 10) % 10 &&
    digits[10] === digits.slice(0, 10).reduce((sum, d) => sum + d, 0) % 10;
}

function egyptianIdStructure(value: string): 'CENTURY' | 'DATE' | 'BIRTH_CODE' | null {
  if (!/^[23]/.test(value)) return 'CENTURY';
  const year = (value[0] === '2' ? 1900 : 2000) + Number(value.slice(1, 3));
  const month = Number(value.slice(3, 5));
  const day = Number(value.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day && date.getTime() <= Date.now() ? (egyptianBirthCodes.has(value.slice(7, 9)) ? null : 'BIRTH_CODE') : 'DATE';
}

export function documentInputProblem(number: string | null, issuer: string | null, type: string | null) {
  const value = number?.trim() ?? '';
  const numberError = (message: string) => ({ key: 'idNumber', label: 'رقم الوثيقة', message });
  if (type) {
    if (!issuer) return { key: 'idDocumentType', label: 'نوع وثيقة الهوية', message: 'اختر دولة محددة من حقل الدولة لاستخدام هذا النوع من الوثائق' };
    if (!value) return numberError('أدخل رقم الوثيقة');
    const normalized = value.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15));
    const format = type === 'NATIONAL_ID' ? nationalIdFormats[issuer] : undefined;
    if (format && !format.pattern.test(normalized)) return numberError(format.message);
    if (issuer === 'TR' && type === 'NATIONAL_ID' && !validTurkishNationalId(normalized)) {
      return numberError('رقم الهوية التركية غير صالح؛ راجع الأرقام وأعد إدخاله');
    }
    if (issuer === 'EG' && type === 'NATIONAL_ID') {
      if (!/^\d+$/.test(normalized)) return numberError('رقم الهوية المصرية لازم يحتوي على أرقام فقط');
      if (normalized.length !== 14) return numberError('رقم الهوية المصرية لازم يكون 14 رقمًا');
      const structure = egyptianIdStructure(normalized);
      if (structure === 'CENTURY') return numberError('رقم الهوية المصرية لازم يبدأ بـ 2 أو 3');
      if (structure === 'BIRTH_CODE') return numberError('كود جهة تسجيل الميلاد داخل رقم الهوية المصرية غير صالح');
      if (structure === 'DATE') return numberError('تاريخ الميلاد داخل رقم الهوية المصرية غير صالح');
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
