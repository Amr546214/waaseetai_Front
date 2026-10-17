import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { SaSystemSettings } from './sa-system-settings';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { NotificationHostComponent } from '../../../../shared/forms/notification-host.component';
import { environment } from '../../../../../environments/environment';

const SETTINGS = { platformName: 'وسيط', supportEmail: '', supportPhone: '', maintenanceBannerEnabled: false, maintenanceBannerText: '', termsVersion: '', privacyVersion: '', termsContent: '', privacyContent: '', adminNotificationEmail: '' };

// Saving the platform settings reports through the central UiNotificationService (rendered by <app-notification-host>), not a local toast.
describe('admin system settings: feedback flows through the central notification service', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('a saved change shows one success message in the central host and no local toast markup in the page', async () => {
		TestBed.configureTestingModule({
			imports: [SaSystemSettings, NotificationHostComponent],
			providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmModalService, useValue: { confirm: vi.fn(async () => true) } }],
		});
		const http = TestBed.inject(HttpTestingController);
		const page = TestBed.createComponent(SaSystemSettings);
		const host = TestBed.createComponent(NotificationHostComponent);
		page.detectChanges();
		http.expectOne(`${environment.url_api}/admin/settings`).flush({ success: true, data: SETTINGS });
		http.expectOne(`${environment.url_api}/admin/settings/history`).flush({ success: true, data: [] });
		page.detectChanges();

		const c = page.componentInstance;
		c.setField('platformName', 'اسم جديد');
		await c.save(['platformName']);
		http.expectOne((r) => r.method === 'PUT').flush({ success: true, message: 'ok', data: { ...SETTINGS, platformName: 'اسم جديد' } });
		http.expectOne(`${environment.url_api}/admin/settings/history`).flush({ success: true, data: [] });
		page.detectChanges(); host.detectChanges();

		expect(TestBed.inject(UiNotificationService).toasts().map(t => [t.kind, t.message])).toEqual([['success', 'تم حفظ الإعدادات']]);
		expect((host.nativeElement as HTMLElement).querySelector('[data-testid=ui-toast]')?.textContent).toContain('تم حفظ الإعدادات');
		expect((page.nativeElement as HTMLElement).textContent).not.toContain('تم حفظ الإعدادات');
		expect((page.nativeElement as HTMLElement).querySelector('.ss-toast')).toBeNull();
	});
});
