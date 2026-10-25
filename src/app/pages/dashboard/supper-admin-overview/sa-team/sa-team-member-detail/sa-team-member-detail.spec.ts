import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { environment } from '../../../../../../environments/environment';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { SaTeamMemberDetail } from './sa-team-member-detail';

const B = `${environment.url_api}/admin/team`;
const flush = async (f: any) => { f.detectChanges(); await f.whenStable(); f.detectChanges(); };
const setAccess = (isSuperAdmin: boolean, permissions: string[], userId = 'me') => { const a = TestBed.inject(AdminAccessService); a.access.set({ userId, isSuperAdmin, staffStatus: 'ACTIVE', roleName: 'دور', permissions, hasAnyPermission: true, state: isSuperAdmin ? 'SUPER_ADMIN' : 'ACTIVE', displayRole: 'دور' }); a.status.set('ready'); };
const member = (over: any = {}) => ({ userId: 'u1', name: 'هيثم القرني', email: 'h@x.com', status: 'ACTIVE', isSuperAdmin: false, role: { id: 'r1', name: 'مشرف نزاعات', color: '#A56BE0' }, departments: ['النزاعات'], joinedAt: '2026-01-01T00:00:00Z', lastActiveAt: null, activeNow: false, lastLoginAt: '2026-10-25T09:00:00Z', resolvedDisputes: 3, avgCompletionHours: 2.4, version: 1, openTasks: 2, overdueTasks: 1, doneTasks: 5, ...over });
const list = (m: any) => ({ success: true, data: { members: [m], pendingInvites: [], counts: { total: 1, activeNow: 0, active: 1, suspended: 0, pendingInvites: 0, openTasks: 2, overdueTasks: 1 } } });
const el = (f: any) => f.nativeElement as HTMLElement;

describe('team member page (P-AD-022-موظف): the design\'s blocks, real values, honest gaps', () => {
	let http: HttpTestingController;
	beforeEach(() => { TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'u1' } } } }] }); http = TestBed.inject(HttpTestingController); });

	it('SUPER_ADMIN: header actions, 4 KPIs, 4 tabs, quick links; presence is «غير متاح» without a live session; unavailable measures say so and show no number', async () => {
		setAccess(true, []);
		const f = TestBed.createComponent(SaTeamMemberDetail); await flush(f);
		http.expectOne(r => r.url === `${B}/staff`).flush(list(member()));
		http.match(r => r.url === `${B}/tasks`).forEach(r => r.flush({ success: true, data: [] }));
		http.expectOne(`${B}/staff/u1/activity`).flush({ success: true, data: [{ id: 'e1', at: '2026-10-25T10:00:00Z', kind: 'STATUS', from: 'NEW', to: 'DONE', taskNumber: 7, taskTitle: 'مراجعة' }] });
		http.expectOne(`${B}/roles`).flush({ success: true, data: [] }); http.expectOne(`${B}/permissions`).flush({ success: true, data: { permissions: [{ id: 'users.view', label: 'عرض المستخدمين', group: 'users', sensitive: false }], groups: { users: 'المستخدمون' }, templates: [], superAdminOnly: [], ambiguities: [] } }); await flush(f);
		const t = el(f).textContent ?? '';
		expect(el(f).querySelectorAll('.tm-kpi').length).toBe(4); expect(el(f).querySelectorAll('.tm-tab').length).toBe(4);
		expect(el(f).querySelector('[data-testid="member-status"]')?.textContent?.trim()).toBe('غير متاح');
		expect(el(f).querySelector('[data-testid="member-edit-perms"]')?.textContent).toContain('تعديل الصلاحيات'); expect(el(f).querySelector('[data-testid="member-toggle"]')?.textContent).toContain('تعليق الحساب');
		expect(el(f).querySelector('[data-testid="kpi-disputes"]')?.textContent?.trim()).toBe('3'); expect(el(f).querySelector('[data-testid="member-last-login"]')?.textContent?.trim()).not.toBe('—');
		expect(t).toContain('النزاعات'); expect(t).toContain('لا تتوفر بيانات'); expect(t).not.toMatch(/94%|98%|88%|4\\.7|142|89/);
		expect(el(f).querySelector('[data-testid="trend-unavailable"]')).toBeTruthy(); expect(el(f).querySelector('[data-testid="cases-unavailable"]')).toBeTruthy(); expect(el(f).querySelector('[data-testid="csat-unavailable"]')).toBeTruthy();
		(el(f).querySelector('[data-testid="tab-log"]') as HTMLButtonElement).click(); await flush(f);
		expect(el(f).textContent).toContain('نقل المهمة T-0007 إلى «مكتمل»');
	});

	it('a plain member (team.view only): no SUPER_ADMIN actions, the permissions tab is SUPER_ADMIN-only, no roles/catalog request, no activity of colleagues', async () => {
		setAccess(false, ['team.view']);
		const f = TestBed.createComponent(SaTeamMemberDetail); await flush(f);
		http.expectOne(r => r.url === `${B}/staff`).flush(list(member({ activeNow: true })));
		http.expectOne(`${B}/staff/u1/activity`).flush({ message: 'x', code: 'ADMIN_PERMISSION_DENIED' }, { status: 403, statusText: 'Forbidden' }); await flush(f);
		http.expectNone(`${B}/roles`); http.expectNone(`${B}/permissions`);
		expect(el(f).querySelector('[data-testid="member-status"]')?.textContent?.trim()).toBe('نشط الآن');
		expect(el(f).querySelector('[data-testid="member-edit-perms"]')).toBeNull(); expect(el(f).querySelector('[data-testid="member-toggle"]')).toBeNull();
		(el(f).querySelector('[data-testid="tab-perms"]') as HTMLButtonElement).click(); await flush(f);
		expect(el(f).querySelector('[data-testid="perms-super-admin-only"]')).toBeTruthy(); expect(el(f).querySelector('[data-testid="member-role-select"]')).toBeNull();
		(el(f).querySelector('[data-testid="tab-log"]') as HTMLButtonElement).click(); await flush(f);
		expect(el(f).querySelector('[data-testid="log-empty"]')?.textContent).toContain('ليست لديك صلاحية');
	});

	const catalog = { success: true, data: { permissions: [{ id: 'users.view', label: 'عرض المستخدمين', group: 'users', sensitive: false }, { id: 'users.delete', label: 'حذف الحسابات', group: 'users', sensitive: true }, { id: 'disputes.view', label: 'عرض النزاعات', group: 'disputes', sensitive: false }], groups: { users: 'المستخدمون', disputes: 'النزاعات' }, templates: [], superAdminOnly: [], ambiguities: [] } };
	const accessOf = (over: any = {}) => ({ success: true, data: { userId: 'u1', version: 3, status: 'ACTIVE', role: { id: 'r1', name: 'مشرف نزاعات' }, rolePermissions: ['users.view', 'disputes.view'], overrides: [], scoped: false, departments: [], effective: ['disputes.view', 'users.view'], ...over } });
	const open = async (acc: any) => {
		setAccess(true, []);
		const f = TestBed.createComponent(SaTeamMemberDetail); await flush(f);
		http.expectOne(r => r.url === `${B}/staff`).flush(list(member())); http.match(r => r.url === `${B}/tasks`).forEach(r => r.flush({ success: true, data: [] })); http.expectOne(`${B}/staff/u1/activity`).flush({ success: true, data: [] });
		http.expectOne(`${B}/roles`).flush({ success: true, data: [{ id: 'r1', name: 'مشرف نزاعات', description: null, color: '#fff', permissions: ['users.view', 'disputes.view'], permissionCount: 2, memberCount: 1, version: 1, updatedAt: '' }, { id: 'r2', name: 'دور آخر', description: null, color: '#fff', permissions: [], permissionCount: 0, memberCount: 0, version: 1, updatedAt: '' }] });
		http.expectOne(`${B}/permissions`).flush(catalog); http.expectOne(`${B}/staff/u1/access`).flush(acc); await flush(f);
		(el(f).querySelector('[data-testid="tab-perms"]') as HTMLButtonElement).click(); await flush(f);
		return f;
	};
	const sw = (f: any, id: string) => el(f).querySelector(`[data-perm="${id}"] .tm-sw`) as HTMLButtonElement;
	const src = (f: any, id: string) => el(f).querySelector(`[data-perm="${id}"]`)?.textContent ?? '';

	it('SUPER_ADMIN: the switches DO what they say - inherited from the role, personal GRANT / DENY (DENY beats the role), back to the role = no personal change, nothing saved until «حفظ الصلاحيات»', async () => {
		const f = await open(accessOf());
		expect(sw(f, 'users.view').classList.contains('on')).toBe(true); expect(src(f, 'users.view')).toContain('من الدور'); expect(sw(f, 'users.delete').classList.contains('on')).toBe(false);
		expect((el(f).querySelector('[data-testid="perms-save"]') as HTMLButtonElement).disabled).toBe(true); // nothing to save yet
		sw(f, 'users.delete').click(); await flush(f); // role lacks it -> personal GRANT
		expect(sw(f, 'users.delete').classList.contains('on')).toBe(true); expect(src(f, 'users.delete')).toContain('سماح فردي');
		sw(f, 'users.view').click(); await flush(f); // role has it -> personal DENY
		expect(sw(f, 'users.view').classList.contains('on')).toBe(false); expect(src(f, 'users.view')).toContain('منع فردي');
		sw(f, 'users.delete').click(); await flush(f); // flip back: equals the role again, so the personal change disappears
		expect(src(f, 'users.delete')).not.toContain('فردي'); expect(el(f).textContent).toContain('(1 تخصيص فردي)');
		http.expectNone(`${B}/staff/u1/access`); // nothing is written by toggling
		(el(f).querySelector('[data-testid="perms-save"]') as HTMLButtonElement).click();
		const req = http.expectOne(r => r.url === `${B}/staff/u1/access` && r.method === 'PUT');
		expect(req.request.body).toEqual({ overrides: [{ permission: 'users.view', effect: 'DENY' }], scoped: false, departments: [], expectedVersion: 3 });
		req.flush({ success: true, data: { userId: 'u1', version: 4 } }); await flush(f);
		http.match(r => r.url === `${B}/staff`).forEach(r => r.flush(list(member()))); http.match(() => true).forEach(r => { try { r.flush({ success: true, data: [] }); } catch { /* */ } });
	});

	it('sensitive personal grants need an explicit confirmation; a stale version is a clear conflict (and nothing is applied)', async () => {
		const f = await open(accessOf());
		sw(f, 'users.delete').click(); await flush(f);
		(el(f).querySelector('[data-testid="perms-save"]') as HTMLButtonElement).click();
		http.expectOne(r => r.method === 'PUT').flush({ code: 'SENSITIVE_CONFIRMATION_REQUIRED', errors: [{ addedSensitive: ['users.delete'] }] }, { status: 409, statusText: 'Conflict' }); await flush(f);
		expect(el(f).querySelector('[data-testid="confirm-sensitive"]')?.textContent).toContain('حذف الحسابات');
		(el(f).querySelector('[data-testid="confirm-sensitive-btn"]') as HTMLButtonElement).click();
		const confirmed = http.expectOne(r => r.method === 'PUT'); expect(confirmed.request.body.confirmSensitive).toBe(true);
		confirmed.flush({ code: 'STAFF_VERSION_CONFLICT', message: 'x' }, { status: 409, statusText: 'Conflict' }); await flush(f);
		expect(el(f).querySelector('[data-testid="member-notice"]')?.textContent).toContain('تغيّر ملف الموظف');
	});

	it('reset to the role: a member with a personal GRANT and a scope sees them marked, the scope cuts what is outside it, and the reset sends an empty personal list and no scope', async () => {
		const g = await open(accessOf({ overrides: [{ permission: 'users.delete', effect: 'GRANT', at: '' }], scoped: true, departments: ['users'] }));
		expect(src(g, 'users.delete')).toContain('سماح فردي'); expect(el(g).querySelector('[data-testid="scope-chips"]')).toBeTruthy();
		expect(src(g, 'disputes.view')).toContain('خارج الأقسام'); expect(sw(g, 'disputes.view').classList.contains('on')).toBe(false); // the scope cuts a section the member is not scoped to
		(el(g).querySelector('[data-testid="perms-reset"]') as HTMLButtonElement).click();
		const rr = http.expectOne(r => r.method === 'PUT'); expect(rr.request.body).toEqual({ overrides: [], scoped: false, departments: [], expectedVersion: 3 });
	});

	it('the section scope is edited as chips: it narrows, never grants (a section the role does not cover is still empty), and an empty selection is not sent as a scope', async () => {
		const f = await open(accessOf());
		expect(el(f).querySelector('[data-testid="scope-chips"]')).toBeNull();
		(el(f).querySelector('[data-testid="scope-toggle"]') as HTMLButtonElement).click(); await flush(f);
		expect(el(f).querySelector('[data-testid="scope-users"]')?.getAttribute('aria-checked')).toBe('true'); expect(el(f).querySelector('[data-testid="scope-disputes"]')?.getAttribute('aria-checked')).toBe('true'); // defaults to what the role covers
		expect(el(f).querySelector('[data-testid="scope-support"]')?.getAttribute('aria-checked')).toBe('false');
		(el(f).querySelector('[data-testid="scope-disputes"]') as HTMLButtonElement).click(); await flush(f);
		expect(src(f, 'disputes.view')).toContain('خارج الأقسام'); expect(sw(f, 'disputes.view').classList.contains('on')).toBe(false);
		(el(f).querySelector('[data-testid="perms-save"]') as HTMLButtonElement).click();
		const r = http.expectOne(x => x.method === 'PUT'); expect(r.request.body).toEqual({ overrides: [], scoped: true, departments: ['users'], expectedVersion: 3 });
	});
});
