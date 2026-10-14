import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { SaMyAccount } from './sa-my-account';
import { AdminConsoleApiService } from '../../../../core/services/admin-console-api.service';

const me = { id: 'u1', firstName: 'سارة', lastName: 'علي', email: 'a@b.c', accountType: 'SUPER_ADMIN', phoneCountryCode: '+966', phoneNumber: null, avatarUrl: null };
const sessions = [
	{ id: 's1', browser: 'Chrome', os: 'macOS', lastActiveAt: new Date().toISOString(), createdAt: new Date().toISOString(), isCurrent: true },
	{ id: 's2', browser: 'Firefox', os: 'Windows', lastActiveAt: new Date().toISOString(), createdAt: new Date().toISOString(), isCurrent: false },
];

function setup() {
	const api = {
		getMe: vi.fn(() => of({ success: true, data: me })),
		updateMe: vi.fn((b: any) => of({ success: true, data: { ...me, ...b } })),
		getSessions: vi.fn(() => of({ success: true, data: sessions })),
		terminateSession: vi.fn(() => of({ success: true, data: { revoked: 1 } })),
		terminateOtherSessions: vi.fn(() => of({ success: true, data: { revoked: 1 } })),
		changePassword: vi.fn(() => of({ success: true, data: { changedAt: '' } })),
	};
	TestBed.configureTestingModule({ imports: [SaMyAccount], providers: [{ provide: AdminConsoleApiService, useValue: api }] });
	const fixture = TestBed.createComponent(SaMyAccount);
	fixture.detectChanges();
	return { fixture, api, c: fixture.componentInstance as any, el: fixture.nativeElement as HTMLElement };
}

describe('SaMyAccount', () => {
	it('saves the profile through the real endpoint', () => {
		const { fixture, api, c, el } = setup();
		c.firstName.set('منى');
		(el.querySelector('[data-testid="save-profile"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.updateMe).toHaveBeenCalledWith({ firstName: 'منى', lastName: 'علي', phoneNumber: null });
		expect(el.textContent).toContain('تم حفظ بيانات الحساب');
	});

	it('terminating a session needs a confirmation, then calls the endpoint', () => {
		const { fixture, api, el } = setup();
		(el.querySelector('[data-testid="terminate-session"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.terminateSession).not.toHaveBeenCalled();
		expect(el.querySelector('[data-testid="confirm-dialog"]')).toBeTruthy();
		(el.querySelector('[data-testid="confirm-yes"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.terminateSession).toHaveBeenCalledWith('s2');
	});

	it('the current session has no terminate button; terminate-all-others asks first', () => {
		const { fixture, api, el } = setup();
		expect(el.querySelectorAll('[data-testid="terminate-session"]').length).toBe(1);
		(el.querySelector('[data-testid="terminate-others"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.terminateOtherSessions).not.toHaveBeenCalled();
		(el.querySelector('[data-testid="confirm-yes"]') as HTMLButtonElement).click();
		expect(api.terminateOtherSessions).toHaveBeenCalled();
	});

	it('2FA control is disabled with a visible honest reason', () => {
		const { el } = setup();
		expect((el.querySelector('[data-testid="twofa-toggle"]') as HTMLButtonElement).disabled).toBe(true);
		expect(el.querySelector('[data-testid="twofa-card"]')?.textContent).toContain('لا يوجد دعم للمصادقة الثنائية');
	});

	it('password mismatch is rejected client-side without calling the API', () => {
		const { fixture, api, c, el } = setup();
		c.currentPassword.set('x'); c.newPassword.set('Aa1!aaaa'); c.confirmPassword.set('different');
		(el.querySelector('[data-testid="change-password"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.changePassword).not.toHaveBeenCalled();
		expect(el.textContent).toContain('تأكيد كلمة المرور غير مطابق');
	});
});
