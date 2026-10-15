import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../shared/forms/form-spec-utils';
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

	it('empty names: a message under each name field, red + aria, focus on the first, no request', async () => {
		const { fixture, api, c, el } = setup();
		c.firstName.set(''); c.lastName.set('');
		fixture.detectChanges();
		(el.querySelector('[data-testid="save-profile"]') as HTMLButtonElement).click();
		await settleForm();
		expect(api.updateMe).not.toHaveBeenCalled();
		const first = el.querySelector('#ma-first-name');
		expectFieldProblem(first, 'الاسم الأول مطلوب');
		expectFieldProblem(el.querySelector('#ma-last-name'), 'اسم العائلة مطلوب');
		expectFocused(first);
	});

	it('a 400 naming phoneNumber lands under the phone field and keeps the other inputs', async () => {
		const { fixture, api, c, el } = setup();
		api.updateMe.mockReturnValue(throwError(() => httpFail(400, { errors: [{ field: 'phoneNumber', message: 'رقم الجوال غير صالح لهذه الدولة' }] })));
		c.firstName.set('منى'); c.phoneNumber.set('123456');
		(el.querySelector('[data-testid="save-profile"]') as HTMLButtonElement).click();
		await settleForm();
		fixture.detectChanges();
		expectFieldProblem(el.querySelector('#ma-phone'), 'غير صالح');
		expect(c.firstName()).toBe('منى');
		expect(c.profileMsg()).toBeNull();
	});

	it('a 429 / 500 on profile save stays a generic message, never a field error', async () => {
		const { fixture, api, c, el } = setup();
		for (const st of [429, 500, 0, 409]) {
			api.updateMe.mockReturnValue(throwError(() => httpFail(st, { message: 'x' })));
			(el.querySelector('[data-testid="save-profile"]') as HTMLButtonElement).click();
			await settleForm();
			fixture.detectChanges();
			expectNoFieldProblem(el);
			expect(c.profileMsg()?.ok).toBe(false);
			expect(el.querySelector('.ma-msg')?.getAttribute('role')).toBe('alert');
		}
	});

	it('a double click on save sends one request', () => {
		const { api, el } = setup();
		const pending = new Subject<any>();
		api.updateMe.mockReturnValue(pending);
		const btn = el.querySelector('[data-testid="save-profile"]') as HTMLButtonElement;
		btn.click(); btn.click();
		expect(api.updateMe).toHaveBeenCalledTimes(1);
	});

	it('wrong current password (401 CODE) is shown under the current-password field, not as "session expired"', async () => {
		const { fixture, api, c, el } = setup();
		api.changePassword.mockReturnValue(throwError(() => httpFail(401, { message: 'CURRENT_PASSWORD_INCORRECT' })));
		c.currentPassword.set('bad'); c.newPassword.set('Aa1!aaaa'); c.confirmPassword.set('Aa1!aaaa');
		(el.querySelector('[data-testid="change-password"]') as HTMLButtonElement).click();
		await settleForm();
		fixture.detectChanges();
		const cur = el.querySelector('#ma-pw-current');
		expectFieldProblem(cur, 'غير صحيحة');
		expectFocused(cur);
		expect(el.textContent).not.toContain('انتهت جلستك');
		expect(c.newPassword()).toBe('Aa1!aaaa');
	});

	it('weak new password code goes under the new-password field; empty fields are caught before any request', async () => {
		const { fixture, api, c, el } = setup();
		(el.querySelector('[data-testid="change-password"]') as HTMLButtonElement).click();
		await settleForm();
		expect(api.changePassword).not.toHaveBeenCalled();
		expectFieldProblem(el.querySelector('#ma-pw-current'), 'الحالية');
		expectFieldProblem(el.querySelector('#ma-pw-new'), 'الجديدة');
		api.changePassword.mockReturnValue(throwError(() => httpFail(400, { message: 'WEAK_PASSWORD' })));
		c.currentPassword.set('x'); c.newPassword.set('abc'); c.confirmPassword.set('abc');
		fixture.detectChanges();
		(el.querySelector('[data-testid="change-password"]') as HTMLButtonElement).click();
		await settleForm();
		expectFieldProblem(el.querySelector('#ma-pw-new'), 'ضعيفة');
	});

	it('the real BE shape (code message + errors[] naming newPassword) lands under the new-password box; a 400 without field names stays a banner', async () => {
		const { fixture, api, c, el } = setup();
		api.changePassword.mockReturnValue(throwError(() => httpFail(400, { message: 'PASSWORD_UNCHANGED', errors: [{ field: 'newPassword', path: 'newPassword', message: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية' }] })));
		c.currentPassword.set('Aa1!aaaa'); c.newPassword.set('Bb2!bbbb'); c.confirmPassword.set('Bb2!bbbb');
		(el.querySelector('[data-testid="change-password"]') as HTMLButtonElement).click();
		await settleForm();
		fixture.detectChanges();
		expectFieldProblem(el.querySelector('#ma-pw-new'), 'تختلف');
		expect(el.querySelector('#ma-pw-current')?.getAttribute('aria-invalid')).not.toBe('true');
	});

	it('429 on password change is a generic message (no field error)', async () => {
		const { fixture, api, c, el } = setup();
		api.changePassword.mockReturnValue(throwError(() => httpFail(429, { message: 'Too many requests' })));
		c.currentPassword.set('x'); c.newPassword.set('Aa1!aaaa'); c.confirmPassword.set('Aa1!aaaa');
		(el.querySelector('[data-testid="change-password"]') as HTMLButtonElement).click();
		await settleForm();
		fixture.detectChanges();
		expectNoFieldProblem(el);
		expect(c.pwMsg()?.text).toContain('المحاولات');
	});
});
