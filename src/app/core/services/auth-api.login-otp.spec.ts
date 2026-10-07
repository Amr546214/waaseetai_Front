import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { AuthApiService } from './auth-api.service';
import { AuthStore } from '../store/auth.store';
import { loginOtpNotice } from '../forms/otp-delivery';

// #4: the login code (e-mailed, LOGIN_EMAIL) and the activation code share one OTP screen; the service picks the endpoint.
describe('AuthApiService — mandatory login email OTP', () => {
	let api: AuthApiService; let ctl: HttpTestingController; let setPending: ReturnType<typeof vi.fn>; let authenticate: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		localStorage.removeItem('waseet_login_otp');
		setPending = vi.fn(); authenticate = vi.fn();
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthStore, useValue: { setPendingVerification: setPending, authenticate } }] });
		api = TestBed.inject(AuthApiService); ctl = TestBed.inject(HttpTestingController);
	});
	afterEach(() => localStorage.removeItem('waseet_login_otp'));

	it('login challenge → no session; the OTP screen then verifies / resends through the LOGIN endpoints', () => {
		api.login({ email: 'a@b.co', password: 'x' } as any).subscribe();
		ctl.expectOne(r => r.url.endsWith('/auth/login')).flush({ success: true, data: { verified: false, loginOtpRequired: true, userId: 'u1', emailSent: true } });
		expect(authenticate).not.toHaveBeenCalled();
		expect(setPending).toHaveBeenCalledWith('u1');

		api.resendOtp('u1').subscribe();
		ctl.expectOne(r => r.url.endsWith('/auth/login/resend-otp')).flush({ success: true });
		api.verifyOtp({ userId: 'u1', code: '123456' } as any).subscribe();
		ctl.expectOne(r => r.url.endsWith('/auth/login/verify-otp')).flush({ success: true, data: { token: 't', user: { id: 'u1' } } });
		expect(authenticate).toHaveBeenCalledWith('t', { id: 'u1' });

		// after the session exists the next OTP screen is an activation again
		api.verifyOtp({ userId: 'u2', code: '123456' } as any).subscribe();
		ctl.expectOne(r => r.url.endsWith('/auth/verify-otp')).flush({ success: true, data: {} });
	});

	it('an unverified login keeps using the activation endpoints', () => {
		api.login({ email: 'a@b.co', password: 'x' } as any).subscribe();
		ctl.expectOne(r => r.url.endsWith('/auth/login')).flush({ success: true, data: { verified: false, userId: 'u1', emailSent: true } });
		api.resendOtp('u1').subscribe();
		ctl.expectOne(r => r.url.endsWith('/auth/resend-otp')).flush({ success: true });
	});

	it('notice: "sent" is claimed only when the backend says the email went out', () => {
		expect(loginOtpNotice({ verified: false, emailSent: true } as any).sent).toBe(true);
		expect(loginOtpNotice({ verified: false, emailSent: false } as any).sent).toBe(false);
	});
});
