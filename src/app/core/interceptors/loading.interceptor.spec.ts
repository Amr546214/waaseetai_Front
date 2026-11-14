import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, vi } from 'vitest';
import { loadingInterceptor } from './loading.interceptor';
import { LoadingService } from '../services/loading.service';

describe('loadingInterceptor: the identity editors never take the whole-page loader', () => {
	const setup = () => {
		const show = vi.fn(), hide = vi.fn();
		TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([loadingInterceptor])), provideHttpClientTesting(), { provide: LoadingService, useValue: { show, hide, start: show, stop: hide } }] });
		return { http: TestBed.inject(HttpClient), ctl: TestBed.inject(HttpTestingController), loading: TestBed.inject(LoadingService) as any };
	};
	it('admin identity requests (read, check, apply, restore) and the public manifest are silent', () => {
		const { http, ctl, loading } = setup();
		for (const url of ['/api/admin/site-identity/', '/api/admin/site-identity/tokens.components/publish', '/api/public/site-identity']) http.get(url).subscribe();
		ctl.match(() => true).forEach(r => r.flush({}));
		expect(Object.values<any>(loading).filter(f => typeof f?.mock === 'object').every(f => f.mock.calls.length === 0)).toBe(true);
	});
	it('any other request still uses the loader as before', () => {
		const { http, ctl, loading } = setup();
		http.get('/api/admin/users').subscribe();
		const calls = Object.values<any>(loading).filter(f => typeof f?.mock === 'object').reduce((n, f) => n + f.mock.calls.length, 0);
		expect(calls).toBeGreaterThan(0);
		ctl.match(() => true).forEach(r => r.flush({}));
	});
});
