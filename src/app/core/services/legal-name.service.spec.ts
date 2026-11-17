import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LegalNameService } from './legal-name.service';

describe('LegalNameService: the document check compares with the name that was just typed', () => {
	let svc: LegalNameService; let http: HttpTestingController;
	beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); svc = TestBed.inject(LegalNameService); http = TestBed.inject(HttpTestingController); });
	afterEach(() => http.verify());

	it('declaredName waits for a save that is in flight, then reads the saved name', () => {
		let declared: string | undefined;
		svc.save('عمرو محمود').subscribe();
		const put = http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/legal-name'));
		svc.declaredName().subscribe(v => declared = v);
		http.expectNone(r => r.method === 'GET');           // no read while the save is running
		put.flush({ success: true, data: { outcome: 'SAVED', view: {} } });
		http.expectOne(r => r.method === 'GET' && r.url.endsWith('/legal-name')).flush({ success: true, data: { status: 'PROVIDED', legalName: ' عمرو محمود ', changeNeedsReview: false, pendingRequest: null } });
		expect(declared).toBe('عمرو محمود');
	});

	it('with no save running it reads at once; a failed save does not block the check; no name -> empty', () => {
		let declared: string | undefined;
		svc.declaredName().subscribe(v => declared = v);
		http.expectOne(r => r.method === 'GET').flush({ success: true, data: { status: 'MISSING', legalName: null, changeNeedsReview: false, pendingRequest: null } });
		expect(declared).toBe('');
		svc.save('x y').subscribe({ error: () => undefined });
		http.expectOne(r => r.method === 'PUT').flush({}, { status: 500, statusText: 'err' });
		let after: string | undefined; svc.declaredName().subscribe(v => after = v);
		http.expectOne(r => r.method === 'GET').flush({ success: true, data: { status: 'PROVIDED', legalName: 'a b', changeNeedsReview: false, pendingRequest: null } });
		expect(after).toBe('a b');
	});
});
