import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, Validators } from '@angular/forms';
import { isCityOf, normalizeCountry } from './countries-cities';

/**
 * Keeps a form group's country + city controls consistent (used by every profile/setup form):
 *  - changing the country clears the city immediately (it cannot stay valid for another country);
 *    the one exception is the initial fill of an empty country from saved data, where a city that
 *    belongs to that country is kept and one that does not (e.g. a city saved before this fix, like
 *    Riyadh under Egypt) is cleared so the user must pick again;
 *  - the city control is disabled until a country is chosen, and required once one is.
 * Pass the FormGroup that holds the `country` and `city` controls.
 */
export function linkCountryCity(
	group: AbstractControl | null,
	destroyRef: DestroyRef,
	keys: { country: string; city: string } = { country: 'country', city: 'city' },
): void {
	const country = group?.get(keys.country);
	const city = group?.get(keys.city);
	if (!country || !city) return;

	// Saved spellings like 'المملكة العربية السعودية' / 'غير ذلك' become the canonical option value.
	const canonical = normalizeCountry(country.value);
	if (canonical && canonical !== country.value) country.setValue(canonical, { emitEvent: false });
	let previous = canonical;
	const syncRequired = () => {
		const hasCountry = !!normalizeCountry(country.value);
		if (hasCountry && !city.hasValidator(Validators.required)) city.addValidators(Validators.required);
		if (!hasCountry && city.hasValidator(Validators.required)) city.removeValidators(Validators.required);
		// No country yet => the city select is disabled (its placeholder says to pick the country first).
		if (hasCountry && city.disabled) city.enable({ emitEvent: false });
		if (!hasCountry && city.enabled) city.disable({ emitEvent: false });
		city.updateValueAndValidity({ emitEvent: false });
	};
	syncRequired();

	country.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((value) => {
		const next = normalizeCountry(value);
		if (next && next !== value) country.setValue(next, { emitEvent: false });
		if (next === previous) return;
		const initialFill = previous === '';
		previous = next;
		if (!(initialFill && isCityOf(next, city.value))) city.setValue('');
		syncRequired();
	});

	// A city that does not belong to the current country (e.g. one saved before this fix) can never stay.
	city.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((value) => {
		if (value && previous && !isCityOf(previous, value)) city.setValue('');
	});
}
