import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { Account } from './account';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';

// The client account page: language / timezone are really saved on the client profile (PUT /profiles/update) and read back (GET /profiles/me);
// devices are the real sessions; data copy / deletion open the support-ticket flow; everything that cannot work says so.
function setup(opts: { me?: any; meError?: boolean; update?: any; sessions?: any[]; revoke?: any } = {}) {
	const getMyProfile = vi.fn(() => opts.meError ? throwError(() => new HttpErrorResponse({ status: 500 })) : of({ success: true, data: { currentProfileData: opts.me ?? {} } }));
	const updateProfile = vi.fn((_p: any) => opts.update ?? of({ success: true, data: {} }));
	const getActiveSessions = vi.fn(() => of({ success: true, data: opts.sessions ?? [] }));
	const revokeSession = vi.fn((_id: string) => opts.revoke ?? of({ success: true }));
	TestBed.configureTestingModule({
		imports: [Account],
		providers: [provideRouter([]), { provide: ProfileApiService, useValue: { getMyProfile, updateProfile } }, { provide: ProviderProfileService, useValue: { getActiveSessions, revokeSession } }],
	});
	const fixture = TestBed.createComponent(Account);
	fixture.detectChanges();
	return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, getMyProfile, updateProfile, getActiveSessions, revokeSession };
}

describe('client account page', () => {
	it('loads the saved language and timezone (a reload shows what was saved); never saved = the profile defaults', () => {
		let s = setup({ me: { interfaceLanguage: 'English', timezone: '(GMT+4) توقيت دبي' } });
		expect(s.c.language()).toBe('English');
		expect(s.c.timezone()).toBe('(GMT+4) توقيت دبي');
		expect(s.c.isDirty()).toBe(false);
		TestBed.resetTestingModule();
		s = setup({ me: { interfaceLanguage: null, timezone: null } });
		expect(s.c.language()).toBe('العربية');
		expect(s.c.timezone()).toBe('(GMT+3) توقيت الرياض');
	});

	it('save sends exactly the two preferences, then the page is clean; nothing is sent when nothing changed', () => {
		const s = setup({ me: { interfaceLanguage: 'العربية', timezone: '(GMT+3) توقيت الرياض' } });
		s.c.savePreferences();
		expect(s.updateProfile).not.toHaveBeenCalled();
		s.c.language.set('English');
		s.c.timezone.set('(GMT+0) UTC');
		expect(s.c.isDirty()).toBe(true);
		s.c.savePreferences();
		expect(s.updateProfile).toHaveBeenCalledTimes(1);
		expect(s.updateProfile).toHaveBeenCalledWith({ interfaceLanguage: 'English', timezone: '(GMT+0) UTC' });
		expect(s.c.isDirty()).toBe(false);
		expect(s.c.saveError()).toBeNull();
	});

	it('a rejected save (400 / 401) shows the server message, stays dirty, and is never reported as saved', () => {
		const s = setup({ update: throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'لغة الواجهة غير مدعومة' } })) });
		s.c.language.set('English');
		s.c.savePreferences();
		expect(s.c.saveError()).toBeTruthy();
		expect(s.c.isDirty()).toBe(true);
		expect(TestBed.inject(UiNotificationService).toasts()).toEqual([]);
		TestBed.resetTestingModule();
		const u = setup({ update: throwError(() => new HttpErrorResponse({ status: 401 })) });
		u.c.timezone.set('(GMT+0) UTC');
		u.c.savePreferences();
		expect(u.c.saveError()).toBeTruthy();
		expect(u.c.isDirty()).toBe(true);
	});

	it('a profile that cannot be loaded shows the error state (with a working retry), not made-up values', () => {
		const s = setup({ meError: true });
		expect(s.c.hasError()).toBe(true);
		expect(s.el.textContent).toContain('تعذر تحميل إعدادات الحساب');
		s.c.load();
		expect(s.getMyProfile).toHaveBeenCalledTimes(2);
	});

	it('currency and date format are shown as facts (USD, Gregorian), not as selectors that save nothing', () => {
		const s = setup();
		expect(s.el.querySelector('[data-testid="currency-fixed"]')?.textContent).toContain('USD');
		expect(s.el.querySelector('[data-testid="date-format-fixed"]')?.textContent).toContain('ميلادي');
		expect(s.el.querySelectorAll('ws-select').length).toBe(2);
	});

	it('2FA, login alert and profile visibility show compact unavailable badges and stay disabled', () => {
		const s = setup();
		const disabled = Array.from(s.el.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
		expect(disabled.length).toBe(3);
		expect(disabled.every(i => i.disabled)).toBe(true);
		for (const input of disabled) {
			const row = input.closest('label')!.parentElement!;
			expect(row.querySelector('.availability-badge')?.textContent?.trim()).toBe('غير متاح');
		}
		expect(s.el.textContent).not.toContain('الميزة غير متوفرة في المنصة حاليًا، لذلك لا يمكن تفعيلها');
		expect(s.el.textContent).not.toContain('يمكنك تفعيل المصادقة الثنائية');
	});

	it('no fixed device count, no PDPL claim, no deletion promise', () => {
		const s = setup();
		const t = s.el.textContent || '';
		expect(t).not.toContain('3 أجهزة');
		expect(t).not.toContain('PDPL');
		expect(t).not.toContain('نهائي ولا يمكن التراجع');
	});

	it('devices: loaded from the server on demand, the current one cannot be ended, another one can', () => {
		const s = setup({ sessions: [{ id: 'a', browser: 'Chrome', os: 'macOS', lastActiveAt: new Date().toISOString(), isCurrent: true }, { id: 'b', browser: 'Safari', os: 'iOS', lastActiveAt: new Date().toISOString(), isCurrent: false }] });
		expect(s.getActiveSessions).not.toHaveBeenCalled();
		s.c.manageDevices();
		s.fixture.detectChanges();
		expect(s.getActiveSessions).toHaveBeenCalledTimes(1);
		expect(s.el.querySelector('[data-testid="devices-summary"]')?.textContent).toContain('2 جهاز نشط');
		const buttons = Array.from(s.el.querySelectorAll('button')).filter(b => b.textContent?.trim() === 'إنهاء');
		expect(buttons.length).toBe(1);
		s.c.endSession('b');
		expect(s.revokeSession).toHaveBeenCalledWith('b');
		expect(s.c.sessions().map(x => x.id)).toEqual(['a']);
	});

	it('a failed session end keeps the device in the list and says so', () => {
		const s = setup({ sessions: [{ id: 'b', lastActiveAt: new Date().toISOString(), isCurrent: false }], revoke: throwError(() => new HttpErrorResponse({ status: 500 })) });
		s.c.manageDevices();
		s.c.endSession('b');
		expect(s.c.sessions().length).toBe(1);
		expect(TestBed.inject(UiNotificationService).toasts().map(t => [t.kind, t.message])).toEqual([['error', 'تعذر إنهاء الجلسة']]);
	});

	it('data copy and account deletion open the real support-ticket form (no fake success)', () => {
		const s = setup();
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		s.c.openSupportTicket();
		s.c.contactSupportForDeletion();
		expect(navigate).toHaveBeenNthCalledWith(1, ['/client-overview/help/tickets/new']);
		expect(navigate).toHaveBeenNthCalledWith(2, ['/client-overview/help/tickets/new']);
		const labels = Array.from(s.el.querySelectorAll('button')).map(b => b.textContent?.trim());
		expect(labels).toContain('طلب نسخة عبر الدعم');
		expect(labels).toContain('طلب حذف الحساب عبر الدعم');
	});
});
