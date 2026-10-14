import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ProviderAccessService } from './provider-access.service';
import { AuthStore } from '../store/auth.store';

@Component({ standalone: true, template: '' }) class Blank {}
const mk = (state: string, can = false) => ({ success: true, data: { state, canAccessDashboard: can, message: '', reason: null, hasSample: false, specialties: [] } });
const STATUS = '/provider-overview/accreditation-status';
const WIZARD = '/provider-overview/profile/setup';

describe('ProviderAccessService state watcher (stale route shell)', () => {
	function setup(user: any = { id: 'u', accountType: 'PROVIDER_INDIVIDUAL', activeRole: 'PROVIDER' }) {
		const routes = ['provider-overview/business-models/center', 'provider-overview/accreditation-status', 'provider-overview/profile/setup', 'provider-overview/offers', 'provider-overview/help', 'client-overview'].map(path => ({ path, component: Blank }));
		TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting(), { provide: AuthStore, useValue: { currentUser: signal(user) } }] });
		const svc = TestBed.inject(ProviderAccessService);
		const router = TestBed.inject(Router);
		const http = TestBed.inject(HttpTestingController);
		const read = async (body: any, status = 200) => {
			svc.load().subscribe({ error: () => {} });
			http.expectOne(r => r.url.endsWith('/provider/access-state')).flush(body, { status, statusText: 'x' });
			await new Promise(r => setTimeout(r, 0));
		};
		return { svc, router, http, read, nav: vi.spyOn(router, 'navigateByUrl') };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('stale shell: the page rendered on a faked APPROVED, the next honest PENDING_REVIEW answer moves it to the status page', async () => {
		const { router, read } = setup();
		await router.navigateByUrl('/provider-overview/business-models/center');
		await read(mk('APPROVED', true));
		expect(router.url).toBe('/provider-overview/business-models/center');
		await read(mk('PENDING_REVIEW'));
		expect(router.url).toBe(STATUS);
	});
	it('ASSESSMENT_REQUIRED / SETUP_INCOMPLETE move it to the wizard', async () => {
		for (const s of ['ASSESSMENT_REQUIRED', 'SETUP_INCOMPLETE']) {
			TestBed.resetTestingModule();
			const { router, read } = setup();
			await router.navigateByUrl('/provider-overview/business-models/center');
			await read(mk(s));
			expect(router.url).toBe(WIZARD);
		}
	});
	it('a route change right after an unapproved answer is re-checked (guard bypassed)', async () => {
		const { router, read } = setup();
		await router.navigateByUrl('/provider-overview/help');
		await read(mk('PENDING_REVIEW'));
		expect(router.url).toBe('/provider-overview/help');
		await router.navigateByUrl('/provider-overview/offers');
		await new Promise(r => setTimeout(r, 0));
		expect(router.url).toBe(STATUS);
	});
	it('no loop and no extra navigation when already on the target or on an allow-listed page', async () => {
		const { router, read, nav } = setup();
		await router.navigateByUrl(STATUS);
		await read(mk('PENDING_REVIEW'));
		await router.navigateByUrl('/provider-overview/help');
		await read(mk('ASSESSMENT_REQUIRED'));
		expect(router.url).toBe('/provider-overview/help');
		expect(nav).toHaveBeenCalledTimes(2); // only the two test-driven navigations
	});
	it('errors / 429 do nothing', async () => {
		const { router, read } = setup();
		await router.navigateByUrl('/provider-overview/business-models/center');
		await read({ success: false, message: 'x' }, 429);
		await read({ success: false }, 500);
		expect(router.url).toBe('/provider-overview/business-models/center');
	});
	it('approved, company and non-provider-area URLs are untouched', async () => {
		const a = setup();
		await a.router.navigateByUrl('/provider-overview/business-models/center');
		await a.read(mk('APPROVED', true));
		expect(a.router.url).toBe('/provider-overview/business-models/center');
		TestBed.resetTestingModule();
		const c = setup({ id: 'c', accountType: 'PROVIDER_COMPANY', activeRole: 'PROVIDER' });
		await c.router.navigateByUrl('/provider-overview/business-models/center');
		await c.read(mk('PENDING_REVIEW'));
		expect(c.router.url).toBe('/provider-overview/business-models/center');
		TestBed.resetTestingModule();
		const k = setup();
		await k.router.navigateByUrl('/client-overview');
		await k.read(mk('PENDING_REVIEW'));
		expect(k.router.url).toBe('/client-overview');
	});
});
