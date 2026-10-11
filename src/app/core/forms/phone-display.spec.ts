import { nationalPhoneForInput, normalizedCountryCode, phoneForDisplay } from './phone-display';
import { birthDateValidator, dobDisplay, dobInputValue } from './birth-date';
import { FormControl } from '@angular/forms';

describe('phone display (code once, national digits in the input)', () => {
  it('Saudi +966: national digits, stored in any older shape', () => {
    expect(nationalPhoneForInput('+966', '501234567')).toBe('501234567');
    expect(nationalPhoneForInput('+966', '0501234567')).toBe('501234567');         // leading zero
    expect(nationalPhoneForInput('+966', '+966501234567')).toBe('501234567');      // full international: the code is not repeated
    expect(nationalPhoneForInput('966', '+966 50 123 4567')).toBe('501234567');
  });
  it('Egypt +20 works the same way', () => {
    expect(nationalPhoneForInput('+20', '1012345678')).toBe('1012345678');
    expect(nationalPhoneForInput('+20', '01012345678')).toBe('1012345678');
    expect(nationalPhoneForInput('+20', '+201012345678')).toBe('1012345678');
  });
  it('a missing code falls back to +966, and the display joins one + with one code', () => {
    expect(normalizedCountryCode(null)).toBe('+966');
    expect(normalizedCountryCode('20')).toBe('+20');
    expect(phoneForDisplay('+966', '+966501234567')).toBe('+966 501234567');
    expect(phoneForDisplay('+20', '01012345678')).toBe('+20 1012345678');
    expect(phoneForDisplay('+966', '')).toBe('');
  });
});

describe('date of birth helpers', () => {
  it('a stored ISO date becomes the date input value and the dd/mm/yyyy reading, with no timezone shift', () => {
    expect(dobInputValue('1990-05-17T00:00:00.000Z')).toBe('1990-05-17');
    expect(dobDisplay('1990-05-17T00:00:00.000Z')).toBe('17/05/1990');
    expect(dobInputValue(null)).toBe('');
    expect(dobInputValue('garbage')).toBe('');
  });
  it('the validator accepts empty and past dates, rejects the future, garbage and years before 1900', () => {
    const v = (x: string) => birthDateValidator(new FormControl(x));
    expect(v('')).toBeNull();
    expect(v('1990-05-17')).toBeNull();
    expect(v('2999-01-01')).toEqual({ birthDate: true });
    expect(v('1800-01-01')).toEqual({ birthDate: true });
    expect(v('not-a-date')).toEqual({ birthDate: true });
  });
});
