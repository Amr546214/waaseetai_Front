import { canonicalStoredPhone, isValidNationalNumber, isoForCallingCode, splitPhoneInput } from './phone-countries';

describe('phone countries (country code + local number must belong together)', () => {
  it('pasting "+201025073026" gives country +20 and the local number 1025073026', () => {
    expect(splitPhoneInput('+201025073026', '+966')).toEqual({ countryCode: '+20', nationalNumber: '1025073026' });
    expect(splitPhoneInput('+20 102 507 3026')).toEqual({ countryCode: '+20', nationalNumber: '1025073026' });
  });
  it('pasting "201025073026" (no +) gives country +20 and 1025073026, even when Saudi Arabia was selected', () => {
    expect(splitPhoneInput('201025073026', '+966')).toEqual({ countryCode: '+20', nationalNumber: '1025073026' });
    expect(splitPhoneInput('201025073026', '+20')).toEqual({ countryCode: '+20', nationalNumber: '1025073026' });
  });
  it('the local number of the selected country is kept (with or without the trunk zero)', () => {
    expect(splitPhoneInput('01025073026', '+20')).toEqual({ countryCode: '+20', nationalNumber: '1025073026' });
    expect(splitPhoneInput('0501234567', '+966')).toEqual({ countryCode: '+966', nationalNumber: '501234567' });
    expect(splitPhoneInput('966501234567', '+966')).toEqual({ countryCode: '+966', nationalNumber: '501234567' });
  });
  it('Saudi Arabia selected with an Egyptian local number (and the reverse) is NOT a valid pair', () => {
    expect(isValidNationalNumber('+966', '1025073026')).toBe(false);
    expect(isValidNationalNumber('+20', '501234567')).toBe(false);
    expect(isValidNationalNumber('+20', '1025073026')).toBe(true);
    expect(isValidNationalNumber('+966', '501234567')).toBe(true);
    expect(splitPhoneInput('1025073026', '+966')).toBeNull();
    expect(splitPhoneInput('abc', '+966')).toBeNull();
  });
  it('a stored pair comes back the same after a refresh; an Egyptian number saved next to +966 is shown as +20, never as Saudi', () => {
    expect(canonicalStoredPhone('+20', '1025073026')).toEqual({ countryCode: '+20', nationalNumber: '1025073026', display: '+20 1025073026', consistent: true });
    const bad = canonicalStoredPhone('+966', '201025073026');
    expect([bad.countryCode, bad.nationalNumber, bad.display, bad.consistent]).toEqual(['+20', '1025073026', '+20 1025073026', false]);
    expect(canonicalStoredPhone('+966', '0501234567').display).toBe('+966 501234567');
    expect(canonicalStoredPhone(null, '501234567').display).toBe('+966 501234567');
  });
  it('calling code -> region used to pick the flag', () => {
    expect(isoForCallingCode('+20')).toBe('EG');
    expect(isoForCallingCode('+966')).toBe('SA');
    expect(isoForCallingCode('+999999')).toBeNull();
  });
});
