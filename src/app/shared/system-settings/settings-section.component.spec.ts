import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
import { SettingItem, SystemSettingsStore } from '../../core/services/system-settings.store';
import { SettingsSectionComponent } from './settings-section.component';

const B = `${environment.url_api}/admin/system-settings`;
const flush = async (f: any) => { f.detectChanges(); await f.whenStable(); f.detectChanges(); };
const item = (o: Partial<SettingItem> & { key: string }): SettingItem => ({ tab: 'general', label: o.key, description: 'وصف', status: 'enforced', unit: null, allowed: null, pages: ['P-AD-020'], canWrite: true, effect: 'within-5s', reason: null, value: '', version: 0, source: 'default', ...o });
const ITEMS: SettingItem[] = [
	item({ key: 'platformName', label: 'اسم النظام', value: '', effective: { value: 'وسيط AI', source: 'built-in default', uses: [{ where: 'اسم المرسل وعناوين وتذييل البريد', value: 'Waseet AI' }] } }),
	item({ key: 'supportEmail', value: 'help@x.co', version: 3, effective: { value: 'help@x.co', source: 'setting' } }),
	item({ key: 'supportPhone', value: '', effective: { value: null, source: 'not consumed', note: 'لا تعرض أي صفحة هذا الرقم' } }),
	item({ key: 'termsVersion', value: '', effective: { value: null, source: 'static page text' } }),
	item({ key: 'termsContent', value: '', effective: { value: null, source: 'static page text', note: 'صفحة الشروط تعرض نصها الثابت' } }),
	item({ key: 'maintenanceBannerEnabled', value: false, effective: { value: false, source: 'built-in default', note: 'لا يظهر أي بنر' } }),
];

describe('settings card: loading / failure / unset / set are four different things', () => {
	let http: HttpTestingController;
	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmModalService, useValue: { confirm: async () => true } }] });
		http = TestBed.inject(HttpTestingController);
	});
	const mount = async () => { const f = TestBed.createComponent(SettingsSectionComponent); f.componentRef.setInput('keys', ITEMS.map(i => i.key)); f.componentRef.setInput('saveKeys', ITEMS.map(i => i.key)); await flush(f); return { f, el: f.nativeElement as HTMLElement, store: TestBed.inject(SystemSettingsStore) }; };
	const row = (el: HTMLElement, k: string) => el.querySelector(`[data-testid="row-${k}"]`) as HTMLElement;

	it('loading: a message, no inputs, no save', async () => {
		const { el } = await mount();
		expect(el.querySelector('[data-testid="settings-section-loading"]')).toBeTruthy(); expect(el.querySelectorAll('input,textarea').length).toBe(0); expect(el.querySelector('[data-testid="settings-save"]')).toBeNull();
	});

	it('failed GET: a visible error with retry, NO inputs and NO save button; the retry loads the values', async () => {
		const { f, el, store } = await mount(); const p = store.load(); http.expectOne(B).flush({ success: false }, { status: 500, statusText: 'x' }); await p; await flush(f);
		expect(el.querySelector('[data-testid="settings-section-error"]')?.textContent).toContain('تعذّر تحميل الإعدادات'); expect(el.querySelectorAll('input,textarea,[role=switch]').length).toBe(0); expect(el.querySelector('[data-testid="settings-save"]')).toBeNull();
		(el.querySelector('[data-testid="settings-section-retry"]') as HTMLButtonElement).click(); http.expectOne(B).flush({ success: true, data: { storageReady: true, items: ITEMS } }); await flush(f); await flush(f);
		expect(el.querySelector('[data-testid="settings-section-error"]')).toBeNull(); expect(row(el, 'platformName')).toBeTruthy();
	});

	it('403: says there is no permission and offers no retry and no form', async () => {
		const { f, el, store } = await mount(); const p = store.load(); http.expectOne(B).flush({ success: false }, { status: 403, statusText: 'x' }); await p; await flush(f);
		expect(el.querySelector('[data-testid="settings-section-error"]')?.textContent).toContain('ليست لديك صلاحية'); expect(el.querySelector('[data-testid="settings-section-retry"]')).toBeNull(); expect(el.querySelectorAll('input,textarea').length).toBe(0);
	});

	it('a failed RE-load keeps the loaded values, shows the error with no form, cannot save, and a blank draft never reaches the server', async () => {
		const { f, el, store } = await mount(); let p = store.load(); http.expectOne(B).flush({ success: true, data: { storageReady: true, items: ITEMS } }); await p; await flush(f);
		const input = row(el, 'supportEmail').querySelector('input') as HTMLInputElement; input.value = ''; input.dispatchEvent(new Event('input')); await flush(f); // a blank draft over a real value
		p = store.load(); http.expectOne(B).flush({ success: false }, { status: 503, statusText: 'x' }); await p; await flush(f);
		expect(el.querySelector('[data-testid="settings-section-error"]')).toBeTruthy(); expect(el.querySelectorAll('input,textarea').length).toBe(0); expect(el.querySelector('[data-testid="settings-save"]')).toBeNull();
		expect(store.item('supportEmail')?.value).toBe('help@x.co'); expect(await store.save(['supportEmail'])).toBe(false); http.expectNone(r => r.method === 'PUT');
	});

	it('unset: shows «غير مضبوط — المستخدم حاليًا» with the value in use and its source, not just an empty input; set: shows the stored value and no such note', async () => {
		const { f, el, store } = await mount(); const p = store.load(); http.expectOne(B).flush({ success: true, data: { storageReady: true, items: ITEMS } }); await p; await flush(f);
		const name = row(el, 'platformName').querySelector('[data-testid="inuse-platformName"]')!; expect(name.textContent).toContain('غير مضبوط — المستخدم حاليًا'); expect(name.textContent).toContain('وسيط AI'); expect(name.textContent).toContain('قيمة مدمجة في النظام'); expect(name.textContent).toContain('اسم المرسل وعناوين وتذييل البريد: Waseet AI');
		expect((row(el, 'platformName').querySelector('input') as HTMLInputElement).value).toBe(''); // the input is still the stored (empty) value: nothing is faked into it
		expect(row(el, 'supportEmail').querySelector('[data-testid="inuse-supportEmail"]')).toBeNull(); expect((row(el, 'supportEmail').querySelector('input') as HTMLInputElement).value).toBe('help@x.co');
		expect(row(el, 'supportPhone').querySelector('[data-testid="inuse-supportPhone"]')?.textContent).toContain('لا يستعمله أي موضع حاليًا');
		expect(row(el, 'termsVersion').querySelector('[data-testid="inuse-termsVersion"]')?.textContent).toContain('2026-07-21');
		expect(row(el, 'termsContent').querySelector('[data-testid="inuse-termsContent"]')?.textContent).toContain('نص ثابت');
		expect(row(el, 'maintenanceBannerEnabled').querySelector('[data-testid="inuse-maintenanceBannerEnabled"]')?.textContent).toContain('غير مفعّل');
	});

	it('spa variant (P-AD-021): a blocked key is a non-interactive «غير متاح» field (never a switch), the deferred currency shows a fixed USD value, a read-only object is one row per entry', async () => {
		const BL = [
			item({ key: 'baseCurrency', status: 'blocked', canWrite: false, value: null, reason: 'تعدد العملات مؤجَّل' }),
			item({ key: 'profanityFilter', status: 'blocked', canWrite: false, value: null, reason: 'غير منفّذ' }),
			item({ key: 'apiKeys', status: 'readonly', canWrite: false, value: { paypal: true, smsProvider: false } }),
		];
		const f = TestBed.createComponent(SettingsSectionComponent); f.componentRef.setInput('keys', BL.map(i => i.key)); f.componentRef.setInput('variant', 'spa'); await flush(f);
		const store = TestBed.inject(SystemSettingsStore); const p = store.load(); http.expectOne(B).flush({ success: true, data: { storageReady: true, items: BL } }); await p; await flush(f);
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="row-profanityFilter"] [role=switch], [data-testid="row-profanityFilter"] .st-sw')).toBeNull();
		expect(el.querySelector('[data-testid="na-profanityFilter"]')?.textContent).toContain('غير متاح');
		expect(el.querySelector('[data-testid="na-baseCurrency"]')?.textContent).toContain('USD'); expect(el.querySelector('[data-testid="row-baseCurrency"] input')).toBeNull();
		expect(el.querySelector('[data-testid="entry-apiKeys-paypal"]')?.textContent).toContain('مهيّأ'); expect(el.querySelector('[data-testid="entry-apiKeys-smsProvider"]')?.textContent).toContain('غير مهيّأ');
	});
});
