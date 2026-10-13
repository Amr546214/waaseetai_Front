import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationsSettings } from './notifications-settings';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';

// Only the two general channels (instant in-app, e-mail) control sending. The per-type switches (offers / request status / messages / wallet) and the ones with no sender
// are shown disabled WITH the reason instead of pretending to work.
describe('client notification settings — honest switches', () => {
	function render() {
		TestBed.configureTestingModule({
			imports: [NotificationsSettings],
			providers: [{ provide: NotificationPreferencesService, useValue: { getPreferences: () => of({ success: true, data: { settings: {} } }), updatePreferences: () => of({ success: true }) } }]
		});
		const fixture = TestBed.createComponent(NotificationsSettings);
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}

	it('only the general channels are live switches', () => {
		const rows = Array.from(render().querySelectorAll('.pref-row'));
		const live = rows.filter(r => !r.querySelector('input')!.disabled);
		const titles = live.map(r => r.querySelector('.pref-ttl')!.textContent!.trim());
		expect(titles).toEqual(['الإشعارات اللحظية داخل وسيط AI', 'البريد الإلكتروني']);
	});

	it('switches with no sender behind them are disabled and say why', () => {
		const rows = Array.from(render().querySelectorAll('.pref-row'));
		const off = rows.filter(r => r.querySelector('input')!.disabled);
		expect(off.length).toBe(11); // 4 per-type switches + 6 with no sender + push
		for (const r of off) expect(r.querySelector('.pref-sub')!.textContent).toMatch(/غير (متاح|قابل للتحكم)(ة)? حاليًا/);
	});
});
