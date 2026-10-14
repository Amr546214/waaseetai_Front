import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { SaSystemSettings } from './sa-system-settings';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { environment } from '../../../../../environments/environment';

const SETTINGS = { platformName: 'وسيط', supportEmail: '', supportPhone: '', maintenanceBannerEnabled: false, maintenanceBannerText: '', termsVersion: '', privacyVersion: '', termsContent: '', privacyContent: '', adminNotificationEmail: '' };

describe('SaSystemSettings', () => {
	let confirmResult = true;
	function setup() {
		TestBed.configureTestingModule({
			imports: [SaSystemSettings],
			providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmModalService, useValue: { confirm: vi.fn(async () => confirmResult) } }],
		});
		const http = TestBed.inject(HttpTestingController);
		const f = TestBed.createComponent(SaSystemSettings);
		f.detectChanges();
		http.expectOne(`${environment.url_api}/admin/settings`).flush({ success: true, data: SETTINGS });
		http.expectOne(`${environment.url_api}/admin/settings/history`).flush({ success: true, data: [{ id: 'h1', at: '2026-10-14T10:00:00Z', summary: 'تعديل إعدادات المنصة: platformName', ip: '1.2.3.4', actor: 'مدير' }] });
		f.detectChanges();
		return { f, c: f.componentInstance, http, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => { TestBed.resetTestingModule(); confirmResult = true; });

	it('loads the saved settings, shows the real history, and the footer shows the build version', () => {
		const { el, c } = setup();
		expect((el.querySelector('input.ss-input') as HTMLInputElement).value).toBe('وسيط');
		expect(el.querySelector('.ss-changelog')?.textContent).toContain('تعديل إعدادات المنصة');
		expect(el.querySelector('.ss-foot')?.textContent).toContain(`v${environment.appVersion}`);
		expect(el.textContent).not.toMatch(/SAMA|PDPL|99\.8|197\.32/);
		expect(c.hasChanges(['platformName'])).toBe(false);
	});

	it('save asks for confirmation and sends only the changed keys; cancel sends nothing', async () => {
		const { c, http, f } = setup();
		c.setField('platformName', 'اسم جديد');
		confirmResult = false;
		await c.save(['platformName', 'supportEmail']);
		http.expectNone(`${environment.url_api}/admin/settings`);
		confirmResult = true;
		const p = c.save(['platformName', 'supportEmail']);
		await p;
		const req = http.expectOne((r) => r.method === 'PUT');
		expect(req.request.body).toEqual({ platformName: 'اسم جديد' });
		req.flush({ success: true, message: 'ok', data: { ...SETTINGS, platformName: 'اسم جديد' } });
		http.expectOne(`${environment.url_api}/admin/settings/history`).flush({ success: true, data: [] });
		f.detectChanges();
		expect(c.saved()?.platformName).toBe('اسم جديد');
		expect(c.savedToast()).toBe(true);
	});

	it('a failed save shows the server error and keeps the draft', async () => {
		const { c, http } = setup();
		c.setField('supportEmail', 'bad');
		await c.save(['supportEmail']);
		http.expectOne((r) => r.method === 'PUT').flush({ message: 'البريد غير صالح' }, { status: 400, statusText: 'Bad Request' });
		expect(c.error()).toBe('البريد غير صالح');
		expect(c.form().supportEmail).toBe('bad');
	});

	it('unwired controls are disabled with a visible reason', () => {
		const { c, f, el } = setup();
		c.activeSection.set('general'); f.detectChanges();
		expect(el.querySelector('.ss-note')?.textContent).toContain('غير مفعّل');
		const off = Array.from(el.querySelectorAll('button.ss-sw[disabled]'));
		expect(off.length).toBe(3);
	});
});
