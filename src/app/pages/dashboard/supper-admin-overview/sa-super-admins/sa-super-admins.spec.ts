import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { SettingItem } from '../../../../core/services/system-settings.store';
import { SaSuperAdmins } from './sa-super-admins';

const B = `${environment.url_api}/admin/system-settings`;
const flush = async (f: any) => { f.detectChanges(); await f.whenStable(); f.detectChanges(); };
const it0 = (o: Partial<SettingItem> & { key: string }): SettingItem => ({ tab: 'general', label: o.key, description: 'وصف', status: 'enforced', unit: null, allowed: null, pages: ['P-AD-021'], canWrite: true, effect: 'within-5s', reason: null, value: '', version: 0, source: 'default', ...o });
const ITEMS: SettingItem[] = [
	it0({ key: 'platformName', value: 'وسيط', version: 1 }), it0({ key: 'defaultLanguage', status: 'readonly', canWrite: false, value: 'ar', version: null, source: 'ثابت في الواجهة', reason: 'الواجهة عربية فقط حاليًا' }),
	it0({ key: 'defaultTimezone', status: 'blocked', canWrite: false, value: null, version: null, reason: 'لا توجد طبقة عرض/تقارير موحّدة تستهلكها' }), it0({ key: 'baseCurrency', value: 'USD', allowed: ['USD', 'SAR'] }),
	it0({ key: 'registrationOpen', value: true }), it0({ key: 'maintenanceMode', value: false }),
	it0({ key: 'sessionIdleMinutes', value: 0, unit: 'دقيقة' }),
	it0({ key: 'apiKeys', status: 'readonly', canWrite: false, value: { paypal: true, smsProvider: false, billingGateway: false }, version: null, source: 'متغيرات بيئة الخادم (حالة فقط)', reason: 'المفاتيح أسرار تُدار في بيئة الخادم' }),
	it0({ key: 'smtp', status: 'readonly', canWrite: false, value: { configured: true, senderConfigured: true }, version: null, source: 'متغيرات بيئة الخادم (حالة فقط)', reason: 'أسرار' }),
	it0({ key: 'aiMatchEngine', status: 'blocked', canWrite: false, value: null, version: null, reason: 'تغييرات الذكاء الاصطناعي نطاق منفصل' }),
];
const ok = (data: any) => ({ success: true, data });

describe('Super Admin page (P-AD-021): the same server registry, the real audit trail, an honest red zone', () => {
	let http: HttpTestingController; let confirm: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		confirm = vi.fn(async () => true);
		TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmModalService, useValue: { confirm } }] });
		http = TestBed.inject(HttpTestingController);
		const a = TestBed.inject(AdminAccessService); a.access.set({ userId: 'me', isSuperAdmin: true, staffStatus: null, roleName: 'Super Admin', permissions: [], hasAnyPermission: true, state: 'SUPER_ADMIN', displayRole: 'مدير النظام' } as any); a.status.set('ready');
	});
	const boot = async () => {
		const f = TestBed.createComponent(SaSuperAdmins); await flush(f);
		http.match(r => r.url.includes('/admin/console/admins')).forEach(r => r.flush(ok([{ id: 'a1', name: 'مدير النظام', email: 's@x.co', accountType: 'SUPER_ADMIN', status: 'ACTIVE', lastActiveAt: null }])));
		http.match(r => r.url.includes('/audit-log')).forEach(r => r.flush(ok({ items: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 }, eventTypes: [] })));
		http.expectOne(B).flush(ok({ storageReady: true, items: ITEMS })); await flush(f);
		return { f, el: f.nativeElement as HTMLElement, c: f.componentInstance as any };
	};
	const go = async (f: any, c: any, s: string) => { c.setSection(s); await flush(f); };

	it('has the eight design tabs in order (settings tabs + red zone)', async () => {
		const { el } = await boot();
		expect(Array.from(el.querySelectorAll('.spa-nav-item')).map(b => b.textContent?.trim())).toEqual(['عام', 'الرسوم والمالية', 'الأمان', 'الإشعارات', 'الذكاء الاصطناعي', 'التكاملات والـ API', 'Audit Trail', 'المنطقة الحمراء']);
	});

	it('general: identity / registration / content cards come from the registry; a blocked item states why; the roster of admin accounts is kept', async () => {
		const { el } = await boot();
		expect(el.querySelector('[data-testid="row-platformName"] input')).toBeTruthy(); expect(el.querySelector('[data-testid="row-defaultTimezone"]')?.textContent).toContain('لا توجد طبقة عرض'); expect(el.querySelector('[data-testid="row-defaultLanguage"]')?.textContent).toContain('المصدر');
		expect(el.querySelector('[data-testid="admins-card"]')?.textContent).toContain('مدير النظام');
		expect(el.textContent).not.toContain('smtp.sendgrid.net'); expect(el.textContent).not.toContain('300xxxxxxxxx003');
	});

	it('header save sends only the changed keys with their versions and shows "saved" after the server answers', async () => {
		const { f, el } = await boot();
		const sw = el.querySelector('[data-testid="row-registrationOpen"] button[role=switch]') as HTMLButtonElement; sw.click(); await flush(f);
		(el.querySelector('[data-testid="header-save"]') as HTMLButtonElement).click(); await flush(f);
		expect(confirm).toHaveBeenCalledTimes(1);
		const req = http.expectOne(r => r.method === 'PUT'); expect(req.request.body).toEqual({ changes: { registrationOpen: false }, expected: { registrationOpen: 0 } });
		expect(el.querySelector('[data-testid="settings-saved"]')).toBeNull();
		req.flush(ok({ changed: ['registrationOpen'], items: ITEMS.map(i => (i.key === 'registrationOpen' ? { ...i, value: false, version: 1 } : i)) })); await flush(f);
		expect(el.querySelector('[data-testid="settings-saved"]')?.textContent).toContain('تم الحفظ');
	});

	it('integrations show configured / not configured only (never a key); AI engines are listed as unavailable with the scope reason', async () => {
		const { f, el, c } = await boot(); await go(f, c, 'integrations');
		// the design lists one row per integration (name + state); the same real states as before, now one row each instead of one joined line
		const ent = (k: string) => el.querySelector(`[data-testid="entry-apiKeys-${k}"]`)?.textContent ?? ''; expect(ent('paypal')).toContain('PayPal'); expect(ent('paypal')).toContain('مهيّأ'); expect(ent('smsProvider')).toContain('مزوّد SMS'); expect(ent('smsProvider')).toContain('غير مهيّأ'); expect(el.textContent).not.toMatch(/•{4,}|sk_|secret/i);
		await go(f, c, 'ai'); expect(el.querySelector('[data-testid="row-aiMatchEngine"]')?.textContent).toContain('نطاق منفصل');
	});

	it('fees tab: the header save is visibly disabled (nothing here saves through it) ', async () => {
		const { f, el, c } = await boot(); await go(f, c, 'fees');
		const b = el.querySelector('[data-testid="header-save-fees"]') as HTMLButtonElement; expect(b.disabled).toBe(true); expect(b.title).toContain('تُجدول');
	});

	it('red zone: maintenance is the REAL setting behind a double confirmation; wipe / broadcast / backup are disabled and say why; nothing pretends to run', async () => {
		const { f, el, c } = await boot(); await go(f, c, 'danger');
		for (const k of ['wipeTest', 'broadcast', 'backup']) { const r = el.querySelector(`[data-testid="danger-${k}"]`) as HTMLElement; expect((r.querySelector('button') as HTMLButtonElement).disabled).toBe(true); expect(r.textContent).toContain('غير متاح'); }
		confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		(el.querySelector('[data-testid="danger-maintenance-btn"]') as HTMLButtonElement).click(); await flush(f);
		expect(confirm).toHaveBeenCalledTimes(2); http.expectNone(r => r.method === 'PUT'); // the second confirmation declined: nothing sent
		confirm.mockResolvedValue(true);
		(el.querySelector('[data-testid="danger-maintenance-btn"]') as HTMLButtonElement).click(); await flush(f);
		const req = http.expectOne(r => r.method === 'PUT'); expect(req.request.body).toEqual({ changes: { maintenanceMode: true }, expected: { maintenanceMode: 0 } });
		req.flush({ success: false, message: 'ليست لديك صلاحية', code: 'SETTING_PERMISSION_DENIED' }, { status: 403, statusText: 'x' }); await flush(f); await flush(f);
		expect(el.querySelector('[data-testid="danger-error"]')).toBeTruthy(); expect(el.querySelector('[data-testid="danger-maintenance-btn"]')?.textContent).toContain('تفعيل'); // still off: the server did not confirm
	});
});
