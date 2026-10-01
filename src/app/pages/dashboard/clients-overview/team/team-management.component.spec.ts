import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { TeamManagementComponent } from './team-management.component';
import { ClientCompanyTeamService } from '../../../../core/services/client-company-team.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { ClientCompanyTeamMember } from '../../../../core/models/client-company-team.model';

// Batch 6 — this page used to render 4 fully hardcoded arrays (employees,
// roles, groups, tasks), none backed by any service call. The Employees tab
// now calls the real client-company-team.service.ts; Roles/Groups/Tasks have
// no backend model at all (SCHEMA GAP — confirmed by full Prisma schema
// search) and show an honest "not available" state instead of mock rows.

function makeMember(overrides: Partial<ClientCompanyTeamMember> = {}): ClientCompanyTeamMember {
	return {
		id: 'm1', name: 'سارة القحطاني', email: 'sara@client.sa', phone: null,
		jobTitle: 'مديرة المشتريات', status: 'ACTIVE', avatarUrl: null,
		createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
		...overrides,
	};
}

function setup(opts: { isCompany?: boolean; listImpl?: () => any; teamServiceOverrides?: Partial<ClientCompanyTeamService> } = {}) {
	const isCompany = opts.isCompany ?? true;
	const listImpl = opts.listImpl ?? (() => of({ success: true, data: [] }));

	const fakeTeamService: Partial<ClientCompanyTeamService> = {
		list: listImpl as any,
		create: (() => of({ success: true, data: makeMember() })) as any,
		update: (() => of({ success: true, data: makeMember({ status: 'INACTIVE' }) })) as any,
		remove: (() => of({ success: true, data: { id: 'm1', deleted: true } })) as any,
		...opts.teamServiceOverrides,
	};

	const fakeAuthStore: Partial<AuthStore> = {
		currentUser: (() => (isCompany ? { accountType: AccountType.CLIENT_COMPANY } : { accountType: AccountType.CLIENT_INDIVIDUAL })) as any,
	};

	TestBed.configureTestingModule({
		imports: [TeamManagementComponent],
		providers: [
			provideRouter([]),
			{ provide: ClientCompanyTeamService, useValue: fakeTeamService },
			{ provide: AuthStore, useValue: fakeAuthStore },
		],
	});
	const fixture: ComponentFixture<TeamManagementComponent> = TestBed.createComponent(TeamManagementComponent);
	return { fixture, component: fixture.componentInstance };
}

describe('TeamManagementComponent — real employee data (Batch 6)', () => {
	it('1) renders real employee data from the API, never the old mock names', () => {
		const { fixture } = setup({ listImpl: () => of({ success: true, data: [makeMember({ name: 'موظف حقيقي من الـ API' })] }) });
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('موظف حقيقي من الـ API');
		// The old hardcoded mock names must never appear again.
		expect(text).not.toContain('أحمد العتيبي');
		expect(text).not.toContain('نورة الحربي');
	});

	it('2) the old mock stats (14 active tasks, 3 work groups) are gone — only real, derived employee counts remain', () => {
		const { fixture } = setup({ listImpl: () => of({ success: true, data: [makeMember({ status: 'ACTIVE' }), makeMember({ id: 'm2', status: 'PENDING' })] }) });
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('مجموعات عمل');
		expect(text).not.toContain('مهام نشطة');
		expect(text).toContain('إجمالي الموظفين');
	});

	it('3) shows a loading state before the API responds', () => {
		const { fixture, component } = setup();
		expect(component.isLoading()).toBe(true);
	});

	it('4) shows an honest empty state when the company has zero real employees', () => {
		const { fixture } = setup({ listImpl: () => of({ success: true, data: [] }) });
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('لا يوجد موظفون بعد');
	});

	it('5) shows a real error state (not a silent blank page) when the API call fails', () => {
		const { fixture } = setup({ listImpl: () => throwError(() => new Error('network down')) });
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('تعذر تحميل بيانات الموظفين');
	});

	it('6) the "دعوة موظف" action calls the real create API — never a fake-success toast without a request', () => {
		let createCalled = false;
		const { fixture, component } = setup({
			teamServiceOverrides: { create: ((payload: any) => { createCalled = true; return of({ success: true, data: makeMember({ ...payload, id: 'new-1' }) }); }) as any },
		});
		fixture.detectChanges();
		component.openInviteForm();
		component.inviteName = 'موظف جديد';
		component.inviteEmail = 'new@client.sa';
		component.inviteJobTitle = 'مطور';
		component.submitInvite();
		expect(createCalled).toBe(true);
	});

	it('7) a failed create does not show a fake-success state — the invite form stays open with a real error', () => {
		const { component } = setup({
			teamServiceOverrides: { create: (() => throwError(() => ({ error: { message: 'فشل الإرسال' } }))) as any },
		});
		component.openInviteForm();
		component.inviteName = 'موظف';
		component.inviteEmail = 'e@x.sa';
		component.inviteJobTitle = 'منصب';
		component.submitInvite();
		expect(component.showInviteForm()).toBe(true);
		expect(component.inviteError()).toBe('فشل الإرسال');
	});

	it('8) toggleStatus calls the real update API with the opposite status', () => {
		let updateArgs: any;
		const { component } = setup({
			teamServiceOverrides: { update: ((id: string, payload: any) => { updateArgs = { id, payload }; return of({ success: true, data: makeMember({ status: 'INACTIVE' }) }); }) as any },
		});
		component.toggleStatus(makeMember({ id: 'm1', status: 'ACTIVE' }));
		expect(updateArgs.id).toBe('m1');
		expect(updateArgs.payload.status).toBe('INACTIVE');
	});

	it('9) a failed status toggle does not optimistically flip the UI — the employee list is left unchanged', () => {
		const { component } = setup({
			listImpl: () => of({ success: true, data: [makeMember({ id: 'm1', status: 'ACTIVE' })] }),
			teamServiceOverrides: { update: (() => throwError(() => new Error('failed'))) as any },
		});
		component.fetchEmployees();
		component.toggleStatus(makeMember({ id: 'm1', status: 'ACTIVE' }));
		expect(component.employees()[0].status).toBe('ACTIVE');
	});

	it('10) a CLIENT_INDIVIDUAL account never sees the company-only UI or triggers a list() call', () => {
		let listCalled = false;
		const { fixture } = setup({ isCompany: false, listImpl: () => { listCalled = true; return of({ success: true, data: [] }); } });
		fixture.detectChanges();
		expect(listCalled).toBe(false);
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('متاحة لحسابات الشركات فقط');
	});

	it('11) Roles/Groups/Tasks tabs and all their content are fully removed for launch — not hidden behind a tab, not a "not available" placeholder either', () => {
		const { fixture, component } = setup({ listImpl: () => of({ success: true, data: [makeMember()] }) });
		fixture.detectChanges();
		const html = (fixture.nativeElement as HTMLElement).innerHTML;
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		// No tab bar / tab-switching concept survives at all.
		expect((component as any).switchTab).toBeUndefined();
		expect((component as any).activeTab).toBeUndefined();
		expect(html).not.toContain('tm-tabs');
		expect(text).not.toContain('الأدوار والصلاحيات');
		expect(text).not.toContain('المجموعات');
		expect(text).not.toContain('المهام والتكليفات');
		// Old mock content from each removed section.
		expect(text).not.toContain('مالك الشركة');
		expect(text).not.toContain('فريق التطوير');
		expect(text).not.toContain('مراجعة طلب رقم REQ-2026-042');
		// And it was not replaced with a generic "coming soon"/"not available" placeholder either.
		expect(text).not.toContain('غير متاحة حالياً');
	});

	it('12) refreshing (re-calling fetchEmployees) re-reads from the backend rather than trusting stale local state', () => {
		let callCount = 0;
		const { component } = setup({
			listImpl: () => { callCount++; return of({ success: true, data: [makeMember({ name: `نداء ${callCount}` })] }); },
		});
		component.fetchEmployees();
		expect(component.employees()[0].name).toBe('نداء 1');
		component.fetchEmployees();
		expect(component.employees()[0].name).toBe('نداء 2');
		expect(callCount).toBe(2);
	});
});
