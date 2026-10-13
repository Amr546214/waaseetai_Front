import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ClientOfferCounterService } from './client-offer-counter.service';
import { environment } from '../../../environments/environment';

describe('ClientOfferCounterService', () => {
	let svc: ClientOfferCounterService;
	let http: HttpTestingController;
	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		svc = TestBed.inject(ClientOfferCounterService);
		http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => http.verify());

	it('accept posts ONLY the counter message id to the request/offer accept route and unwraps data', () => {
		let out: any;
		svc.acceptCounter('req-1', 'offer-1', 'ctr-1').subscribe(r => (out = r));
		const req = http.expectOne(`${environment.url_api}/client/my-requests/req-1/offers/offer-1/counter/accept`);
		expect(req.request.method).toBe('POST');
		expect(req.request.body).toEqual({ messageId: 'ctr-1' });
		req.flush({ success: true, data: { offerId: 'offer-1', status: 'SUBMITTED', price: 880, deliveryDays: 18 } });
		expect(out.price).toBe(880);
	});

	it('getCounter reads the pending counter', () => {
		let out: any;
		svc.getCounter('req-1', 'offer-1').subscribe(r => (out = r));
		const req = http.expectOne(`${environment.url_api}/client/my-requests/req-1/offers/offer-1/counter`);
		expect(req.request.method).toBe('GET');
		req.flush({ data: { canAccept: true, counter: { messageId: 'ctr-1' } } });
		expect(out.canAccept).toBe(true);
	});

	it('a server refusal reaches the caller untouched (409 text is shown by the page)', () => {
		let err: any;
		svc.acceptCounter('req-1', 'offer-1', 'old').subscribe({ error: e => (err = e) });
		http.expectOne(() => true).flush({ message: 'x' }, { status: 409, statusText: 'Conflict' });
		expect(err.status).toBe(409);
		expect(err.error.message).toBe('x');
	});
});
