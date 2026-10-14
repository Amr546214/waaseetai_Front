import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ProviderAccessService } from './provider-access.service';
import { AuthStore } from '../store/auth.store';

describe('ProviderAccessService', () => {
	function setup() {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthStore, useValue: { currentUser: signal<any>({ id: 'u' }) } }] });
		return { svc: TestBed.inject(ProviderAccessService), http: TestBed.inject(HttpTestingController) };
	}
	afterEach(() => TestBed.resetTestingModule());
	const body = { success: true, data: { state: 'PENDING_REVIEW', canAccessDashboard: false, message: 'm', reason: null, hasSample: true, specialties: [] } };

	it('reads GET /provider/access-state; concurrent reads share one request; the next navigation asks again', () => {
		const { svc, http } = setup();
		const got: any[] = [];
		svc.load().subscribe(v => got.push(v));
		svc.load().subscribe(v => got.push(v));
		const req = http.expectOne(r => r.url.endsWith('/provider/access-state'));
		req.flush(body);
		expect(got.length).toBe(2);
		expect(svc.latest()?.state).toBe('PENDING_REVIEW');
		svc.load().subscribe();
		http.expectOne(r => r.url.endsWith('/provider/access-state')).flush(body);
	});
	it('an unusable response is an error (never treated as open) and invalidate() forgets the answer', () => {
		const { svc, http } = setup();
		let err = false;
		svc.load().subscribe({ error: () => (err = true) });
		http.expectOne(r => r.url.endsWith('/provider/access-state')).flush({ success: false });
		expect(err).toBe(true);
		svc.load().subscribe();
		http.expectOne(r => r.url.endsWith('/provider/access-state')).flush(body);
		svc.invalidate();
		expect(svc.latest()).toBeNull();
	});
});
