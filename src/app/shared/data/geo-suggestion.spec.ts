import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { GeoSuggestionService, suggestionFor } from './geo-suggestion';

const U = `${environment.url_api}/public/geo-suggestion`;
const dto = (o: object) => ({ success: true, data: { countryCode: null, city: null, timezone: null, source: 'geoip-provider', approximate: true, ...o } });
describe('geo suggestion: a hint for EMPTY fields only', () => {
	const setup = () => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); return { svc: TestBed.inject(GeoSuggestionService), http: TestBed.inject(HttpTestingController) }; };
	it('maps a country (and a known city of that country) to the select values; unknown country or city gives nothing / country only', () => {
		expect(suggestionFor({ countryCode: 'SA', city: 'Riyadh', timezone: null, source: 'geoip-provider', approximate: true })).toEqual({ country: 'السعودية', city: 'الرياض' });
		expect(suggestionFor({ countryCode: 'SA', city: 'Smallville', timezone: null, source: 'cdn-header', approximate: true })).toEqual({ country: 'السعودية', city: null });
		expect(suggestionFor({ countryCode: 'EG', city: 'Dubai', timezone: null, source: 'cdn-header', approximate: true })).toEqual({ country: 'مصر', city: null }); // a city of ANOTHER country is never put in
		expect(suggestionFor({ countryCode: 'ZZ', city: null, timezone: null, source: 'geoip-provider', approximate: true })).toBeNull();
		expect(suggestionFor({ countryCode: 'SA', city: null, timezone: null, source: 'none', approximate: true })).toBeNull();
	});
	it('fills both empty fields once and reports it', () => {
		const { svc, http } = setup(); const g = new FormGroup({ country: new FormControl(''), city: new FormControl('') }); const applied = vi.fn();
		svc.suggestInto(g, applied); http.expectOne(U).flush(dto({ countryCode: 'AE', city: 'Dubai' })); expect(g.value).toEqual({ country: 'الإمارات', city: 'دبي' }); expect(applied).toHaveBeenCalledTimes(1);
	});
	it('never asks, and never replaces, when the user or the saved profile already has a country or city', () => {
		const { svc, http } = setup(); const saved = new FormGroup({ country: new FormControl('مصر'), city: new FormControl('') }); svc.suggestInto(saved, vi.fn()); http.expectNone(U); expect(saved.value.country).toBe('مصر');
		const typing = new FormGroup({ country: new FormControl(''), city: new FormControl('') }); const applied = vi.fn(); svc.suggestInto(typing, applied);
		typing.get('country')!.setValue('تركيا'); typing.get('country')!.markAsDirty(); http.expectOne(U).flush(dto({ countryCode: 'SA', city: 'Riyadh' }));
		expect(typing.value).toEqual({ country: 'تركيا', city: '' }); expect(applied).not.toHaveBeenCalled();
	});
	it('a failure or an empty answer leaves the manual fields exactly as they were', () => {
		const { svc, http } = setup(); const g = new FormGroup({ country: new FormControl(''), city: new FormControl('') }); const applied = vi.fn();
		svc.suggestInto(g, applied); http.expectOne(U).flush('x', { status: 500, statusText: 'x' }); expect(g.value).toEqual({ country: '', city: '' });
		svc.suggestInto(g, applied); http.expectOne(U).flush(dto({ source: 'none' })); expect(applied).not.toHaveBeenCalled();
	});
});
