import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { AdminInvite } from './admin-invite';
import { environment } from '../../../../environments/environment';

const setup = () => {
	TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'tok-tok-tok-tok-tok-tok-1234' } } } }] });
	return { http: TestBed.inject(HttpTestingController), f: TestBed.createComponent(AdminInvite) };
};
describe('admin invitation page', () => {
	it('an invalid / used / expired link shows one clear message and no form', async () => {
		const { http, f } = setup(); f.detectChanges();
		http.expectOne(r => r.url === `${environment.url_api}/admin-invite/preview`).flush({ code: 'INVITE_INVALID' }, { status: 400, statusText: 'Bad' }); f.detectChanges();
		const el = f.nativeElement as HTMLElement; expect(el.querySelector('[data-testid="invite-invalid"]')).toBeTruthy(); expect(el.querySelector('[data-testid="invite-password"]')).toBeNull();
	});
	it('a valid link shows the masked e-mail and the role, sends ONLY token + password, and clears the password after success', async () => {
		const { http, f } = setup(); f.detectChanges();
		http.expectOne(r => r.url === `${environment.url_api}/admin-invite/preview`).flush({ success: true, data: { email: 'in***@pg.test', roleName: 'مشرف دعم', expiresAt: '' } }); f.detectChanges();
		const el = f.nativeElement as HTMLElement; expect(el.textContent).toContain('in***@pg.test'); expect(el.textContent).toContain('مشرف دعم');
		(f.componentInstance as any).password = 'Strong#Pass1'; (f.componentInstance as any).accept();
		const req = http.expectOne(`${environment.url_api}/admin-invite/accept`); expect(Object.keys(req.request.body).sort()).toEqual(['password', 'token']);
		req.flush({ success: true, data: { userId: 'u', email: 'x' } }); f.detectChanges();
		expect(el.querySelector('[data-testid="invite-done"]')).toBeTruthy(); expect((f.componentInstance as any).password).toBe('');
	});
});
