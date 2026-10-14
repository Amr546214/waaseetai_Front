import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { NotificationsSettings } from './notifications-settings';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';

function setup(opts: { settings?: Record<string, boolean>; getError?: boolean; update?: any } = {}) {
	const getPreferences = vi.fn(() => opts.getError ? throwError(() => new HttpErrorResponse({ status: 500 })) : of({ success: true, data: { settings: opts.settings ?? {} } }));
	const updatePreferences = vi.fn((_s: Record<string, boolean>) => opts.update ?? of({ success: true, data: { settings: {} } }));
	TestBed.configureTestingModule({ imports: [NotificationsSettings], providers: [{ provide: NotificationPreferencesService, useValue: { getPreferences, updatePreferences } }] });
	const fixture = TestBed.createComponent(NotificationsSettings);
	fixture.detectChanges();
	return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, getPreferences, updatePreferences };
}

describe('client notification preferences page', () => {
	it('loads what was saved (reload persists) and keeps the defaults for keys never saved (in-app on, e-mail off)', () => {
		const s = setup({ settings: { newOffer: false, channel_email: true } });
		expect(s.c.preferences.newOffer).toBe(false);
		expect(s.c.preferences.channel_email).toBe(true);
		expect(s.c.preferences.channel_in_app).toBe(true);
		expect(s.c.preferences.requestStatus).toBe(true);
		TestBed.resetTestingModule();
		const d = setup();
		expect(d.c.preferences.channel_email).toBe(false);
	});

	it('save sends the same channel keys the profile page uses (channel_in_app / channel_email) and no SMS / push key', () => {
		const s = setup();
		s.c.preferences.channel_email = true;
		s.c.savePreferences();
		const sent = s.updatePreferences.mock.calls[0][0];
		expect(sent['channel_email']).toBe(true);
		expect(sent['channel_in_app']).toBe(true);
		expect(Object.keys(sent).some(k => /sms|push|inApp|^email$/i.test(k))).toBe(false);
		expect(s.c.toastMessage()).toBe('تم حفظ تفضيلات الإشعارات بنجاح');
	});

	it('a failed save is reported as failed (never as saved)', () => {
		const s = setup({ update: throwError(() => new HttpErrorResponse({ status: 401 })) });
		s.c.savePreferences();
		expect(s.c.toastMessage()).toBe('تعذر حفظ التفضيلات، حاول مرة أخرى');
		expect(s.c.isSaving()).toBe(false);
	});

	it('a failed load shows the error state with a working retry', () => {
		const s = setup({ getError: true });
		expect(s.c.hasError()).toBe(true);
		s.c.retry();
		expect(s.getPreferences).toHaveBeenCalledTimes(2);
	});

	it('Push is shown unavailable with the reason; the note says what the preferences really do', () => {
		const s = setup();
		const push = s.el.querySelector('[data-testid="push-unavailable"]');
		expect(push?.textContent).toContain('غير متاحة حاليًا');
		const box = (push?.closest('.pref-row') as HTMLElement).querySelector('input') as HTMLInputElement;
		expect(box.disabled).toBe(true);
		expect(box.checked).toBe(false);
		const note = s.el.querySelector('[data-testid="prefs-note"]')?.textContent || '';
		expect(note).toContain('أنواع الإشعارات غير قابلة للتحكم');
		expect(s.el.textContent).not.toContain('تجميع تلقائي');
	});
});
