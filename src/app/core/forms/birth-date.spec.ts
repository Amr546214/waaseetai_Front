import { birthDateValidator, dobDisplay, dobInputValue } from './birth-date';
import { FormControl } from '@angular/forms';

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
