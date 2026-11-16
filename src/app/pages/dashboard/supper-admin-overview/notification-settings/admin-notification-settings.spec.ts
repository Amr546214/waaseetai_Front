import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminNotificationSettings } from './admin-notification-settings';
import { NotificationPreferencesService } from '../../../../core/services/notification-preferences.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { ADMIN_ROUTE_ACCESS } from '../../../../core/config/admin-access-rules';

describe('admin notification settings', () => {
	const setup = (settings: Record<string, boolean> = {}) => {
		const svc = { getPreferences: vi.fn(() => of({ success: true, data: { settings } })), updatePreferences: vi.fn(() => of({ success: true })) };
		TestBed.configureTestingModule({ imports: [AdminNotificationSettings], providers: [{ provide: NotificationPreferencesService, useValue: svc }, { provide: UiNotificationService, useValue: { success: vi.fn(), error: vi.fn() } }] });
		const f = TestBed.createComponent(AdminNotificationSettings); f.detectChanges();
		return { f, svc };
	};

	it('loads the saved channels over the defaults and saves them through the shared preferences endpoint', () => {
		const { f, svc } = setup({ channel_email: true });
		expect(f.componentInstance.preferences).toEqual({ channel_in_app: true, channel_email: true });
		f.componentInstance.preferences.channel_in_app = false;
		f.componentInstance.savePreferences();
		expect(svc.updatePreferences).toHaveBeenCalledWith({ channel_in_app: false, channel_email: true });
	});

	it('renders both channel switches', () => {
		const { f } = setup();
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelectorAll('input[role="switch"]').length).toBe(2);
	});

	it('the page is open to any admin account (own page)', () => {
		expect(ADMIN_ROUTE_ACCESS['notification-settings']).toEqual({ self: true });
	});
});
