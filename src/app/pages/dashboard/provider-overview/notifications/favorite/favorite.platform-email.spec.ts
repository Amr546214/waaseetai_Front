import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Favorite } from './favorite';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';

describe('provider notification preferences - platform switch for optional e-mail', () => {
	function render(platform: { emailEnabled?: boolean } | undefined, settings: Record<string, boolean>) {
		const updatePreferences = vi.fn(() => of({ success: true }));
		TestBed.configureTestingModule({
			imports: [Favorite],
			providers: [{ provide: NotificationPreferencesService, useValue: { getPreferences: () => of({ success: true, data: { settings, platform } }), updatePreferences } }]
		});
		const fixture = TestBed.createComponent(Favorite);
		fixture.detectChanges();
		return { fixture, el: fixture.nativeElement as HTMLElement, updatePreferences };
	}
	it('platform OFF: e-mail row disabled with the exact message + code-mail note; the save does not send channel_email', async () => {
		const { fixture, el, updatePreferences } = render({ emailEnabled: false }, { channel_email: true });
		await fixture.whenStable(); fixture.detectChanges();
		expect(el.querySelector('[data-testid="email-platform-disabled"]')!.textContent).toContain('معطّل بواسطة إدارة المنصة');
		expect(el.querySelector('[data-testid="code-mail-note"]')).not.toBeNull();
		const input = el.querySelector<HTMLInputElement>('input[aria-label="البريد الإلكتروني"]')!;
		expect(input.disabled).toBe(true); expect(input.checked).toBe(true);
		fixture.componentInstance.savePreferences();
		const sent = (updatePreferences.mock.calls[0] as unknown[])[0] as Record<string, boolean>;
		expect('channel_email' in sent).toBe(false);
		expect('channel_inapp' in sent).toBe(true);
	});
	it('platform ON: the e-mail row is editable and is sent', async () => {
		const { fixture, el, updatePreferences } = render({ emailEnabled: true }, { channel_email: false });
		await fixture.whenStable(); fixture.detectChanges();
		expect(el.querySelector<HTMLInputElement>('input[aria-label="البريد الإلكتروني"]')!.disabled).toBe(false);
		expect(el.querySelector('[data-testid="email-platform-disabled"]')).toBeNull();
		fixture.componentInstance.savePreferences();
		expect(((updatePreferences.mock.calls[0] as unknown[])[0] as Record<string, boolean>)['channel_email']).toBe(false);
	});
});
