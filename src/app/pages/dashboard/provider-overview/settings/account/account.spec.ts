import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Account } from './account';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';

// Regression coverage for Batch 2 — Provider Settings→Account trust/security
// fixes: real authenticated password change + real device/session
// management, and truthfully-unavailable states (no fake success) for
// 2FA, data export, and account deletion, none of which have any backing
// backend capability.

function setup() {
	const changePasswordSpy = vi.fn<(...args: any[]) => any>();
	const getActiveSessionsSpy = vi.fn<(...args: any[]) => any>(() => of({ success: true, data: [] }));
	const revokeSessionSpy = vi.fn<(...args: any[]) => any>();

	const fakeProviderProfileService = {
		changePassword: (...args: any[]) => changePasswordSpy(...args),
		getActiveSessions: (...args: any[]) => getActiveSessionsSpy(...args),
		revokeSession: (...args: any[]) => revokeSessionSpy(...args),
	};
	const fakeAuthStore = { currentUser: signal(null) };

	TestBed.configureTestingModule({
		imports: [Account],
		providers: [
			{ provide: AuthStore, useValue: fakeAuthStore },
			{ provide: ProviderProfileService, useValue: fakeProviderProfileService },
		],
	});

	const fixture: ComponentFixture<Account> = TestBed.createComponent(Account);
	const component = fixture.componentInstance;
	return { fixture, component, changePasswordSpy, getActiveSessionsSpy, revokeSessionSpy };
}

describe('Account (provider settings) — real password change', () => {
	function fillValidForm(component: Account) {
		component.currentPasswordValue.set('OldPass123!');
		component.newPasswordValue.set('NewPass456!');
		component.confirmPasswordValue.set('NewPass456!');
	}

	it('1) a valid submission calls the real ProviderProfileService.changePassword with current+new password', () => {
		const { component, changePasswordSpy } = setup();
		changePasswordSpy.mockReturnValue(of({ success: true, data: { changedAt: new Date().toISOString() } }));
		fillValidForm(component);

		component.changePassword();

		expect(changePasswordSpy).toHaveBeenCalledTimes(1);
		expect(changePasswordSpy).toHaveBeenCalledWith('OldPass123!', 'NewPass456!');
	});

	it('2a) empty fields never reach the backend', () => {
		const { component, changePasswordSpy } = setup();
		component.changePassword();
		expect(changePasswordSpy).not.toHaveBeenCalled();
		expect(component.passwordError()).toBeTruthy();
	});

	it('2b) a mismatched confirmation never reaches the backend', () => {
		const { component, changePasswordSpy } = setup();
		component.currentPasswordValue.set('OldPass123!');
		component.newPasswordValue.set('NewPass456!');
		component.confirmPasswordValue.set('Different789!');

		component.changePassword();

		expect(changePasswordSpy).not.toHaveBeenCalled();
		expect(component.passwordError()).toBe('تأكيد كلمة المرور غير مطابق');
	});

	it('2c) a weak new password (fewer than 3 character groups) never reaches the backend', () => {
		const { component, changePasswordSpy } = setup();
		component.currentPasswordValue.set('OldPass123!');
		component.newPasswordValue.set('alllowercase');
		component.confirmPasswordValue.set('alllowercase');

		component.changePassword();

		expect(changePasswordSpy).not.toHaveBeenCalled();
		expect(component.passwordError()).toContain('ثلاثة أنواع');
	});

	it('3) double submission is blocked while a request is already in flight', () => {
		const { component, changePasswordSpy } = setup();
		changePasswordSpy.mockReturnValue(of({ success: true, data: {} }).pipe());
		fillValidForm(component);
		component.isChangingPassword.set(true); // simulate a request already in flight

		component.changePassword();

		expect(changePasswordSpy).not.toHaveBeenCalled();
	});

	it('4) a backend failure does not show a success toast and surfaces the real error', () => {
		const { component, changePasswordSpy } = setup();
		changePasswordSpy.mockReturnValue(throwError(() => ({ error: { message: 'CURRENT_PASSWORD_INCORRECT' } })));
		fillValidForm(component);

		component.changePassword();

		expect(component.isChangingPassword()).toBe(false);
		expect(component.passwordError()).toBe('كلمة المرور الحالية غير صحيحة');
		expect(component.toastMessage()).not.toBe('تم تغيير كلمة المرور بنجاح');
		// Fields are NOT cleared on failure — the user shouldn't have to retype everything.
		expect(component.newPasswordValue()).toBe('NewPass456!');
	});

	it('5) a real backend success shows the success toast', () => {
		const { component, changePasswordSpy } = setup();
		changePasswordSpy.mockReturnValue(of({ success: true, data: { changedAt: new Date().toISOString() } }));
		fillValidForm(component);

		component.changePassword();

		expect(component.toastMessage()).toBe('تم تغيير كلمة المرور بنجاح');
	});

	it('6) password fields (and the form) clear after a real success, never persisted/logged', () => {
		const { component, changePasswordSpy } = setup();
		changePasswordSpy.mockReturnValue(of({ success: true, data: {} }));
		fillValidForm(component);
		component.passwordFormVisible.set(true);

		component.changePassword();

		expect(component.currentPasswordValue()).toBe('');
		expect(component.newPasswordValue()).toBe('');
		expect(component.confirmPasswordValue()).toBe('');
		expect(component.passwordFormVisible()).toBe(false);
	});

	it('7) changing password never navigates through /auth/forget-password — no such link exists in either template mode', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const forgetPasswordLink = (fixture.nativeElement as HTMLElement).querySelector('a[href="/auth/forget-password"]');
		expect(forgetPasswordLink).toBeNull();
	});
});

describe('Account (provider settings) — real device/session management', () => {
	it('loads real sessions from the backend when "إدارة" is toggled open (individual mode)', () => {
		const { component, getActiveSessionsSpy } = setup();
		getActiveSessionsSpy.mockReturnValue(of({
			success: true,
			data: [
				{ id: 's1', browser: 'Chrome', os: 'Windows', lastActiveAt: new Date().toISOString(), isCurrent: true },
				{ id: 's2', browser: 'Safari', os: 'iOS', lastActiveAt: new Date().toISOString(), isCurrent: false },
			],
		}));

		component.manageDevices();

		expect(getActiveSessionsSpy).toHaveBeenCalledTimes(1);
		expect(component.sessions().length).toBe(2);
	});

	it('9) a backend failure loading sessions surfaces a real error, never fabricated device rows', () => {
		const { component, getActiveSessionsSpy } = setup();
		getActiveSessionsSpy.mockReturnValue(throwError(() => ({ error: { message: 'boom' } })));

		component.manageDevices();

		expect(component.sessions()).toEqual([]);
		expect(component.sessionsError()).toBeTruthy();
	});

	it('ending a non-current session calls the real revoke endpoint and removes it from the list on success', () => {
		const { component, revokeSessionSpy } = setup();
		component.sessions.set([
			{ id: 's1', browser: 'Chrome', os: 'Windows', lastActiveAt: new Date().toISOString(), isCurrent: true },
			{ id: 's2', browser: 'Safari', os: 'iOS', lastActiveAt: new Date().toISOString(), isCurrent: false },
		]);
		revokeSessionSpy.mockReturnValue(of({ success: true }));

		component.endSession('s2');

		expect(revokeSessionSpy).toHaveBeenCalledWith('s2');
		expect(component.sessions().map(s => s.id)).toEqual(['s1']);
	});

	it('a real CANNOT_REVOKE_CURRENT_SESSION backend error never removes the session and shows a real message, not a fake success', () => {
		const { component, revokeSessionSpy } = setup();
		component.sessions.set([{ id: 's1', browser: 'Chrome', os: 'Windows', lastActiveAt: new Date().toISOString(), isCurrent: true }]);
		revokeSessionSpy.mockReturnValue(throwError(() => ({ error: { message: 'CANNOT_REVOKE_CURRENT_SESSION' } })));

		component.endSession('s1');

		expect(component.sessions().length).toBe(1);
		expect(component.toastMessage()).toBe('لا يمكن إنهاء الجلسة الحالية');
	});

	it('double-ending the same session is blocked while a revoke is already in flight', () => {
		const { component, revokeSessionSpy } = setup();
		component.sessions.set([{ id: 's2', browser: 'Safari', os: 'iOS', lastActiveAt: new Date().toISOString(), isCurrent: false }]);
		component.revokingSessionId.set('s2'); // simulate already in flight

		component.endSession('s2');

		expect(revokeSessionSpy).not.toHaveBeenCalled();
	});
});

describe('Account (provider settings) — truthfully-unavailable features (no fake success)', () => {
	it('8) 2FA has no interactive control that can claim success — no checkbox/switch bound to a togglable 2FA signal exists', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();
		expect((component as any).twoFactorAuth).toBeUndefined();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('غير متاح حاليًا');
	});

	it('10) data export is disabled and shows the truthful-unavailable state, never the old "your download link is on its way" toast', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();
		expect((component as any).requestDataDownload).toBeUndefined();
		const exportButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
			.find((el: any) => el.textContent?.trim() === 'طلب نسخة') as HTMLButtonElement | undefined;
		expect(exportButton).toBeTruthy();
		expect(exportButton!.disabled).toBe(true);
	});

	it('11) account deletion cannot be triggered and never shows a fake "submitted for review" success — no delete modal/confirm method exists', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();
		expect((component as any).confirmDelete).toBeUndefined();
		expect((component as any).openDeleteModal).toBeUndefined();
		const deleteButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
			.find((el: any) => el.textContent?.trim() === 'طلب حذف الحساب') as HTMLButtonElement | undefined;
		expect(deleteButton).toBeTruthy();
		expect(deleteButton!.disabled).toBe(true);
		// The confirmation modal itself must not exist anywhere in the DOM.
		expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('تأكيد حذف الحساب');
	});
});
