import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { SettingItem, SystemSettingsStore } from '../../../../core/services/system-settings.store';
import { By } from '@angular/platform-browser';
import { SettingsSectionComponent } from '../../../../shared/system-settings/settings-section.component';
import { SaSystemSettings } from './sa-system-settings';

const B = `${environment.url_api}/admin/system-settings`;
const flush = async (f: any) => { f.detectChanges(); await f.whenStable(); f.detectChanges(); };
const item = (o: Partial<SettingItem> & { key: string }): SettingItem => ({ tab: 'general', label: o.key, description: 'وصف', status: 'enforced', unit: null, allowed: null, pages: ['P-AD-020'], canWrite: true, effect: 'within-5s', reason: null, value: '', version: 0, source: 'default', ...o });
const ITEMS: SettingItem[] = [
	item({ key: 'platformName', label: 'اسم النظام', value: 'وسيط', version: 2 }),
	item({ key: 'maintenanceMode', label: 'وضع الصيانة', value: false, version: 0, effect: 'within-5s' }),
	item({ key: 'registrationOpen', label: 'تسجيل حسابات جديدة', value: true, version: 0 }),
	item({ key: 'liveSupportAssistant', label: 'الدعم الفوري', status: 'blocked', canWrite: false, value: null, version: null, effect: null, reason: 'تغييرات الذكاء الاصطناعي نطاق منفصل: يُجرد هنا فقط.', source: null }),
	item({ key: 'supportEmail', value: 'a@b.co', version: 1 }), item({ key: 'supportPhone', value: '' }), item({ key: 'maintenanceBannerEnabled', value: false }), item({ key: 'maintenanceBannerText', value: '' }),
	item({ key: 'termsVersion', value: '' }), item({ key: 'privacyVersion', value: '' }), item({ key: 'termsContent', value: '' }), item({ key: 'privacyContent', value: '' }),
	item({ key: 'sessionIdleMinutes', tab: 'security', label: 'انتهاء الجلسة بسبب الخمول', value: 0, unit: 'دقيقة' }),
	item({ key: 'sessionMaxHours', tab: 'security', label: 'المدة القصوى المطلقة للجلسة', value: 168, allowed: [8, 24, 48, 168], unit: 'ساعة', effect: 'new-sessions' }),
	item({ key: 'auditLogging', tab: 'security', label: 'تسجيل سجلات التدقيق', status: 'readonly', canWrite: false, value: true, version: null, effect: null, source: 'دائم', reason: 'مفعّل دائمًا ولا يمكن تعطيله (سلامة التدقيق).' }),
	item({ key: 'baseCurrency', tab: 'finance', label: 'العملة الأساسية', value: 'USD', allowed: ['USD', 'SAR'], effect: 'immediate' }),
];
const HIST = [{ id: 'h1', at: '2026-10-25T10:00:00Z', severity: 'WARNING', ip: '10.0.0.7', actor: 'مدير النظام', changes: [{ key: 'sessionIdleMinutes', label: 'مدة انتهاء الجلسة', from: 0, to: 60 }] }];

describe('system settings page (P-AD-020): registry-driven, honest, saved only on the server\'s word', () => {
	let http: HttpTestingController; let confirm: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		confirm = vi.fn(async () => true);
		TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmModalService, useValue: { confirm } }] });
		http = TestBed.inject(HttpTestingController);
		const a = TestBed.inject(AdminAccessService); a.access.set({ userId: 'me', isSuperAdmin: true, staffStatus: null, roleName: 'Super Admin', permissions: [], hasAnyPermission: true, state: 'SUPER_ADMIN', displayRole: 'مدير النظام' } as any); a.status.set('ready');
	});
	const boot = async (items: SettingItem[] = ITEMS, history: any[] = HIST) => {
		const f = TestBed.createComponent(SaSystemSettings); await flush(f);
		http.expectOne(B).flush({ success: true, data: { storageReady: true, items } }); await flush(f); http.expectOne(r => r.url === `${B}/history`).flush({ success: true, data: history }); await flush(f);
		return { f, el: f.nativeElement as HTMLElement, c: f.componentInstance as any };
	};
	const row = (el: HTMLElement, k: string) => el.querySelector(`[data-testid="row-${k}"]`) as HTMLElement;
	const type = async (f: any, input: HTMLInputElement, v: string) => { input.value = v; input.dispatchEvent(new Event('input')); await flush(f); };

	it('has exactly the seven design tabs and no sample data', async () => {
		const { el } = await boot();
		expect(Array.from(el.querySelectorAll('.ss-nav-item')).map(b => b.textContent?.trim())).toEqual(['عام', 'الذكاء الاصطناعي', 'الإشعارات', 'الأمان', 'المالية', 'الإقليمية', 'صحة النظام']);
		for (const sample of ['99.8%', '197.32.14.88', '185.220.101.42', 'فهد العتيبي', 'admin@waseet.ai', '95% دقة']) expect(el.textContent).not.toContain(sample);
	});

	it('loading and a failed load are separate states; the failure offers a retry that reloads', async () => {
		const f = TestBed.createComponent(SaSystemSettings); await flush(f); const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="settings-loading"]')).toBeTruthy();
		http.expectOne(B).flush({ success: false, message: 'x' }, { status: 500, statusText: 'x' }); await flush(f);
		expect(el.querySelector('[data-testid="settings-load-error"]')).toBeTruthy(); expect(el.querySelector('[data-testid="settings-loading"]')).toBeNull();
		(el.querySelector('[data-testid="settings-load-error"] button') as HTMLButtonElement).click(); http.expectOne(B).flush({ success: true, data: { storageReady: true, items: ITEMS } }); await flush(f); http.expectOne(r => r.url === `${B}/history`).flush({ success: true, data: [] }); await flush(f);
		expect(el.querySelector('[data-testid="row-platformName"]')).toBeTruthy();
	});

	it('rows follow the server: enforced = live control, blocked = disabled with the reason, read-only = value + source; nothing is a switch that changes nothing', async () => {
		const { f, el, c } = await boot();
		expect((row(el, 'maintenanceMode').querySelector('button[role=switch]') as HTMLButtonElement).disabled).toBe(false);
		const blocked = row(el, 'liveSupportAssistant'); expect(blocked.querySelector('button[role=switch]')).toBeNull(); expect(blocked.textContent).toContain('غير متاح'); expect(blocked.textContent).toContain('نطاق منفصل');
		// an unavailable function is a muted label, never a control (no switch, input, select or button)
		expect(blocked.querySelector('[data-testid="na-liveSupportAssistant"]')?.textContent).toContain('غير متاح'); expect(blocked.querySelector('input, select, textarea, button:not(.st-help-btn), [role=switch]')).toBeNull(); // the only button is the row's ⓘ help (information, not a control of the value)
		c.setTab('security'); await flush(f);
		expect(row(el, 'auditLogging').querySelector('[data-testid="value-auditLogging"]')?.textContent).toContain('مفعّل'); expect(row(el, 'auditLogging').textContent).toContain('المصدر: دائم'); expect(row(el, 'auditLogging').textContent).toContain('لا يمكن تعطيله');
		expect(row(el, 'auditLogging').querySelector('input, button[role=switch]')).toBeNull();
	});

	it('save sends the changed keys with their versions, shows "saved" only after the server answers, and refreshes the change log', async () => {
		const { f, el } = await boot(); const ui = TestBed.inject(UiNotificationService);
		await type(f, row(el, 'platformName').querySelector('input') as HTMLInputElement, 'منصتي');
		const btn = el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement; expect(btn.disabled).toBe(false); btn.click(); await flush(f);
		const req = http.expectOne(r => r.method === 'PUT' && r.url === B); expect(req.request.body).toEqual({ changes: { platformName: 'منصتي' }, expected: { platformName: 2 } });
		expect(el.querySelector('[data-testid="settings-saved"]')).toBeNull(); expect(ui.toasts().length).toBe(0); // nothing is claimed before the server answers
		req.flush({ success: true, data: { changed: ['platformName'], items: ITEMS.map(i => (i.key === 'platformName' ? { ...i, value: 'منصتي', version: 3 } : i)) } }); await flush(f);
		expect(el.querySelector('[data-testid="settings-saved"]')?.textContent).toContain('تم الحفظ'); expect(ui.toasts().map(t => t.message)).toEqual(['تم حفظ الإعدادات']);
		expect((row(el, 'platformName').querySelector('input') as HTMLInputElement).value).toBe('منصتي');
		http.expectOne(r => r.url === `${B}/history`).flush({ success: true, data: HIST }); await flush(f);
	});

	it('a failed save keeps what was typed, explains the reason next to the field, and says nothing was saved', async () => {
		const { f, el } = await boot(); const ui = TestBed.inject(UiNotificationService);
		await type(f, row(el, 'supportEmail').querySelector('input') as HTMLInputElement, 'not-an-email');
		(el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement).click(); await flush(f);
		http.expectOne(r => r.method === 'PUT').flush({ success: false, message: 'البريد غير صالح', errors: [{ field: 'supportEmail', message: 'البريد غير صالح' }] }, { status: 400, statusText: 'x' }); await flush(f);
		expect(el.querySelector('[data-testid="error-supportEmail"]')?.textContent).toContain('البريد غير صالح'); expect((row(el, 'supportEmail').querySelector('input') as HTMLInputElement).value).toBe('not-an-email');
		expect(el.querySelector('[data-testid="settings-saved"]')).toBeNull(); expect(ui.toasts().length).toBe(0);
		(el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement).click(); await flush(f); http.expectOne(r => r.method === 'PUT'); // still editable, retry possible
	});

	it('a concurrent change (409) shows MY value next to the server\'s, and continuing is a two-step act: re-read the newest, then a confirmation that names the value being replaced - the write carries the NEW version, nothing is overwritten silently', async () => {
		const { f, el } = await boot();
		await type(f, row(el, 'platformName').querySelector('input') as HTMLInputElement, 'تعديلي');
		(el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement).click(); await flush(f);
		http.expectOne(r => r.method === 'PUT').flush({ success: false, code: 'SETTINGS_VERSION_CONFLICT', message: 'عُدّل هذا الإعداد من جهة أخرى قبل حفظك.', errors: [{ key: 'platformName', current: { value: 'من آخر', version: 5 } }] }, { status: 409, statusText: 'x' }); await flush(f);
		expect(el.querySelector('[data-testid="settings-failure"]')?.textContent).toContain('عُدّل هذا الإعداد'); expect((row(el, 'platformName').querySelector('input') as HTMLInputElement).value).toBe('تعديلي');
		const tbl = el.querySelector('[data-testid="conflict-table"]')?.textContent ?? ''; expect(tbl).toContain('تعديلي'); expect(tbl).toContain('من آخر');
		(el.querySelector('[data-testid="conflict-overwrite"]') as HTMLButtonElement).click(); await flush(f);
		http.expectOne(B).flush({ success: true, data: { storageReady: true, items: ITEMS.map(i => (i.key === 'platformName' ? { ...i, value: 'من آخر', version: 5 } : i)) } }); await flush(f);
		http.expectNone(r => r.method === 'PUT'); // re-reading wrote NOTHING
		expect((row(el, 'platformName').querySelector('input') as HTMLInputElement).value).toBe('تعديلي'); // my draft survives, against version 5
		confirm.mockResolvedValueOnce(false); (el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement).click(); await flush(f);
		expect(confirm.mock.calls.at(-1)![0].message).toContain('«من آخر» ستُستبدل بقيمتك «تعديلي»'); http.expectNone(r => r.method === 'PUT'); // declined: still nothing written
		(el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement).click(); await flush(f);
		expect(http.expectOne(r => r.method === 'PUT').request.body).toEqual({ changes: { platformName: 'تعديلي' }, expected: { platformName: 5 } });
	});

	it('idle-session change: the confirmation says how many live sessions end right now; the absolute max-hours select keeps its numeric values and says it reaches new sessions only', async () => {
		const { f, el, c } = await boot(); c.setTab('security'); await flush(f);
		await type(f, row(el, 'sessionIdleMinutes').querySelector('input') as HTMLInputElement, '60');
		(el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement).click(); await flush(f);
		http.expectOne(r => r.url === `${B}/sessions-impact` && r.params.get('idleMinutes') === '60').flush({ success: true, data: { idleMinutes: 60, activeSessions: 40, wouldEndNow: 7 } }); await flush(f);
		expect(confirm.mock.calls.at(-1)![0].message).toContain('ستنتهي الآن 7 جلسة خاملة من أصل 40'); http.expectOne(r => r.method === 'PUT').flush({ success: true, data: { changed: ['sessionIdleMinutes'], items: ITEMS } }); await flush(f);
		expect(row(el, 'sessionMaxHours').querySelector('ws-select')).toBeTruthy(); // a select with the four numeric choices, not a text box
		const section = f.debugElement.queryAll(By.directive(SettingsSectionComponent)).map(d => d.componentInstance as SettingsSectionComponent).find(c => c.keys().includes('sessionMaxHours'))!;
		section.setEnum(ITEMS.find(i => i.key === 'sessionMaxHours')!, '24'); await flush(f); expect(TestBed.inject(SystemSettingsStore).value('sessionMaxHours')).toBe(24); // stored as the NUMBER 24
		(el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement).click(); await flush(f);
		expect(confirm.mock.calls.at(-1)![0].message).toContain('الجلسات الجديدة فقط'); expect(http.expectOne(r => r.method === 'PUT').request.body.changes).toEqual({ sessionMaxHours: 24 });
	});

	it('a sensitive change (maintenance, registration, idle session, currency) asks for confirmation first, spelling out what changes; declining sends nothing', async () => {
		const { f, el } = await boot();
		(row(el, 'maintenanceMode').querySelector('button[role=switch]') as HTMLButtonElement).click(); await flush(f);
		confirm.mockResolvedValueOnce(false); (el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement).click(); await flush(f);
		expect(confirm).toHaveBeenCalledTimes(1); expect(confirm.mock.calls[0][0].message).toContain('وضع الصيانة'); expect(confirm.mock.calls[0][0].message).toContain('يتوقف'.slice(0, 0) + 'سيتوقف الوصول'); http.expectNone(r => r.method === 'PUT');
		(el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement).click(); await flush(f);
		expect(http.expectOne(r => r.method === 'PUT').request.body).toEqual({ changes: { maintenanceMode: true }, expected: { maintenanceMode: 0 } });
	});

	it('a setting the user may not change is shown but locked, with the reason', async () => {
		const { el } = await boot(ITEMS.map(i => (i.key === 'platformName' ? { ...i, canWrite: false } : i)));
		const r = row(el, 'platformName'); expect((r.querySelector('input') as HTMLInputElement).disabled).toBe(true); expect(r.textContent).toContain('ليست لديك صلاحية');
	});

	it('currency: USD today; a refused change lists the real blockers; the readiness card lists them too', async () => {
		const { f, el, c } = await boot(); c.setTab('finance'); await flush(f);
		http.expectOne(`${B}/currency-readiness`).flush({ success: true, data: { ready: false, blockers: [{ code: 'FX_RECORD_MISSING', message: 'لا يوجد سجل تحويل' }] } }); await flush(f);
		expect(el.querySelector('[data-testid="readiness-blockers"]')?.textContent).toContain('لا يوجد سجل تحويل');
		(el.querySelectorAll('ws-select button')[0] as HTMLButtonElement).click(); f.detectChanges();
		(el.querySelectorAll('[data-testid=ws-select-option]')[1] as HTMLElement).click(); await flush(f);
		(el.querySelector('[data-testid="settings-save"]') as HTMLButtonElement).click(); await flush(f);
		http.expectOne(r => r.method === 'PUT').flush({ success: false, code: 'CURRENCY_CHANGE_NOT_READY', message: 'تغيير العملة الأساسية غير جاهز', errors: [{ code: 'FX_RECORD_MISSING', message: 'لا يوجد سجل تحويل' }, { code: 'GATEWAY_CAPABILITY_MAP_MISSING', message: 'لا توجد خريطة قدرات' }] }, { status: 409, statusText: 'x' }); await flush(f);
		expect(el.querySelector('[data-testid="currency-blockers"]')?.textContent).toContain('لا توجد خريطة قدرات'); expect(el.querySelector('[data-testid="settings-saved"]')).toBeNull();
	});

	it('change log: real events (who, from → to, IP) from the server; empty and failed are different states', async () => {
		const { el } = await boot(); const r = el.querySelector('[data-testid="changelog-row"]') as HTMLElement;
		expect(r.textContent).toContain('مدير النظام'); expect(r.textContent).toContain('من 0 ← 60'); expect(r.textContent).toContain('10.0.0.7');
	});
	it('change log empty / failed', async () => {
		const f = TestBed.createComponent(SaSystemSettings); await flush(f); http.expectOne(B).flush({ success: true, data: { storageReady: true, items: ITEMS } }); await flush(f);
		http.expectOne(r => r.url === `${B}/history`).flush({ success: false }, { status: 500, statusText: 'x' }); await flush(f); const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="changelog-error"]')).toBeTruthy(); expect(el.querySelector('[data-testid="changelog-empty"]')).toBeNull();
	});

	it('health: only real measured facts; loading / failed / unavailable are explicit (no uptime percentage)', async () => {
		const { f, el, c } = await boot(); c.setTab('health'); await flush(f);
		expect(el.querySelector('[data-testid="health-card"]')?.textContent).toContain('جارٍ فحص'); 
		http.expectOne(`${B}/health`).flush({ success: true, data: { checkedAt: '2026-10-25T10:00:00Z', items: [{ key: 'database', label: 'قاعدة البيانات', status: 'ok', detail: 'استجابة 4 ms' }, { key: 'backup', label: 'النسخ الاحتياطي', status: 'unavailable', detail: 'لا يوجد مصدر مراقبة مرتبط' }] } }); await flush(f);
		expect(el.querySelector('[data-testid="health-database"]')?.textContent).toContain('استجابة 4 ms'); expect(el.querySelector('[data-testid="health-backup"]')?.textContent).toContain('غير متاح'); expect(el.textContent).not.toContain('uptime');
	});
});
