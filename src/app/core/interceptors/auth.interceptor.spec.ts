import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { authInterceptor, AUTH_ATTEMPT_URLS } from './auth.interceptor';
import { AuthStore } from '../store/auth.store';

describe('authInterceptor 401 handling', () => {
	let http: HttpClient;
	let ctl: HttpTestingController;
	const logout = vi.fn();

	beforeEach(() => {
		logout.mockClear();
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				provideHttpClient(withInterceptors([authInterceptor])),
				provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { token: () => 'tok', logout, currentUser: () => null, setPendingVerification: vi.fn() } },
			],
		});
		http = TestBed.inject(HttpClient);
		ctl = TestBed.inject(HttpTestingController);
	});

	const fail401 = (url: string) => {
		let status = 0;
		http.post(url, {}).subscribe({ error: e => (status = e.status) });
		ctl.expectOne(url).flush({ message: 'x' }, { status: 401, statusText: 'Unauthorized' });
		return status;
	};

	it.each(AUTH_ATTEMPT_URLS)('a 401 from %s is part of the flow: the error reaches the page and the user is NOT logged out', (path) => {
		expect(fail401(`/api${path}`)).toBe(401);
		expect(logout).not.toHaveBeenCalled();
	});

	it('the login OTP endpoints are covered too (they live under /auth/login/)', () => {
		expect(fail401('/api/auth/login/verify-otp')).toBe(401);
		expect(fail401('/api/auth/login/resend-otp')).toBe(401);
		expect(logout).not.toHaveBeenCalled();
	});

	it('an auth-attempt 401 leaves the stored session untouched; any other 401 clears it', () => {
		const removed: string[] = [];
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: (k: string) => removed.push(k) });
		try {
			fail401('/api/auth/verify-otp');
			expect(removed).toEqual([]);
			fail401('/api/client/requests');
			expect(removed).toEqual(expect.arrayContaining(['waseet_token', 'waseet_user']));
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('a 401 anywhere else is an expired session: the user is logged out and redirected to login', () => {
		expect(fail401('/api/client/requests')).toBe(401);
		expect(logout).toHaveBeenCalledWith('/auth/login');
	});
});
