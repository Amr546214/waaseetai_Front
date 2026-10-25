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
const setAccess = (isOwner: boolean, permissions: string[], userId = 'me') => { const a = TestBed.inject(AdminAccessService); a.access.set({ userId, isOwner, staffStatus: 'ACTIVE', roleName: 'دور', permissions, hasAnyPermission: true, state: isOwner ? 'OWNER' : 'ACTIVE', displayRole: 'دور' }); a.status.set('ready'); };
const member = (over: any = {}) => ({ userId: 'u1', name: 'هيثم القرني', email: 'h@x.com', status: 'ACTIVE', isOwner: false, role: { id: 'r1', name: 'مشرف نزاعات', color: '#A56BE0' }, departments: ['النزاعات'], joinedAt: '2026-01-01T00:00:00Z', lastActiveAt: null, activeNow: false, lastLoginAt: '2026-10-25T09:00:00Z', resolvedDisputes: 3, avgCompletionHours: 2.4, version: 1, openTasks: 2, overdueTasks: 1, doneTasks: 5, ...over });
const list = (m: any) => ({ success: true, data: { members: [m], pendingInvites: [], counts: { total: 1, activeNow: 0, active: 1, suspended: 0, pendingInvites: 0, openTasks: 2, overdueTasks: 1 } } });
const el = (f: any) => f.nativeElement as HTMLElement;

describe('team member page (P-AD-022-موظف): the design\'s blocks, real values, honest gaps', () => {
	let http: HttpTestingController;
	beforeEach(() => { TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'u1' } } } }] }); http = TestBed.inject(HttpTestingController); });

	it('owner: header actions, 4 KPIs, 4 tabs, quick links; presence is «غير متاح» without a live session; unavailable measures say so and show no number', async () => {
		setAccess(true, []);
		const f = TestBed.createComponent(SaTeamMemberDetail); await flush(f);
		http.expectOne(r => r.url === `${B}/staff`).flush(list(member()));
		http.match(r => r.url === `${B}/tasks`).forEach(r => r.flush({ success: true, data: [] }));
		http.expectOne(`${B}/staff/u1/activity`).flush({ success: true, data: [{ id: 'e1', at: '2026-10-25T10:00:00Z', kind: 'STATUS', from: 'NEW', to: 'DONE', taskNumber: 7, taskTitle: 'مراجعة' }] });
		http.expectOne(`${B}/roles`).flush({ success: true, data: [] }); http.expectOne(`${B}/permissions`).flush({ success: true, data: { permissions: [{ id: 'users.view', label: 'عرض المستخدمين', group: 'users', sensitive: false }], groups: { users: 'المستخدمون' }, templates: [], ownerOnly: [], ambiguities: [] } }); await flush(f);
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

	it('a plain member (team.view only): no owner actions, the permissions tab is owner-only, no roles/catalog request, no activity of colleagues', async () => {
		setAccess(false, ['team.view']);
		const f = TestBed.createComponent(SaTeamMemberDetail); await flush(f);
		http.expectOne(r => r.url === `${B}/staff`).flush(list(member({ activeNow: true })));
		http.expectOne(`${B}/staff/u1/activity`).flush({ message: 'x', code: 'ADMIN_PERMISSION_DENIED' }, { status: 403, statusText: 'Forbidden' }); await flush(f);
		http.expectNone(`${B}/roles`); http.expectNone(`${B}/permissions`);
		expect(el(f).querySelector('[data-testid="member-status"]')?.textContent?.trim()).toBe('نشط الآن');
		expect(el(f).querySelector('[data-testid="member-edit-perms"]')).toBeNull(); expect(el(f).querySelector('[data-testid="member-toggle"]')).toBeNull();
		(el(f).querySelector('[data-testid="tab-perms"]') as HTMLButtonElement).click(); await flush(f);
		expect(el(f).querySelector('[data-testid="perms-owner-only"]')).toBeTruthy(); expect(el(f).querySelector('[data-testid="member-role-select"]')).toBeNull();
		(el(f).querySelector('[data-testid="tab-log"]') as HTMLButtonElement).click(); await flush(f);
		expect(el(f).querySelector('[data-testid="log-empty"]')?.textContent).toContain('ليست لديك صلاحية');
	});

	it('the permissions tab of the owner has no per-person exceptions: it shows the role\'s permissions and saves a ROLE (never a permission list)', async () => {
		setAccess(true, []);
		const f = TestBed.createComponent(SaTeamMemberDetail); await flush(f);
		http.expectOne(r => r.url === `${B}/staff`).flush(list(member())); http.match(r => r.url === `${B}/tasks`).forEach(r => r.flush({ success: true, data: [] })); http.expectOne(`${B}/staff/u1/activity`).flush({ success: true, data: [] });
		http.expectOne(`${B}/roles`).flush({ success: true, data: [{ id: 'r1', name: 'مشرف نزاعات', description: null, color: '#fff', permissions: ['users.view'], permissionCount: 1, memberCount: 1, version: 1, updatedAt: '' }, { id: 'r2', name: 'دور آخر', description: null, color: '#fff', permissions: [], permissionCount: 0, memberCount: 0, version: 1, updatedAt: '' }] });
		http.expectOne(`${B}/permissions`).flush({ success: true, data: { permissions: [{ id: 'users.view', label: 'عرض المستخدمين', group: 'users', sensitive: false }, { id: 'users.delete', label: 'حذف الحسابات', group: 'users', sensitive: true }], groups: { users: 'المستخدمون' }, templates: [], ownerOnly: [], ambiguities: [] } }); await flush(f);
		(el(f).querySelector('[data-testid="tab-perms"]') as HTMLButtonElement).click(); await flush(f);
		const on = Array.from(el(f).querySelectorAll('.tm-sw')).map(x => x.classList.contains('on')); expect(on).toEqual([true, false]);
		(f.componentInstance as any).newRoleId.set('r2'); await flush(f);
		(el(f).querySelector('[data-testid="member-role-save"]') as HTMLButtonElement).click();
		const req = http.expectOne(r => r.url === `${B}/staff/u1/role`); expect(req.request.body).toEqual({ roleId: 'r2', expectedVersion: 1 });
	});
});
