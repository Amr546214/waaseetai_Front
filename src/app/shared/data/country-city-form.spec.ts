import { DestroyRef } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { linkCountryCity } from './country-city-form';

const destroyRef = { onDestroy: () => () => {} } as unknown as DestroyRef;
const makeForm = (country = '', city = '') => new FormGroup({ country: new FormControl(country), city: new FormControl(city) });

describe('linkCountryCity', () => {
	it('changing the country clears the city immediately', () => {
		const f = makeForm('السعودية', 'جدة');
		linkCountryCity(f, destroyRef);
		f.get('country')!.setValue('مصر');
		expect(f.get('city')!.value).toBe('');
	});

	it('even "مدينة أخرى" (present in every list) is cleared when the country changes', () => {
		const f = makeForm('السعودية', 'مدينة أخرى');
		linkCountryCity(f, destroyRef);
		f.get('country')!.setValue('مصر');
		expect(f.get('city')!.value).toBe('');
	});

	it('loading saved data keeps a city that belongs to the country, in either patch order', () => {
		const a = makeForm();
		linkCountryCity(a, destroyRef);
		a.patchValue({ country: 'مصر', city: 'القاهرة' });
		expect(a.get('city')!.value).toBe('القاهرة');

		const b = makeForm();
		linkCountryCity(b, destroyRef);
		b.get('city')!.setValue('القاهرة');
		b.get('country')!.setValue('مصر');
		expect(b.get('city')!.value).toBe('القاهرة');
	});

	it('a city saved before the fix that does not belong to the country (Riyadh under Egypt) is cleared on load', () => {
		const f = makeForm();
		linkCountryCity(f, destroyRef);
		f.patchValue({ country: 'مصر', city: 'الرياض' });
		expect(f.get('city')!.value).toBe('');
	});

	it('city is disabled until a country is chosen, then enabled and required', () => {
		const f = makeForm();
		linkCountryCity(f, destroyRef);
		expect(f.get('city')!.disabled).toBe(true);
		f.get('country')!.setValue('مصر');
		expect(f.get('city')!.enabled).toBe(true);
		expect(f.get('city')!.valid).toBe(false);
		f.get('city')!.setValue('القاهرة');
		expect(f.get('city')!.valid).toBe(true);
	});

	it('canonicalises a legacy country spelling', () => {
		const f = makeForm('المملكة العربية السعودية', '');
		linkCountryCity(f, destroyRef);
		expect(f.get('country')!.value).toBe('السعودية');
	});
});
