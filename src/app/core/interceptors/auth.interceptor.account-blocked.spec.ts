import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from '../store/auth.store';
import { UiNotificationService } from '../services/ui-notification.service';
import { accountBlockedText, isAccountBlockedResponse } from '../services/account-state';

// #35 FE: a suspended / under-review account sees ONE sticky banner with the backend's own message when a request is refused.
describe('authInterceptor — account blocked 403', () => {
	let http: HttpClient; let ctl: HttpTestingController; let ui: UiNotificationService;
	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
			{ provide: AuthStore, useValue: { token: () => 'tok', logout: vi.fn(), currentUser: () => null, setPendingVerification: vi.fn() } }] });
		http = TestBed.inject(HttpClient); ctl = TestBed.inject(HttpTestingController); ui = TestBed.inject(UiNotificationService);
	});
	const fail = (status: number, message: string) => { let got = 0; http.get('/api/x').subscribe({ error: e => (got = e.status) }); ctl.expectOne('/api/x').flush({ message }, { status, statusText: 'e' }); return got; };

	it('suspended → banner with the backend message, the error still reaches the caller', () => {
		expect(fail(403, 'هذا الحساب معطل حالياً، يرجى التواصل مع الدعم')).toBe(403);
		expect(ui.banner()?.message).toBe('هذا الحساب معطل حالياً، يرجى التواصل مع الدعم');
		expect(ui.banner()?.kind).toBe('error');
	});
	it('under suspension review → banner too', () => {
		fail(403, 'هذا الحساب قيد مراجعة الإيقاف حالياً، يرجى التواصل مع الدعم');
		expect(ui.banner()?.message).toContain('مراجعة الإيقاف');
	});
	it('other 403s and other statuses show no banner', () => {
		fail(403, 'ليست لديك صلاحية'); fail(500, 'هذا الحساب معطل');
		expect(ui.banner()).toBeNull();
	});
	it('helpers: only a 403 with the account wording counts; a non-Arabic message gets the Arabic fallback', () => {
		expect(isAccountBlockedResponse(403, 'هذا الحساب معطل')).toBe(true);
		expect(isAccountBlockedResponse(401, 'هذا الحساب معطل')).toBe(false);
		expect(accountBlockedText('forbidden')).toMatch(/[؀-ۿ]/);
	});
});
