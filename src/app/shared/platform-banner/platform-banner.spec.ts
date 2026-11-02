import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { maintenanceInterceptor } from '../../core/interceptors/maintenance.interceptor';
import { PlatformInfoService } from '../../core/services/platform-info.service';
import { PlatformBannerComponent } from './platform-banner.component';

describe('platform banner + maintenance notice (server-driven)', () => {
	let http: HttpTestingController;
	beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([maintenanceInterceptor])), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); });

	it('shows the announcement only when the server says it is enabled and has text', async () => {
		const f = TestBed.createComponent(PlatformBannerComponent); f.detectChanges();
		http.expectOne(`${environment.url_api}/public/settings`).flush({ success: true, data: { maintenanceBannerEnabled: true, maintenanceBannerText: 'صيانة مجدولة الليلة' } }); f.detectChanges();
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="platform-banner"]')?.textContent).toContain('صيانة مجدولة الليلة');
	});
	it('shows nothing when disabled, and a failed read never disturbs the page', () => {
		const f = TestBed.createComponent(PlatformBannerComponent); f.detectChanges();
		http.expectOne(`${environment.url_api}/public/settings`).flush({ success: true, data: { maintenanceBannerEnabled: false, maintenanceBannerText: 'x' } }); f.detectChanges();
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="platform-banner"]')).toBeNull();
		const info = TestBed.inject(PlatformInfoService); info.load(); http.expectOne(`${environment.url_api}/public/settings`).flush('x', { status: 500, statusText: 'x' }); f.detectChanges();
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="platform-banner"]')).toBeNull();
	});
	it('a 503 MAINTENANCE from any call surfaces its message in the banner and the call still fails for its caller; other 503s do not', () => {
		const f = TestBed.createComponent(PlatformBannerComponent); f.detectChanges(); http.expectOne(`${environment.url_api}/public/settings`).flush({ success: true, data: {} });
		const client = TestBed.inject(HttpClient); let failed = 0;
		client.get(`${environment.url_api}/projects`).subscribe({ error: () => failed++ }); http.expectOne(`${environment.url_api}/projects`).flush({ success: false, code: 'OTHER', message: 'down' }, { status: 503, statusText: 'x' }); f.detectChanges();
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="maintenance-notice"]')).toBeNull();
		client.get(`${environment.url_api}/projects`).subscribe({ error: () => failed++ }); http.expectOne(`${environment.url_api}/projects`).flush({ success: false, code: 'MAINTENANCE', message: 'المنصة في صيانة قصيرة' }, { status: 503, statusText: 'x' }); f.detectChanges();
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="maintenance-notice"]')?.textContent).toContain('صيانة قصيرة'); expect(failed).toBe(2);
	});
});
