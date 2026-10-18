import { phoneToE164, parseStoredPhone } from './phone-countries';

// D2/D3: the phone-input value object -> the E.164 string the API expects, and a stored number -> country + local number to show.
describe('phoneToE164: the API takes a STRING (+<dial><national>), never the phone-input object', () => {
  it('uses the component e164Number', () => {
    expect(phoneToE164({ countryCode: 'AE', dialCode: '+971', number: '50 123 4567', e164Number: '+971501234567' })).toBe('+971501234567');
  });
  it('rebuilds from dial code + number when e164Number is empty: keeps the full number, drops spaces and the trunk zero, no double country code', () => {
    expect(phoneToE164({ countryCode: 'AE', dialCode: '+971', number: '050 123 4567', e164Number: '' })).toBe('+971501234567');
    expect(phoneToE164({ countryCode: 'EG', dialCode: '+20', number: '1025073026', e164Number: '' })).toBe('+201025073026');
    expect(phoneToE164({ countryCode: 'AE', dialCode: '+971', number: '+971501234567', e164Number: '' })).toBe('+971501234567');
    expect(phoneToE164({ countryCode: 'AE', dialCode: '+971', number: '971501234567', e164Number: '' })).toBe('+971501234567');
  });
  it('strings pass through cleaned; empty -> null', () => {
    expect(phoneToE164('+971 50 123 4567')).toBe('+971501234567');
    expect(phoneToE164('0501234567')).toBe('0501234567');
    expect(phoneToE164('')).toBeNull();
    expect(phoneToE164(null)).toBeNull();
    expect(phoneToE164({ countryCode: 'AE', dialCode: '+971', number: '', e164Number: '' })).toBeNull();
  });
});

describe('parseStoredPhone: a stored number shows its own country, never a default', () => {
  it('account pair: code "+20" + national "1025073026" -> Egypt', () => {
    const p = parseStoredPhone('1025073026', '+20');
    expect([p.iso, p.dialCode, p.national, p.ambiguous]).toEqual(['EG', '+20', '1025073026', false]);
  });
  it('E.164 string, with spaces, with missing plus', () => {
    expect(parseStoredPhone('+20 102 507 3026').iso).toBe('EG');
    expect(parseStoredPhone('+971501234567')).toMatchObject({ iso: 'AE', dialCode: '+971', national: '501234567' });
    expect(parseStoredPhone('201025073026')).toMatchObject({ iso: 'EG', national: '1025073026' });
  });
  it('legacy local formats with the account code: trunk zero and a country-code-prefixed number', () => {
    expect(parseStoredPhone('0551234567', '+966')).toMatchObject({ iso: 'SA', national: '551234567' });
    expect(parseStoredPhone('966551234567', '+966')).toMatchObject({ iso: 'SA', national: '551234567' });
  });
  it('shared dial codes: +1 US/CA number resolved by libphonenumber, +7 KZ/RU', () => {
    expect(parseStoredPhone('+12125550123')).toMatchObject({ dialCode: '+1', iso: 'US', ambiguous: false });
    expect(parseStoredPhone('+14165550123')).toMatchObject({ dialCode: '+1', iso: 'CA', ambiguous: false });
    expect(parseStoredPhone('+77012345678').dialCode).toBe('+7');
  });
  it('ambiguous: a +1 number libphonenumber cannot place keeps the dial code and full number, no silent country', () => {
    const p = parseStoredPhone('+1999999', undefined);
    expect(p.iso).toBeNull();
    expect(p.dialCode).toBe('+1');
    expect(p.national).toBe('999999');
    expect(p.ambiguous).toBe(true);
  });
  it('unknown legacy local number with no code: shown as typed, no country, ambiguous', () => {
    const p = parseStoredPhone('0123456');
    expect([p.iso, p.dialCode, p.ambiguous]).toEqual([null, null, true]);
    expect(p.national).toBe('0123456');
  });
  it('empty -> empty', () => {
    expect(parseStoredPhone('', '+20')).toMatchObject({ national: '', iso: null, ambiguous: false });
  });
});
