import { DestroyRef } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it, vi } from 'vitest';
import { linkCountryTimezone } from './country-timezone-form';
const ref = { onDestroy: () => () => {} } as unknown as DestroyRef;
const form = (country = '', timezone = '') => new FormGroup({ country: new FormControl(country), timezone: new FormControl(timezone) });
describe('country-driven profile time zone', () => {
  it('starts empty without a country instead of inventing Saudi time', () => {
    const f = form(); linkCountryTimezone(f, ref); expect(f.value.timezone).toBe('');
  });
  it('derives a loaded country without needing a dirty control (the onboarding regression)', () => {
    const f = form(); linkCountryTimezone(f, ref);
    f.patchValue({country: 'مصر'});
    expect(f.get('country')!.pristine).toBe(true);
    expect(f.value.timezone).toBe('Africa/Cairo');
    f.get('country')!.setValue('الإمارات'); expect(f.value.timezone).toBe('Asia/Dubai');
  });
  it('keeps a saved preference on initial load, but a later country selection updates it', () => {
    const f = form('مصر', 'GMT'); linkCountryTimezone(f, ref);
    expect(f.value.timezone).toBe('GMT');
    f.get('country')!.setValue('السعودية'); expect(f.value.timezone).toBe('Asia/Riyadh');
  });
  it('normalizing an unchanged country does not overwrite a manually selected zone', () => {
    const f = form('مصر'); linkCountryTimezone(f, ref);
    f.get('timezone')!.setValue('GMT'); f.get('country')!.setValue('مصر');
    expect(f.value.timezone).toBe('GMT');
  });
  it('does not carry another country zone into an unknown or cleared country', () => {
    const f = form('مصر'); linkCountryTimezone(f, ref);
    f.get('country')!.setValue('دولة أخرى'); expect(f.value.timezone).toBe('');
    f.get('country')!.setValue('السعودية'); f.get('country')!.setValue(''); expect(f.value.timezone).toBe('');
  });
  it('only notifies when the derived time zone actually changes', () => {
    const f = form(); const changed = vi.fn(); linkCountryTimezone(f, ref, changed);
    f.get('country')!.setValue('مصر'); f.get('country')!.setValue('مصر');
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
