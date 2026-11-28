import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { normalizeCountry } from './countries-cities';
import { timezoneForCountry } from './country-timezones';

/** A country selection (including an initial geo suggestion) updates its zone without relying on the control's dirty flag. */
export function linkCountryTimezone(group: AbstractControl | null, destroyRef: DestroyRef, changed?: () => void): void {
  const country = group?.get('country');
  const timezone = group?.get('timezone');
  if (!country || !timezone) return;
  let previous = normalizeCountry(country.value);
  if (!timezone.value) timezone.setValue(timezoneForCountry(previous) ?? '', { emitEvent: false });
  country.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(value => {
    const next = normalizeCountry(value);
    if (next === previous) return;
    previous = next;
    const zone = timezoneForCountry(next) ?? '';
    if (timezone.value === zone) return;
    timezone.setValue(zone);
    changed?.();
  });
}
