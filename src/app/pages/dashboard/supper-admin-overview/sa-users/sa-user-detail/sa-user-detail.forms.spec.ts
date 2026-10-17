import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SaUserDetail } from './sa-user-detail';
import { SaUsersService } from '../sa-users.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

const user: any = {
	id: 'u1', name: 'منى', email: 'm@x.com', accountType: 'CLIENT_INDIVIDUAL', type: 'sk-ind', typeLabel: 'طالب', typeBg: '', typeColor: '', status: 'active', statusOriginal: 'ACTIVE',
	last: 'الآن', projects: 0, av: 'م', avBg: '', createdAt: '2026-01-01', roles: ['CLIENT', 'PROVIDER'], activeRole: 'CLIENT',
	kpis: { reports: 0, disputes: 0, avgRating: null, totalRevenue: '0', completedProjects: 0 }, revenueHistory: [],
	personalInfo: { fullName: 'منى', email: 'm@x.com', registeredAt: '2026-01-01' }, kyc: { client: null, clientOnboarding: null, provider: null, affiliateIdentityVerified: null },
	tabs: { requests: [], purchases: [], disputes: [], reports: [], contracts: [], payments: [] }, audit: [],
};

function setup() {
	const svc: any = {
		getUserDetail: vi.fn(() => of({ success: true, data: user })),
		updateUserStatus: vi.fn(() => of({ success: true })), updateUserRoles: vi.fn(() => of({ success: true })), deleteUser: vi.fn(() => of({ success: true })),
	};
	TestBed.configureTestingModule({ imports: [SaUserDetail], providers: [provideRouter([]), { provide: SaUsersService, useValue: svc },
		{ provide: AuthStore, useValue: { currentUser: signal({ id: 'admin', accountType: 'SUPER_ADMIN' }) } },
		{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'u1' }), queryParamMap: convertToParamMap({}) }, paramMap: of(convertToParamMap({ id: 'u1' })) } }] });
	const f = TestBed.createComponent(SaUserDetail);
	f.detectChanges();
	const el = f.nativeElement as HTMLElement;
	return { f, c: f.componentInstance, svc, el, byId: (id: string) => el.querySelector('#' + id) as HTMLElement };
}

describe('SaUserDetail modals - validation UX', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('suspend without a reason: message under the reason box, focus there, nothing sent; a short reason too', async () => {
		const { f, c, svc, byId } = setup();
		c.openModal('status'); f.detectChanges();
		c.confirmStatus(); await settleForm();
		expectFieldProblem(byId('ud-reason'), 'مطلوب');
		expectFocused(byId('ud-reason'));
		c.reason.set('ab'); f.detectChanges();
		c.confirmStatus(); await settleForm();
		expectFieldProblem(byId('ud-reason'), 'قصير');
		expect(svc.updateUserStatus).not.toHaveBeenCalled();
	});

	it('a 400 naming reason goes under the box; 403 / 409 / 429 / 500 / network stay a generic alert; the reason is kept', async () => {
		const { f, c, svc, el, byId } = setup();
		c.openModal('status'); c.reason.set('مخالفة الشروط'); f.detectChanges();
		svc.updateUserStatus.mockReturnValueOnce(throwError(() => httpFail(400, { errors: [{ field: 'reason', message: 'السبب غير كافٍ' }] })));
		c.confirmStatus(); await settleForm(); f.detectChanges();
		expectFieldProblem(byId('ud-reason'), 'غير كافٍ');
		for (const st of [403, 409, 429, 500, 0]) {
			svc.updateUserStatus.mockReturnValueOnce(throwError(() => httpFail(st, { message: 'x' })));
			c.confirmStatus(); await settleForm(); f.detectChanges();
			expect(c.modalError(), String(st)).toBeTruthy();
			expectNoFieldProblem(el);
			expect(el.querySelector('[data-testid="modal-error"]')?.getAttribute('role')).toBe('alert');
		}
		expect(c.reason()).toBe('مخالفة الشروط');
	});

	it('removing every role: message at the role group, no request; double click on confirm sends one request', async () => {
		const { f, c, svc, byId } = setup();
		c.openModal('roles'); f.detectChanges();
		c.rolePick.set([]); f.detectChanges();
		c.confirmRoles(); await settleForm();
		expectFieldProblem(byId('ud-roles'), 'دور واحد');
		expect(svc.updateUserRoles).not.toHaveBeenCalled();
		c.rolePick.set(['CLIENT']);
		svc.updateUserRoles.mockReturnValue(new Subject());
		c.confirmRoles(); c.confirmRoles();
		expect(svc.updateUserRoles).toHaveBeenCalledTimes(1);
	});

	it('delete: a 403 stays in the dialog as a generic alert; a double click sends one request', async () => {
		const { f, c, svc, el } = setup();
		c.openModal('delete'); f.detectChanges();
		svc.deleteUser.mockReturnValueOnce(throwError(() => httpFail(403, { message: 'ليست لديك صلاحية الحذف' })));
		c.confirmDelete(); await settleForm(); f.detectChanges();
		expect(el.querySelector('[data-testid="modal-error"]')?.textContent).toContain('صلاحية');
		svc.deleteUser.mockReturnValue(new Subject());
		c.confirmDelete(); c.confirmDelete();
		expect(svc.deleteUser).toHaveBeenCalledTimes(2);
	});
});
