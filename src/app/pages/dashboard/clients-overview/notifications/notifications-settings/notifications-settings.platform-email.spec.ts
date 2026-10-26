import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NotificationsSettings } from './notifications-settings';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';

describe('client notification settings - platform switch for optional e-mail', () => {
	function render(platform: { emailEnabled?: boolean } | undefined, settings: Record<string, boolean> = {}, update = () => of({ success: true })) {
		const updatePreferences = vi.fn(update);
		TestBed.configureTestingModule({
			imports: [NotificationsSettings],
			providers: [{ provide: NotificationPreferencesService, useValue: { getPreferences: () => of({ success: true, data: { settings, platform } }), updatePreferences } }]
		});
		const fixture = TestBed.createComponent(NotificationsSettings);
		fixture.detectChanges();
		return { fixture, el: fixture.nativeElement as HTMLElement, updatePreferences };
	}
	const emailInput = (el: HTMLElement) => el.querySelector<HTMLInputElement>('input[aria-label="البريد الإلكتروني"]')!;

	it('platform OFF: the option is disabled, shows the stored choice and the exact message', async () => {
		const { fixture, el } = render({ emailEnabled: false }, { channel_email: true });
		await fixture.whenStable(); fixture.detectChanges();
		expect(emailInput(el).disabled).toBe(true);
		expect(emailInput(el).checked).toBe(true);
		expect(el.querySelector('[data-testid="email-platform-disabled"]')!.textContent).toContain('معطّل بواسطة إدارة المنصة');
		expect(el.querySelector('[data-testid="code-mail-note"]')!.textContent).toContain('رموز الدخول والتفعيل والاستعادة');
	});
	it('platform ON (or no field): the option is editable and no disabled message is shown', async () => {
		for (const platform of [{ emailEnabled: true }, undefined]) {
			TestBed.resetTestingModule();
			const { fixture, el } = render(platform);
			await fixture.whenStable(); fixture.detectChanges();
			expect(emailInput(el).disabled).toBe(false);
			expect(el.querySelector('[data-testid="email-platform-disabled"]')).toBeNull();
			expect(el.querySelector('[data-testid="code-mail-note"]')).not.toBeNull();
		}
	});
	it('a 409 from the server (switch turned off after the page loaded) disables the option', async () => {
		const { fixture, el } = render({ emailEnabled: true }, {}, () => throwError(() => ({ status: 409, error: { code: 'EMAIL_CHANNEL_DISABLED_BY_PLATFORM' } })) as never);
		await fixture.whenStable(); fixture.detectChanges();
		fixture.componentInstance.savePreferences(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
		expect(fixture.componentInstance.emailDisabled()).toBe(true);
		expect(el.querySelector('[data-testid="email-platform-disabled"]')).not.toBeNull();
	});
});
