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
		expect(Array.from(el.querySelectorAll('.spa-nav-item')).map(b => b.textContent?.trim())).toEqual(['عام', 'الرسوم والمالية', 'الأمان', 'الإشعارات', 'محركات AI', 'التكاملات والـ API', 'Audit Trail', 'المنطقة الحمراء']);
	});

	it('general: identity / registration / content cards come from the registry; a blocked item states why; the roster of admin accounts is kept', async () => {
		const { f, el } = await boot();
		expect(el.querySelector('[data-testid="row-platformName"] input')).toBeTruthy(); (el.querySelector('[data-testid="help-btn-defaultTimezone"]') as HTMLButtonElement).click(); await flush(f); expect(el.querySelector('[data-testid="row-defaultTimezone"]')?.textContent).toContain('لا توجد طبقة عرض'); /* round 2: the reason lives behind the row's ⓘ help, not inline */ (el.querySelector('[data-testid="help-btn-defaultLanguage"]') as HTMLButtonElement).click(); await flush(f); expect(el.querySelector('[data-testid="row-defaultLanguage"]')?.textContent).toContain('المصدر');
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
		await go(f, c, 'ai'); (el.querySelector('[data-testid="help-btn-aiMatchEngine"]') as HTMLButtonElement).click(); await flush(f); expect(el.querySelector('[data-testid="row-aiMatchEngine"]')?.textContent).toContain('نطاق منفصل');
	});

	it('fees tab: the header save is visibly disabled (nothing here saves through it) ', async () => {
		const { f, el, c } = await boot(); await go(f, c, 'fees');
		const b = el.querySelector('[data-testid="header-save-fees"]') as HTMLButtonElement; expect(b.disabled).toBe(true); expect(b.title).toContain('تُجدول');
	});

	it('red zone: maintenance is the REAL setting behind a double confirmation; wipe / broadcast / backup are disabled and say why; nothing pretends to run', async () => {
		const { f, el, c } = await boot(); await go(f, c, 'danger');
		for (const k of ['wipeTest', 'broadcast', 'backup']) { const r = el.querySelector(`[data-testid="danger-${k}"]`) as HTMLElement; expect((r.querySelector('.spa-btn-danger') as HTMLButtonElement).disabled).toBe(true); expect(r.textContent).toContain('غير متاح'); (r.querySelector('.spa-help-btn') as HTMLButtonElement).click(); await flush(f); expect(r.querySelector(`[data-testid="help-${k}"]`)?.textContent?.length).toBeGreaterThan(10); }
		confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		(el.querySelector('[data-testid="danger-maintenance-btn"]') as HTMLButtonElement).click(); await flush(f);
		expect(confirm).toHaveBeenCalledTimes(2); http.expectNone(r => r.method === 'PUT'); // the second confirmation declined: nothing sent
		confirm.mockResolvedValue(true);
		(el.querySelector('[data-testid="danger-maintenance-btn"]') as HTMLButtonElement).click(); await flush(f);
		const req = http.expectOne(r => r.method === 'PUT'); expect(req.request.body).toEqual({ changes: { maintenanceMode: true }, expected: { maintenanceMode: 0 } });
		req.flush({ success: false, message: 'ليست لديك صلاحية', code: 'SETTING_PERMISSION_DENIED' }, { status: 403, statusText: 'x' }); await flush(f); await flush(f);
		expect(el.querySelector('[data-testid="danger-error"]')).toBeTruthy(); expect(el.querySelector('[data-testid="danger-maintenance-btn"]')?.textContent).toContain('تفعيل'); // still off: the server did not confirm
	});

	it('audit tab: every row shows ITS OWN event (Arabic name from the code, actor, target, detail), the real event id (as tooltip) with «#» only a display order and platform-formatted dates', async () => {
		const { f, el, c } = await boot();
		const mk = (o: any) => ({ category: 'SYSTEM_AUDIT', title: 't', summary: null, severity: 'INFO', source: 'ADMIN', status: 'COMPLETED', ipAddress: null, device: null, actorLabel: null, account: { id: 'x', name: '', accountType: null }, ...o });
		await go(f, c, 'audit');
		c.auditRows.set([
			mk({ id: 'LOG:1', eventId: 'LOG:1', eventType: 'SESSION_STARTED', actionLabel: 'تسجيل دخول جديد', title: 'تسجيل دخول جديد', detail: 'بدأت جلسة جديدة', occurredAt: '2026-10-26T12:00:00Z', actor: { id: 'a', name: 'مدير النظام', accountType: 'SUPER_ADMIN' }, ipAddress: '10.0.0.1' }),
			mk({ id: 'ACCESS:2', eventId: 'ACCESS:2', eventType: 'STAFF_SUSPENDED', actionLabel: 'إيقاف موظف', severity: 'WARNING', detail: 'الحالة: نشط ← موقوف', occurredAt: '2026-10-26T11:00:00Z', actor: { id: 'a', name: 'مدير النظام', accountType: 'SUPER_ADMIN' }, target: { type: 'USER', typeLabel: 'حساب', id: 'u9', label: 'سارة' } }),
			mk({ id: 'LOG:3', eventId: 'LOG:3', eventType: 'FEE_POLICY_SCHEDULED', actionLabel: 'جدولة تعديل سياسة الرسوم', detail: 'نسخة 2 · تسري من', detailDate: '2026-10-30T00:00:00Z', occurredAt: '2026-10-26T10:00:00Z', actor: { id: 'a', name: 'مدير النظام', accountType: 'SUPER_ADMIN' }, target: { type: 'FEE_POLICY', typeLabel: 'سياسة الرسوم', id: '2', label: 'نسخة 2' } }),
			mk({ id: 'LOG:4', eventId: 'LOG:4', severity: 'UNCLASSIFIED', actor: { id: null, name: 'غير معروف', accountType: null, kind: 'UNKNOWN' }, eventType: 'NEW_UNKNOWN', actionLabel: 'NEW_UNKNOWN', occurredAt: '2026-10-26T09:00:00Z', }),
		]); await flush(f);
		const rows = Array.from(el.querySelectorAll('[data-testid="audit-row"]'));
		expect(rows.map(r => r.querySelector('[data-testid="audit-action"]')?.textContent?.trim())).toEqual(['تسجيل دخول جديد', 'إيقاف موظف', 'جدولة تعديل سياسة الرسوم', 'NEW_UNKNOWN']);
		expect(rows.map(r => r.querySelector('[data-testid="audit-order"]')?.textContent?.trim())).toEqual(['#1', '#2', '#3', '#4']);
		expect(rows[0].querySelector('[data-testid="audit-order"]')?.getAttribute('title')).toContain('LOG:1'); expect(el.querySelector('[data-testid="audit-order-th"]')?.getAttribute('title')).toContain('ترتيب العرض');
		expect(rows[3].querySelector('td:last-child .spa-bdg')?.textContent).toContain('غير مصنّف');
		expect(rows[1].querySelector('[data-testid="audit-target"]')?.textContent).toContain('سارة'); expect(rows[1].querySelector('[data-testid="audit-target"]')?.textContent).toContain('u9');
		expect(rows[2].querySelector('[data-testid="audit-detail"]')?.textContent).toMatch(/تسري من\s+2026-10-30/);
		expect(rows[3].querySelector('[data-testid="audit-actor"]')?.textContent).toContain('غير معروف');
		expect(new Set(rows.map(r => r.querySelector('[data-testid="audit-action"]')?.textContent?.trim())).size).toBe(4); // not «every row looks like a login»
	});

	it('audit CSV: carries the real event id as its own column and calls «#» a display order', async () => {
		const { f, c } = await boot(); await go(f, c, 'audit');
		const base: any = { category: 'SYSTEM_AUDIT', title: 't', summary: null, severity: 'WARNING', source: 'ADMIN', status: 'COMPLETED', ipAddress: '10.0.0.1', device: null, actorLabel: null, account: { id: 'x', name: '', accountType: null }, occurredAt: '2026-10-26T12:00:00Z' };
		c.auditRows.set([{ ...base, id: 'ACCESS:abc', eventId: 'ACCESS:abc', eventType: 'STAFF_SUSPENDED', actionLabel: 'إيقاف موظف', actor: { id: 'a', name: 'مدير', accountType: 'SUPER_ADMIN', kind: 'USER' } }]); await flush(f);
		let blob: Blob | null = null; const create = vi.fn((b: Blob) => { blob = b; return 'blob:x'; }); (URL as any).createObjectURL = create; (URL as any).revokeObjectURL = vi.fn();
		c.exportAuditCsv(); const text = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(blob as unknown as Blob); });
		const [head, row] = text.replace('\ufeff', '').split('\n');
		expect(head.split(',').slice(0, 2)).toEqual(['معرّف الحدث', 'ترتيب العرض']); expect(row).toContain('"ACCESS:abc"'); expect(row).toContain('"STAFF_SUSPENDED"');
	});

	it('a failed or conflicting header save is SHOWN on this page (its cards have no save button of their own): conflict table, reload and continue actions', async () => {
		const { f, el, c } = await boot();
		const input = el.querySelector('[data-testid="row-platformName"] input') as HTMLInputElement; input.value = 'اسم آخر'; input.dispatchEvent(new Event('input')); await flush(f);
		(el.querySelector('[data-testid="header-save"]') as HTMLButtonElement).click(); await flush(f);
		http.expectOne(r => r.method === 'PUT').flush({ success: false, message: 'عُدّل هذا الإعداد من جهة أخرى قبل حفظك.', code: 'SETTINGS_VERSION_CONFLICT', errors: [{ key: 'platformName', current: { value: 'وسيط آخر', version: 5 } }] }, { status: 409, statusText: 'x' }); await flush(f); await flush(f);
		expect(el.querySelector('[data-testid="settings-failure"]')?.textContent).toContain('عُدّل هذا الإعداد');
		expect(el.querySelector('[data-testid="conflict-table"]')?.textContent).toContain('وسيط آخر');
		expect(el.querySelector('[data-testid="conflict-overwrite"]')).toBeTruthy(); expect(el.querySelector('[data-testid="conflict-reload"]')).toBeTruthy();
		void c;
	});
});
