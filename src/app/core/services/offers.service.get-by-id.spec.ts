import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OffersService } from './offers.service';
import { environment } from '../../../environments/environment';

describe('OffersService.getOfferById', () => {
	beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));

	it('asks the single-offer endpoint (works beyond the first list page) and returns the item', () => {
		const http = TestBed.inject(HttpTestingController);
		let got: any;
		TestBed.inject(OffersService).getOfferById('offer-99').subscribe(v => (got = v));
		const req = http.expectOne(`${environment.url_api}/provider/offers/offer-99`);
		expect(req.request.method).toBe('GET');
		req.flush({ success: true, data: { id: 'offer-99', projectId: 'p9' } });
		expect(got).toEqual({ id: 'offer-99', projectId: 'p9' });
		http.verify();
	});

	it('a 404 (not found / not yours) reaches the caller as an error', () => {
		const http = TestBed.inject(HttpTestingController);
		let err: any;
		TestBed.inject(OffersService).getOfferById('x').subscribe({ error: e => (err = e) });
		http.expectOne(`${environment.url_api}/provider/offers/x`).flush({ message: 'العرض غير موجود' }, { status: 404, statusText: 'Not Found' });
		expect(err.status).toBe(404);
	});
});
