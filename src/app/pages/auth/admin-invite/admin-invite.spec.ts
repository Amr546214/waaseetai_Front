import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { AdminInvite } from './admin-invite';
import { environment } from '../../../../environments/environment';

const B = `${environment.url_api}/admin-invite`;
const TOKEN = 'tok-tok-tok-tok-tok-tok-1234';
const setup = (hash: string | null = `#${TOKEN}`) => {
	history.replaceState(null, '', '/admin-invite' + (hash ?? ''));
	TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
	return { http: TestBed.inject(HttpTestingController), f: TestBed.createComponent(AdminInvite) };
};
const el = (f: any) => f.nativeElement as HTMLElement;

describe('admin invitation page (the link alone accepts nothing)', () => {
	beforeEach(() => history.replaceState(null, '', '/'));

	it('the token is read from the URL FRAGMENT, removed from the address bar at once, and sent only in request bodies', () => {
		const { http, f } = setup(); f.detectChanges();
		expect(location.hash).toBe(''); // scrubbed before anything else happens
		const req = http.expectOne(`${B}/preview`); expect(req.request.method).toBe('POST'); expect(req.request.url).not.toContain(TOKEN); expect(req.request.body).toEqual({ token: TOKEN });
		req.flush({ success: true, data: { email: 'in***@pg.test', roleName: 'مشرف دعم', expiresAt: '' } });
	});

	it('no token, or an invalid / used / expired one, shows one clear message and no form', () => {
		const a = setup(null); a.f.detectChanges(); a.http.expectNone(`${B}/preview`); expect(el(a.f).querySelector('[data-testid="invite-invalid"]')).toBeTruthy();
		TestBed.resetTestingModule();
		const { http, f } = setup(); f.detectChanges();
		http.expectOne(`${B}/preview`).flush({ code: 'INVITE_INVALID' }, { status: 400, statusText: 'Bad' }); f.detectChanges();
		expect(el(f).querySelector('[data-testid="invite-invalid"]')).toBeTruthy(); expect(el(f).querySelector('[data-testid="invite-password"]')).toBeNull(); expect(el(f).querySelector('[data-testid="invite-send-code"]')).toBeNull();
	});

	it('shows the masked e-mail and role, asks for an e-mailed code first, then accepts with token + code + password and clears them', () => {
		const { http, f } = setup(); f.detectChanges();
		http.expectOne(`${B}/preview`).flush({ success: true, data: { email: 'in***@pg.test', roleName: 'مشرف دعم', expiresAt: '' } }); f.detectChanges();
		expect(el(f).textContent).toContain('in***@pg.test'); expect(el(f).textContent).toContain('مشرف دعم');
		// before the code is requested there is no password field and no accept button
		expect(el(f).querySelector('[data-testid="invite-password"]')).toBeNull(); expect(el(f).querySelector('[data-testid="invite-accept"]')).toBeNull();
		(el(f).querySelector('[data-testid="invite-send-code"]') as HTMLButtonElement).click();
		const rc = http.expectOne(`${B}/request-code`); expect(rc.request.body).toEqual({ token: TOKEN }); rc.flush({ success: true, data: { sent: true, email: 'in***@pg.test', expiresInSeconds: 600 } }); f.detectChanges();
		expect(el(f).querySelector('[data-testid="invite-code-sent"]')).toBeTruthy();
		const c: any = f.componentInstance; c.code = '123456'; c.password = 'Strong#Pass1'; c.accept();
		const req = http.expectOne(`${B}/accept`); expect(Object.keys(req.request.body).sort()).toEqual(['code', 'password', 'token']);
		req.flush({ success: true, data: { userId: 'u', email: 'x' } }); f.detectChanges();
		expect(el(f).querySelector('[data-testid="invite-done"]')).toBeTruthy(); expect(c.password).toBe(''); expect(c.code).toBe(''); expect(c.token).toBe('');
	});

	it('a wrong or expired code is a clear, retryable message (the invitation stays valid); the rate-limit codes are explained', () => {
		const { http, f } = setup(); f.detectChanges();
		http.expectOne(`${B}/preview`).flush({ success: true, data: { email: 'in***@pg.test', roleName: 'r', expiresAt: '' } }); f.detectChanges();
		(el(f).querySelector('[data-testid="invite-send-code"]') as HTMLButtonElement).click();
		http.expectOne(`${B}/request-code`).flush({ success: true, data: { sent: true, email: 'x', expiresInSeconds: 600 } }); f.detectChanges();
		const c: any = f.componentInstance; c.code = '000000'; c.password = 'Strong#Pass1'; c.accept();
		http.expectOne(`${B}/accept`).flush({ code: 'INVITE_CODE_INVALID', message: 'x' }, { status: 400, statusText: 'Bad' }); f.detectChanges();
		expect(el(f).querySelector('[data-testid="invite-error"]')?.textContent).toContain('رمز التحقق غير صحيح'); expect(el(f).querySelector('[data-testid="invite-invalid"]')).toBeNull();
		c.requestCode(); http.expectOne(`${B}/request-code`).flush({ code: 'INVITE_CODE_TOO_SOON' }, { status: 429, statusText: 'Too Many' }); f.detectChanges();
		expect(el(f).querySelector('[data-testid="invite-error"]')?.textContent).toContain('انتظر دقيقة');
	});
});
