import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { maintenanceInterceptor } from '../../core/interceptors/maintenance.interceptor';
import { PlatformInfoService } from '../../core/services/platform-info.service';
import { AuthStore } from '../../core/store/auth.store';
import { PlatformBannerComponent } from './platform-banner.component';

describe('maintenance state (single switch) + the Super Admin notice', () => {
	let http: HttpTestingController; let admin = false;
	beforeEach(() => { admin = false; TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([maintenanceInterceptor])), provideHttpClientTesting(), { provide: AuthStore, useValue: { currentUser: () => (admin ? { accountType: 'SUPER_ADMIN' } : null) } }] }); http = TestBed.inject(HttpTestingController); });

	it('the public settings carry ONE switch: maintenanceMode on = the saved message; there is no separate banner switch any more', () => {
		const info = TestBed.inject(PlatformInfoService); info.load();
		http.expectOne(`${environment.url_api}/public/settings`).flush({ success: true, data: { maintenanceMode: true, maintenanceBannerText: 'صيانة مجدولة الليلة', maintenanceBannerEnabled: true } });
		expect(info.maintenance()).toBe('صيانة مجدولة الليلة'); expect('banner' in info).toBe(false);
		info.applyMaintenance(true, '   '); expect(info.maintenance()).toContain('صيانة مؤقتة');
		info.applyMaintenance(false, 'x'); expect(info.maintenance()).toBeNull();
	});
	it('a banner text without maintenanceMode shows nothing; a failed read never disturbs the page', () => {
		const info = TestBed.inject(PlatformInfoService); info.load(); http.expectOne(`${environment.url_api}/public/settings`).flush({ success: true, data: { maintenanceMode: false, maintenanceBannerText: 'x' } });
		expect(info.maintenance()).toBeNull(); info.load(); http.expectOne(`${environment.url_api}/public/settings`).flush('x', { status: 500, statusText: 'x' }); expect(info.maintenance()).toBeNull();
	});
	it('the in-app notice is for a Super Admin only; everybody else gets the Under Deployment page from the root instead', () => {
		const info = TestBed.inject(PlatformInfoService); info.applyMaintenance(true, 'نعود قريبًا');
		let f = TestBed.createComponent(PlatformBannerComponent); f.detectChanges(); http.match(`${environment.url_api}/public/settings`);
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="maintenance-notice"]')).toBeNull();
		admin = true; f = TestBed.createComponent(PlatformBannerComponent); f.detectChanges(); http.match(`${environment.url_api}/public/settings`);
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="maintenance-notice"]')?.textContent).toContain('نعود قريبًا');
	});
	it('a 503 MAINTENANCE from any call turns the state on and the call still fails for its caller; other 503s do not', () => {
		const info = TestBed.inject(PlatformInfoService); const client = TestBed.inject(HttpClient); let failed = 0;
		client.get(`${environment.url_api}/projects`).subscribe({ error: () => failed++ }); http.expectOne(`${environment.url_api}/projects`).flush({ success: false, code: 'OTHER', message: 'down' }, { status: 503, statusText: 'x' });
		expect(info.maintenance()).toBeNull();
		client.get(`${environment.url_api}/projects`).subscribe({ error: () => failed++ }); http.expectOne(`${environment.url_api}/projects`).flush({ success: false, code: 'MAINTENANCE', message: 'صيانة قصيرة' }, { status: 503, statusText: 'x' });
		expect(info.maintenance()).toBe('صيانة قصيرة'); expect(failed).toBe(2);
	});
});
