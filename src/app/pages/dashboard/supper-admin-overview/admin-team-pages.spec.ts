import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { AdminAccessService } from '../../../core/services/admin-access.service';
import { SaTeam } from './sa-team/sa-team';
import { SaRoles } from './sa-roles/sa-roles';
import { SaTasks } from './sa-tasks/sa-tasks';
import { SaTeamPerformance } from './sa-team-performance/sa-team-performance';
import { SaNoAccess } from './sa-no-access/sa-no-access';

const B = `${environment.url_api}/admin/team`;
const flush = async (f: any) => { f.detectChanges(); await f.whenStable(); f.detectChanges(); };
const setAccess = (isSuperAdmin: boolean, permissions: string[]) => {
	const a = TestBed.inject(AdminAccessService);
	a.access.set({ userId: 'me', isSuperAdmin, staffStatus: 'ACTIVE', roleName: isSuperAdmin ? 'المالك' : 'دور', permissions, hasAnyPermission: true, state: isSuperAdmin ? 'SUPER_ADMIN' : 'ACTIVE', displayRole: isSuperAdmin ? 'Super Admin' : 'دور' }); a.status.set('ready');
};
const staffList = (over: any = {}) => ({ success: true, data: { members: [{ userId: 'u1', name: 'هيثم القرني', email: 'h@x.com', status: 'ACTIVE', isSuperAdmin: false, role: { id: 'r1', name: 'مشرف نزاعات', color: '#A56BE0' }, joinedAt: '2026-01-01T00:00:00Z', lastActiveAt: '2026-10-25T10:00:00Z', activeNow: true, lastLoginAt: '2026-10-25T09:00:00Z', resolvedDisputes: 3, avgCompletionHours: 2.4, departments: ['النزاعات'], version: 1, openTasks: 9, overdueTasks: 2, doneTasks: 4 }], pendingInvites: [{ id: 'i1', email: 'p@x.com', fullName: 'مدعو', roleName: 'مشرف دعم', expiresAt: '2026-12-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', resendCount: 0 }], counts: { total: 1, activeNow: 1, active: 1, suspended: 0, pendingInvites: 1, openTasks: 9, overdueTasks: 2 }, ...over } });

describe('admin team pages (real data, honest states, SUPER_ADMIN-only actions)', () => {
	let http: HttpTestingController;
	beforeEach(() => { TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); });

	it('team page: real members and counts, no sample names, «active now» comes from the server (never invented), the SUPER_ADMIN-only buttons are absent for a plain member', async () => {
		setAccess(false, ['team.view']);
		const f = TestBed.createComponent(SaTeam); await flush(f);
		http.expectOne(r => r.url === `${B}/staff`).flush(staffList()); await flush(f);
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelectorAll('[data-testid="team-member"]').length).toBe(1); expect(el.textContent).toContain('هيثم القرني');
		expect(el.querySelector('[data-testid="kpi-total"]')?.textContent?.trim()).toBe('1');
		expect(el.querySelector('[data-testid="kpi-active-now"]')?.textContent?.trim()).toBe('1'); expect(el.querySelector('[data-testid="member-presence"]')?.textContent?.trim()).toBe('نشط الآن'); expect(el.textContent).toContain('النزاعات');
		expect(el.textContent).toContain('لا تتوفر بيانات');
		expect(el.querySelector('[data-testid="team-invite-open"]')).toBeNull(); expect(el.querySelector('[data-testid="team-roles-link"]')).toBeNull();
		http.expectNone(`${B}/roles`);
	});
	it('team page for a SUPER_ADMIN: invite button, pending invites with resend / cancel, the unplaced-accounts panel', async () => {
		setAccess(true, []);
		const f = TestBed.createComponent(SaTeam); await flush(f);
		http.expectOne(r => r.url === `${B}/staff`).flush(staffList()); http.expectOne(`${B}/roles`).flush({ success: true, data: [{ id: 'r1', name: 'مشرف نزاعات', description: null, color: '#fff', permissions: [], permissionCount: 0, memberCount: 1, version: 1, updatedAt: '' }] });
		http.expectOne(`${B}/staff/unplaced`).flush({ success: true, data: [{ userId: 'u9', name: 'إداري قديم', email: 'o@x.com', accountType: 'ADMIN', status: 'ACTIVE', lastActiveAt: null }] }); await flush(f);
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="team-invite-open"]')).toBeTruthy(); expect(el.querySelector('[data-testid="unplaced-panel"]')?.textContent).toContain('لا تملك أي صلاحية');
		(el.querySelector('[data-testid="tab-pending"]') as HTMLButtonElement).click(); http.expectOne(r => r.url === `${B}/staff`).flush(staffList()); await flush(f);
		expect(el.querySelectorAll('[data-testid="pending-invite"]').length).toBe(1); expect(el.textContent).toContain('إعادة الإرسال');
	});
	it('roles page: the matrix and counts are the server\'s; sensitive grants need an explicit confirmation; a stale save shows the conflict with a reload', async () => {
		setAccess(true, []);
		const f = TestBed.createComponent(SaRoles); await flush(f);
		http.expectOne(`${B}/permissions`).flush({ success: true, data: { permissions: [{ id: 'users.view', label: 'عرض المستخدمين', group: 'users', sensitive: false }, { id: 'users.delete', label: 'حذف الحسابات', group: 'users', sensitive: true }], groups: { users: 'المستخدمون' }, templates: [{ key: 't', name: 'قالب', description: 'د', color: '#fff', permissions: ['users.view'], notes: 'ملاحظة' }], superAdminOnly: [], superAdminCount: 1, ambiguities: ['نقطة غامضة'] } });
		http.expectOne(`${B}/roles`).flush({ success: true, data: [{ id: 'r1', name: 'مشرف', description: 'وصف', color: '#2BD4C7', permissions: ['users.view'], permissionCount: 1, memberCount: 3, version: 4, updatedAt: '' }] });
		http.expectOne(r => r.url === `${B}/access-audit`).flush({ success: true, data: [] }); await flush(f);
		const el = f.nativeElement as HTMLElement;
		const sa = el.querySelector('[data-testid="role-card-super-admin"]')!; expect(sa.textContent).toContain('Super Admin'); expect(sa.textContent).toContain('تحكم كامل'); expect(sa.textContent).toContain('2 صلاحية'); expect(sa.textContent).toContain('1 أعضاء'); expect(sa.querySelector('button')).toBeNull(); // read-only: an account type, not a role
		expect(el.querySelectorAll('[data-testid="role-card"]').length).toBe(1); expect(el.textContent).toContain('1 صلاحية'); expect(el.textContent).toContain('3 أعضاء'); expect(el.textContent).toContain('نقطة غامضة');
		expect(el.querySelectorAll('[data-testid="roles-matrix"] tbody tr').length).toBe(2);
		(el.querySelector('[data-testid="role-edit"]') as HTMLButtonElement).click(); await flush(f);
		(el.querySelector('[data-testid="perm-users.delete"]') as HTMLInputElement).click(); await flush(f);
		(el.querySelector('[data-testid="role-save"]') as HTMLButtonElement).click();
		const r1 = http.expectOne(`${B}/roles/r1`); expect(r1.request.body.expectedVersion).toBe(4); expect(r1.request.body.confirmSensitive).toBe(false);
		r1.flush({ code: 'SENSITIVE_CONFIRMATION_REQUIRED', message: 'x', errors: [{ addedSensitive: ['users.delete'] }] }, { status: 409, statusText: 'Conflict' }); await flush(f);
		expect(el.querySelector('[data-testid="sensitive-confirm"]')?.textContent).toContain('حذف الحسابات');
		(el.querySelector('[data-testid="confirm-sensitive"]') as HTMLButtonElement).click();
		const r2 = http.expectOne(`${B}/roles/r1`); expect(r2.request.body.confirmSensitive).toBe(true);
		r2.flush({ code: 'ROLE_VERSION_CONFLICT', message: 'عُدّل هذا الدور من جهة أخرى' }, { status: 409, statusText: 'Conflict' }); await flush(f);
		expect(el.querySelector('[data-testid="role-error"]')?.textContent).toContain('عُدّل هذا الدور من جهة أخرى'); expect(el.querySelector('[data-testid="role-reload"]')).toBeTruthy();
	});
	it('tasks page: a member sees their scope without the create button; the manager can create; server refusals are shown, never swallowed', async () => {
		setAccess(false, ['support.review']);
		const f = TestBed.createComponent(SaTasks); await flush(f);
		http.expectOne(`${B}/tasks/summary`).flush({ success: true, data: { byStatus: {}, open: 2, inProgress: 1, pending: 1, overdue: 1, doneThisMonth: 0, onTimeThisMonth: null, avgCompletionHoursThisMonth: null } });
		http.expectOne(r => r.url === `${B}/tasks`).flush({ success: true, data: [{ id: 't1', number: 7, code: 'T-0007', title: 'مراجعة تذكرة', description: null, type: 'SUPPORT', priority: 'HIGH', status: 'IN_PROGRESS', overdue: true, dueAt: '2026-10-01T00:00:00Z', completedAt: null, version: 1, createdAt: '', assignee: { id: 'me', name: 'أنا' }, link: null }] }); await flush(f);
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="task-new"]')).toBeNull(); expect(el.textContent).toContain('مهامك المكلَّف بها'); expect(el.querySelectorAll('[data-testid="task-row"]').length).toBe(1);
		expect(el.textContent).toContain('هدف SLA غير معتمد بعد'); expect(el.textContent).toContain('لا مواعيد محددة لقياس الالتزام');
	});
	it('tasks page for a manager: the create dialog sends only the chosen fields and shows the server\'s reason when the assignee lacks the permission', async () => {
		setAccess(false, ['tasks.manage', 'team.view']);
		const f = TestBed.createComponent(SaTasks); await flush(f);
		http.expectOne(`${B}/tasks/summary`).flush({ success: true, data: { byStatus: {}, open: 0, inProgress: 0, pending: 0, overdue: 0, doneThisMonth: 0, onTimeThisMonth: null, avgCompletionHoursThisMonth: null } });
		http.expectOne(r => r.url === `${B}/tasks`).flush({ success: true, data: [] }); http.expectOne(r => r.url === `${B}/staff`).flush(staffList()); await flush(f);
		const el = f.nativeElement as HTMLElement;
		(el.querySelector('[data-testid="task-new"]') as HTMLButtonElement).click(); await flush(f);
		const c = f.componentInstance as any; c.form.title = 'مهمة دعم'; c.form.assigneeId = 'u1'; c.create();
		const req = http.expectOne(`${B}/tasks`); expect(req.request.method).toBe('POST'); expect(Object.keys(req.request.body).sort()).toEqual(['assigneeId', 'priority', 'title', 'type']);
		req.flush({ message: 'x', errors: [{ field: 'assigneeId', message: 'الموظف المكلَّف لا يملك الصلاحية اللازمة' }] }, { status: 400, statusText: 'Bad' }); await flush(f);
		expect(el.querySelector('[data-testid="create-error"]')?.textContent).toContain('لا يملك الصلاحية اللازمة');
	});
	it('performance page: unavailable measures show «—» with the decision needed (never 0 % or a sample); export is disabled without performance.export', async () => {
		setAccess(false, ['performance.view']);
		const f = TestBed.createComponent(SaTeamPerformance); await flush(f);
		http.expectOne(r => r.url === `${B}/performance`).flush({ success: true, data: { period: 'month', from: '', to: '', team: { members: 1, completed: 0, avgCompletionHours: null, onTimeRate: null, onTimeOf: 0 }, members: [{ userId: 'u1', name: 'هيثم', role: 'مشرف', roleColor: null, status: 'ACTIVE', openTasks: 0, completed: 0, avgCompletionHours: null, onTimeRate: null, onTimeOf: 0, slaRate: null, userRating: null, overallScore: null }], trend: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, thisYear: 0, lastYear: 0 })), definitions: { completed: 'تعريف', completionTime: 'تعريف', onTime: 'تعريف', unavailable: [], decisionsNeeded: ['هدف SLA بالساعات'] } } }); await flush(f);
		const el = f.nativeElement as HTMLElement; const txt = el.textContent ?? '';
		expect(el.querySelector('[data-testid="kpi-ontime"]')?.textContent?.trim()).toBe('—'); expect(txt).not.toMatch(/\b0%/); expect(txt).not.toContain('90%'); expect(txt).not.toContain('87%');
		expect(el.querySelector('[data-testid="trend-empty"]')).toBeTruthy(); expect(el.querySelector('[data-testid="perf-export"]')).toBeNull(); expect(el.querySelector('[data-testid="perf-export-disabled"]')).toBeTruthy();
		expect(el.querySelector('[data-testid="definitions"]')?.textContent).toContain('هدف SLA بالساعات');
	});
	it('no-access page: a clear reason for each state, retry only when the state could not be read', async () => {
		for (const [reason, text, retry] of [['NOT_IN_TEAM', 'ليس ضمن فريق الإدارة', false], ['NO_PERMISSIONS', 'لم تُمنح أي صلاحية', false], ['SUSPENDED', 'تم إيقاف وصولك', false], ['denied', 'ليست لديك صلاحية لهذه الصفحة', false], ['unavailable', 'تعذّر التحقق من صلاحياتك', true]] as const) {
			TestBed.resetTestingModule();
			TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: (await import('@angular/router')).ActivatedRoute, useValue: { queryParamMap: (await import('rxjs')).of({ get: () => reason }) } }] });
			const f = TestBed.createComponent(SaNoAccess); await flush(f); const el = f.nativeElement as HTMLElement;
			expect(el.textContent).toContain(text); expect(!!el.querySelector('[data-testid="no-access-retry"]')).toBe(retry); expect(el.querySelector('[data-testid="no-access-account"]')).toBeTruthy();
		}
	});

	it('performance page: «تصدير PDF» is in the design\'s place (print / save-as-PDF of what the page shows), CSV is an addition, both need performance.export; the design\'s 7 columns', async () => {
		const report = { success: true, data: { period: 'month', from: '', to: '', team: { members: 1, completed: 4, avgCompletionHours: 5, onTimeRate: 50, onTimeOf: 2 }, members: [{ userId: 'u1', name: 'هيثم', role: 'مشرف', roleColor: null, status: 'ACTIVE', openTasks: 1, completed: 4, avgCompletionHours: 5, onTimeRate: 50, onTimeOf: 2, slaRate: null, userRating: null, overallScore: null }], trend: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, thisYear: 0, lastYear: 0 })), definitions: { completed: 'ت', completionTime: 'ت', onTime: 'ت', decisionsNeeded: ['قرار'] } } };
		setAccess(false, ['performance.view', 'performance.export']);
		const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
		const f = TestBed.createComponent(SaTeamPerformance); await flush(f);
		http.expectOne(r => r.url === `${B}/performance`).flush(report); await flush(f);
		const el = f.nativeElement as HTMLElement;
		expect(Array.from(el.querySelectorAll('[data-testid="perf-table"] th')).map(x => x.textContent?.trim())).toEqual(['الموظف', 'الدور', 'مهام منجزة', 'الالتزام بـ SLA', 'تقييم المستخدمين', 'الدرجة الكلية', 'الملف']);
		expect(el.querySelector('[data-testid="kpi-sla"]')?.textContent?.trim()).toBe('—'); expect(el.querySelector('[data-testid="kpi-ontime"]')?.textContent?.trim()).toBe('50%');
		expect(el.querySelector('[data-testid="benchmark"]')?.textContent).toContain('لا يوجد معيار معتمد'); expect(el.textContent).not.toMatch(/\b(80|4h|7 يوم|4\.2)/);
		(el.querySelector('[data-testid="perf-export-pdf"]') as HTMLButtonElement).click(); expect(print).toHaveBeenCalledTimes(1);
		expect(el.querySelector('[data-testid="perf-export"]')?.textContent).toContain('CSV');
		print.mockRestore();
	});
	it('invite dialog: «الأقسام المتاحة» is a REAL scope - selectable sections are sent with the invitation (none selected = no scope), sections the role does not cover are marked; the button is the design\'s «إرسال الدعوة»', async () => {
		setAccess(true, []);
		const f = TestBed.createComponent(SaTeam); await flush(f);
		http.expectOne(r => r.url === `${B}/staff`).flush(staffList());
		http.expectOne(`${B}/roles`).flush({ success: true, data: [{ id: 'r1', name: 'مشرف نزاعات', description: null, color: '#fff', permissions: ['disputes.view', 'users.view'], permissionCount: 2, memberCount: 1, version: 1, updatedAt: '' }, { id: 'r2', name: 'مشرف دعم', description: null, color: '#fff', permissions: ['support.review'], permissionCount: 1, memberCount: 0, version: 1, updatedAt: '' }] });
		http.expectOne(`${B}/staff/unplaced`).flush({ success: true, data: [] }); await flush(f);
		const el = f.nativeElement as HTMLElement; (el.querySelector('[data-testid="team-invite-open"]') as HTMLButtonElement).click(); await flush(f);
		const rows = () => Array.from(el.querySelectorAll('[data-testid="invite-sections"] .tm-sections-row')) as HTMLElement[];
		expect(rows().map(r => r.textContent?.replace('✓', '').trim())).toEqual(['المستخدمون', 'النزاعات', 'البلاغات', 'الدعم الفني', 'التخصصات'].map((n, i) => (i >= 2 ? `${n}الدور لا يشمله` : n)));
		expect(el.querySelector('[data-testid="invite-send"]')?.textContent).toContain('إرسال الدعوة');
		(el.querySelector('input[name="email"]') as HTMLInputElement).value = 'n@x.com'; (el.querySelector('input[name="email"]') as HTMLInputElement).dispatchEvent(new Event('input'));
		(f.componentInstance as any).invite.fullName = 'اسم كامل';
		// no section chosen: the request carries no `departments` at all
		(el.querySelector('[data-testid="invite-send"]') as HTMLButtonElement).click();
		let req = http.expectOne(`${B}/invites`); expect(req.request.body.departments).toBeUndefined(); expect(req.request.body.roleId).toBe('r1');
		req.flush({ success: false, errors: [{ message: 'x' }] }, { status: 400, statusText: 'Bad' }); await flush(f);
		// choosing sections: they are sent (and are the only thing the form adds; a department grants nothing here)
		(el.querySelector('[data-testid="dept-disputes"]') as HTMLButtonElement).click(); await flush(f);
		expect(el.querySelector('[data-testid="dept-disputes"]')?.getAttribute('aria-checked')).toBe('true');
		(el.querySelector('[data-testid="invite-send"]') as HTMLButtonElement).click();
		req = http.expectOne(`${B}/invites`); expect(req.request.body.departments).toEqual(['disputes']); expect(Object.keys(req.request.body).sort()).toEqual(['departments', 'email', 'fullName', 'roleId']);
		req.flush({ success: true, data: { id: 'i', email: 'n@x.com', expiresAt: '', emailed: false, link: 'https://x/admin-invite#abc' } }); await flush(f);
		expect((el.querySelector('[data-testid="invite-link"]') as HTMLInputElement).value).toContain('#abc');
	});
});
