import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
import { SettingItem, SystemSettingsStore } from '../../core/services/system-settings.store';
import { PRIVACY_DEFAULT_TEXT, TERMS_DEFAULT_TEXT } from '../../core/constants/legal-text';
import { SettingsSectionComponent } from './settings-section.component';

const B = `${environment.url_api}/admin/system-settings`;
const flush = async (f: any) => { f.detectChanges(); await f.whenStable(); f.detectChanges(); };
const item = (o: Partial<SettingItem> & { key: string }): SettingItem => ({ tab: 'general', label: o.key, description: 'وصف', status: 'enforced', unit: null, allowed: null, pages: ['P-AD-020'], canWrite: true, effect: 'within-5s', reason: null, value: '', version: 0, source: 'default', ...o });
const ITEMS: SettingItem[] = [
	item({ key: 'platformName', label: 'اسم النظام', description: 'يظهر في رسائل البريد الجديدة. وهذه جملة ثانية.', writeBy: 'settings.manage', value: '', effective: { value: 'وسيط AI', source: 'built-in default', uses: [{ where: 'اسم المرسل وعناوين وتذييل البريد', value: 'Waseet AI' }] } }),
	item({ key: 'supportEmail', value: 'help@x.co', version: 3, effective: { value: 'help@x.co', source: 'setting' } }),
	item({ key: 'supportPhone', value: '', effective: { value: '+966 55 256 0392', source: 'built-in default', note: 'يظهر في صفحة اتصل بنا' } }),
	item({ key: 'termsVersion', value: '', effective: { value: null, source: 'static page text' } }),
	item({ key: 'termsContent', value: '', effective: { value: null, source: 'static page text', note: 'صفحة الشروط تعرض نصها الثابت' } }),
	item({ key: 'privacyContent', value: '', effective: { value: null, source: 'static page text' } }),
	item({ key: 'maintenanceBannerEnabled', value: false, effective: { value: false, source: 'built-in default', note: 'لا يظهر أي بنر' } }),
	item({ key: 'registrationOpen', value: true, writeBy: 'SUPER', effective: { value: true, source: 'built-in default' } }),
	item({ key: 'sessionMaxHours', value: 168, allowed: [8, 24, 48, 168], unit: 'ساعة', writeBy: 'SUPER', effect: 'new-sessions', effective: { value: 168, source: 'built-in default' } }),
	item({ key: 'defaultLanguage', value: 'en', allowed: ['ar', 'en'], allowedLabels: { ar: 'العربية', en: 'English' }, version: 1, writeBy: 'SUPER', effective: { value: 'en', source: 'setting' } }),
	item({ key: 'sessionIdleMinutes', value: 10, unit: 'دقيقة', version: 2, writeBy: 'SUPER', effective: { value: 10, source: 'setting' } }),
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

	const load = async (ctx: Awaited<ReturnType<typeof mount>>) => { const p = ctx.store.load(); http.expectOne(B).flush({ success: true, data: { storageReady: true, items: ITEMS } }); await p; await flush(ctx.f); };
	const type = async (f: any, input: HTMLInputElement | HTMLTextAreaElement, v: string) => { input.value = v; input.dispatchEvent(new Event('input')); await flush(f); };
	const saveBtn = (el: HTMLElement) => el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement;
	const putBody = (c: { method: string }) => c.method === 'PUT';

	it('every field shows the value IN USE inside the field (unset text/phone/version/long text, bool, number select) - no empty field, no per-row «غير مضبوط» alert', async () => {
		const ctx = await mount(); await load(ctx); const { el } = ctx;
		const inp = (k: string) => row(el, k).querySelector('input') as HTMLInputElement;
		expect(inp('platformName').value).toBe('وسيط AI'); expect(inp('supportEmail').value).toBe('help@x.co'); expect(inp('supportPhone').value).toBe('+966 55 256 0392'); expect(inp('termsVersion').value).toBe('2026-07-21');
		expect((row(el, 'termsContent').querySelector('textarea') as HTMLTextAreaElement).value).toBe(TERMS_DEFAULT_TEXT); expect((row(el, 'privacyContent').querySelector('textarea') as HTMLTextAreaElement).value).toBe(PRIVACY_DEFAULT_TEXT);
		expect(row(el, 'registrationOpen').querySelector('[role=switch]')?.getAttribute('aria-checked')).toBe('true'); expect(row(el, 'maintenanceBannerEnabled').querySelector('[role=switch]')?.getAttribute('aria-checked')).toBe('false');
		expect(row(el, 'sessionMaxHours').textContent).toContain('168'); expect(row(el, 'defaultLanguage').textContent).toContain('English'); expect((inp('sessionIdleMinutes')).value).toBe('10');
		expect(el.textContent).not.toContain('غير مضبوط'); expect(el.querySelector('[data-testid^="inuse-"]')).toBeNull();
		expect(row(el, 'platformName').querySelector('[data-testid="desc-platformName"]')?.textContent?.trim()).toBe('يظهر في رسائل البريد الجديدة'); // ONE line: the first sentence
		expect(ctx.store.dirtyKeys(ITEMS.map(i => i.key))).toEqual([]); expect(saveBtn(el).disabled).toBe(true); // showing is not drafting
	});

	it('dirty-only save: editing ONE unrelated field PUTs exactly that key (with its version) - the other shown defaults are never pinned, and the saved dev choices (defaultLanguage=en, sessionIdleMinutes=10) are not in the body', async () => {
		const ctx = await mount(); await load(ctx); const { f, el } = ctx;
		await type(f, row(el, 'supportEmail').querySelector('input')!, 'new@x.co'); expect(ctx.store.dirtyKeys(ITEMS.map(i => i.key))).toEqual(['supportEmail']);
		saveBtn(el).click(); await f.whenStable();
		const req = http.expectOne(putBody); expect(req.request.url).toBe(B); expect(req.request.body).toEqual({ changes: { supportEmail: 'new@x.co' }, expected: { supportEmail: 3 } });
		expect(Object.keys(req.request.body.changes)).toEqual(['supportEmail']); req.flush({ success: true, data: { changed: ['supportEmail'], items: ITEMS } }); await flush(f);
	});
	it('editing an UNSET field sends only that field (version 0); the other unset defaults on the page stay out of the body', async () => {
		const ctx = await mount(); await load(ctx); const { f, el } = ctx;
		await type(f, row(el, 'platformName').querySelector('input')!, 'منصتي'); await type(f, row(el, 'supportPhone').querySelector('input')!, '+971 50 123 4567');
		saveBtn(el).click(); await f.whenStable();
		const req = http.expectOne(putBody); expect(req.request.body).toEqual({ changes: { platformName: 'منصتي', supportPhone: '+971 50 123 4567' }, expected: { platformName: 0, supportPhone: 0 } }); req.flush({ success: true, data: { changed: ['platformName', 'supportPhone'], items: ITEMS } }); await flush(f);
	});
	it('editing an unset field back to the value shown (text, switch) is UNCHANGED: nothing to save, no PUT', async () => {
		const ctx = await mount(); await load(ctx); const { f, el } = ctx;
		const name = row(el, 'platformName').querySelector('input')!;
		await type(f, name, 'x'); expect(saveBtn(el).disabled).toBe(false); await type(f, name, 'وسيط AI'); expect(ctx.store.dirtyKeys(ITEMS.map(i => i.key))).toEqual([]); expect(saveBtn(el).disabled).toBe(true);
		const sw = row(el, 'registrationOpen').querySelector('[role=switch]') as HTMLButtonElement; sw.click(); await flush(f); expect(ctx.store.dirtyKeys(ITEMS.map(i => i.key))).toEqual(['registrationOpen']); sw.click(); await flush(f);
		expect(ctx.store.dirtyKeys(ITEMS.map(i => i.key))).toEqual([]); expect(await ctx.store.save(ITEMS.map(i => i.key))).toBe(false); http.expectNone(putBody);
	});
	it('the long legal text: shown in full in the editor; changing it sends the new text only, as plain text', async () => {
		const ctx = await mount(); await load(ctx); const { f, el } = ctx; const ta = row(el, 'termsContent').querySelector('textarea')!;
		await type(f, ta, '## قسم\nنص <b>x</b>'); saveBtn(el).click(); await f.whenStable();
		const req = http.expectOne(putBody); expect(req.request.body).toEqual({ changes: { termsContent: '## قسم\nنص <b>x</b>' }, expected: { termsContent: 0 } }); req.flush({ success: true, data: { changed: ['termsContent'], items: ITEMS } }); await flush(f);
	});

	it('help (ⓘ): closed by default; opens a disclosure with the full description, when it applies, the current source (unset: value in use + where from), who may change it; toggles and closes with Escape', async () => {
		const ctx = await mount(); await load(ctx); const { f, el } = ctx; const id = 'platformName';
		const btn = () => row(el, id).querySelector(`[data-testid="help-btn-${id}"]`) as HTMLButtonElement; const pop = () => row(el, id).querySelector(`[data-testid="help-${id}"]`) as HTMLElement | null;
		expect(pop()).toBeNull(); expect(btn().getAttribute('aria-expanded')).toBe('false'); expect(btn().getAttribute('aria-label')).toContain('اسم النظام');
		btn().click(); await flush(f); expect(btn().getAttribute('aria-expanded')).toBe('true'); expect(btn().getAttribute('aria-controls')).toBe(pop()!.id);
		const t = pop()!.textContent!; expect(t).toContain('يظهر في رسائل البريد الجديدة. وهذه جملة ثانية.'); expect(t).toContain('يسري خلال ثوانٍ من الحفظ'); expect(t).toContain('غير محفوظ في الإعدادات'); expect(t).toContain('وسيط AI'); expect(t).toContain('قيمة مدمجة في النظام'); expect(t).toContain('اسم المرسل وعناوين وتذييل البريد: Waseet AI'); expect(t).toContain('من يملك التغيير'); expect(t).toContain('إدارة الإعدادات');
		pop()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await flush(f); expect(pop()).toBeNull();
		btn().click(); await flush(f); btn().click(); await flush(f); expect(pop()).toBeNull();
		const b2 = row(el, 'supportEmail').querySelector('[data-testid="help-btn-supportEmail"]') as HTMLButtonElement; b2.click(); await flush(f); expect(row(el, 'supportEmail').querySelector('[data-testid="help-supportEmail"]')?.textContent).toContain('قيمة محفوظة في الإعدادات');
		const b3 = row(el, 'sessionMaxHours').querySelector('[data-testid="help-btn-sessionMaxHours"]') as HTMLButtonElement; b3.click(); await flush(f); expect(row(el, 'sessionMaxHours').querySelector('[data-testid="who-sessionMaxHours"]')?.textContent).toContain('Super Admin فقط');
	});

	it('spa variant (P-AD-021): a blocked key is a non-interactive «غير متاح» field (never a switch), the deferred currency shows a fixed USD value, a read-only object is one row per entry', async () => {
		const BL = [
			item({ key: 'baseCurrency', status: 'blocked', canWrite: false, value: null, reason: 'تعدد العملات مؤجَّل', effective: { value: 'USD', label: 'USD — دولار أمريكي', source: 'built-in default' } }),
			item({ key: 'profanityFilter', status: 'blocked', canWrite: false, value: null, reason: 'غير منفّذ' }),
			item({ key: 'apiKeys', status: 'readonly', canWrite: false, value: { paypal: true, smsProvider: false } }),
		];
		const f = TestBed.createComponent(SettingsSectionComponent); f.componentRef.setInput('keys', BL.map(i => i.key)); f.componentRef.setInput('variant', 'spa'); await flush(f);
		const store = TestBed.inject(SystemSettingsStore); const p = store.load(); http.expectOne(B).flush({ success: true, data: { storageReady: true, items: BL } }); await p; await flush(f);
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="row-profanityFilter"] [role=switch], [data-testid="row-profanityFilter"] .st-sw')).toBeNull();
		expect(el.querySelector('[data-testid="na-profanityFilter"]')?.textContent).toContain('غير متاح');
		expect(el.querySelector('[data-testid="na-baseCurrency"]')?.textContent).toContain('USD — دولار أمريكي'); // the label the SERVER reports; with no effective from the server nothing is invented (next test) expect(el.querySelector('[data-testid="row-baseCurrency"] input')).toBeNull();
		expect(el.querySelector('[data-testid="entry-apiKeys-paypal"]')?.textContent).toContain('مهيّأ'); expect(el.querySelector('[data-testid="entry-apiKeys-smsProvider"]')?.textContent).toContain('غير مهيّأ');
	});

	it('the currency comes from the server only: without a server value the blocked row shows «غير متاح» and no currency (no constant in the frontend); with it, both variants show the server label', async () => {
		const mk = async (variant: 'ss' | 'spa', eff: SettingItem['effective']) => {
			const BL = [item({ key: 'baseCurrency', status: 'blocked', canWrite: false, value: null, reason: 'مؤجَّل', effective: eff })];
			const f = TestBed.createComponent(SettingsSectionComponent); f.componentRef.setInput('keys', ['baseCurrency']); f.componentRef.setInput('variant', variant); await flush(f);
			const p = TestBed.inject(SystemSettingsStore).load(); http.expectOne(B).flush({ success: true, data: { storageReady: true, items: BL } }); await p; await flush(f); return f.nativeElement as HTMLElement;
		};
		for (const v of ['ss', 'spa'] as const) {
			TestBed.resetTestingModule(); TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmModalService, useValue: { confirm: async () => true } }] }); http = TestBed.inject(HttpTestingController);
			expect((await mk(v, null)).querySelector('[data-testid="row-baseCurrency"]')?.textContent).not.toContain('USD');
			TestBed.resetTestingModule(); TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmModalService, useValue: { confirm: async () => true } }] }); http = TestBed.inject(HttpTestingController);
			expect((await mk(v, { value: 'USD', label: 'USD — دولار أمريكي', source: 'built-in default' })).querySelector('[data-testid="row-baseCurrency"]')?.textContent).toContain('USD — دولار أمريكي');
		}
	});
});
