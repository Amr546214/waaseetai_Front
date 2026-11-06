export const IDENTITY_DOCUMENT_TYPES = [
  { code: 'NATIONAL_ID', label: 'بطاقة هوية وطنية' },
  { code: 'PASSPORT', label: 'جواز سفر' },
  { code: 'RESIDENCE_PERMIT', label: 'إقامة' },
  { code: 'DRIVING_LICENCE', label: 'رخصة قيادة' }
] as const;

export const DOCUMENT_NUMBER_PATTERN = /^[\p{L}\p{Nd}][\p{L}\p{Nd} /.-]{0,39}$/u;

const regions = new Intl.DisplayNames(['ar'], { type: 'region', fallback: 'none' });
export const IDENTITY_ISSUERS = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
  .map(code => ({ code, label: regions.of(code) ?? code }))
  .sort((a, b) => a.label.localeCompare(b.label, 'ar'));

export function documentInputProblem(number: string | null, issuer: string | null, type: string | null) {
  const value = number?.trim() ?? '';
  if (issuer || type) {
    if (!issuer) return { key: 'idIssuingCountry', label: 'بلد إصدار الوثيقة', message: 'اختر بلد إصدار الوثيقة' };
    if (!type) return { key: 'idDocumentType', label: 'نوع وثيقة الهوية', message: 'اختر نوع وثيقة الهوية' };
    const normalized = value.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15));
    if (!(issuer === 'EG' && type === 'NATIONAL_ID' ? /^\d{14}$/.test(normalized) : DOCUMENT_NUMBER_PATTERN.test(value))) {
      return { key: 'idNumber', label: 'رقم الوثيقة', message: 'اكتب رقم الوثيقة بصيغة صحيحة لبلد الإصدار ونوع الوثيقة' };
    }
  } else if (value && !/^[12]\d{9}$/.test(value)) {
    return { key: 'idIssuingCountry', label: 'بلد إصدار الوثيقة', message: 'اختر بلد إصدار الوثيقة ونوعها لهذا الرقم' };
  }
  return null;
}
