import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PROVIDER_GATE_MESSAGE, providerGateInterceptor } from './provider-gate.interceptor';
import { AuthStore } from '../store/auth.store';
import { ProviderAccessService } from '../services/provider-access.service';

describe('providerGateInterceptor', () => {
	function setup(role: string, state: any) {
		const invalidate = vi.fn();
		const load = vi.fn(() => of({ message: '', reason: null, hasSample: false, specialties: [], canAccessDashboard: false, ...state }));
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]), provideHttpClient(withInterceptors([providerGateInterceptor])), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { actingRole: signal(role) } },
				{ provide: ProviderAccessService, useValue: { invalidate, load } },
			],
		});
		const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		return { invalidate, load, nav, http: TestBed.inject(HttpClient), ctl: TestBed.inject(HttpTestingController) };
	}
	afterEach(() => TestBed.resetTestingModule());
	const gate = { status: 403, statusText: 'Forbidden' };

	it('gate 403 for a PROVIDER: invalidates, re-reads, goes to the wizard (setup unfinished); the error still reaches the caller', () => {
		const { http, ctl, invalidate, load, nav } = setup('PROVIDER', { state: 'ASSESSMENT_REQUIRED' });
		let err: any;
		http.get('/api/provider/statistics').subscribe({ error: e => (err = e) });
		ctl.expectOne('/api/provider/statistics').flush({ success: false, message: PROVIDER_GATE_MESSAGE }, gate);
		expect(err.status).toBe(403);
		expect(invalidate).toHaveBeenCalled();
		expect(load).toHaveBeenCalledTimes(1);
		expect(nav).toHaveBeenCalledWith('/provider-overview/profile/setup');
	});
	it('pending review goes to the status page; several gated 403s at once cause one redirect', () => {
		const sync = setup('PROVIDER', { state: 'PENDING_REVIEW' });
		sync.http.get('/a').subscribe({ error: () => {} });
		sync.http.get('/b').subscribe({ error: () => {} });
		sync.ctl.expectOne('/a').flush({ message: PROVIDER_GATE_MESSAGE }, gate);
		sync.ctl.expectOne('/b').flush({ message: PROVIDER_GATE_MESSAGE }, gate);
		expect(sync.nav).toHaveBeenCalledWith('/provider-overview/account-actions');
		expect(sync.load.mock.calls.length).toBeGreaterThanOrEqual(1);
	});
	it('other 403 messages, other statuses and non-provider sessions are left alone', () => {
		const a = setup('PROVIDER', { state: 'PENDING_REVIEW' });
		a.http.get('/x').subscribe({ error: () => {} });
		a.ctl.expectOne('/x').flush({ message: 'ممنوع' }, gate);
		a.http.get('/y').subscribe({ error: () => {} });
		a.ctl.expectOne('/y').flush({ message: PROVIDER_GATE_MESSAGE }, { status: 500, statusText: 'x' });
		expect(a.nav).not.toHaveBeenCalled();
		TestBed.resetTestingModule();
		const b = setup('CLIENT', { state: 'PENDING_REVIEW' });
		b.http.get('/z').subscribe({ error: () => {} });
		b.ctl.expectOne('/z').flush({ message: PROVIDER_GATE_MESSAGE }, gate);
		expect(b.load).not.toHaveBeenCalled();
	});
	it('an approved answer (stale gate) does not redirect', () => {
		const { http, ctl, nav } = setup('PROVIDER', { state: 'APPROVED', canAccessDashboard: true });
		http.get('/x').subscribe({ error: () => {} });
		ctl.expectOne('/x').flush({ message: PROVIDER_GATE_MESSAGE }, gate);
		expect(nav).not.toHaveBeenCalled();
	});
});
