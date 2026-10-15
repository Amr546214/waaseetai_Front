import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SaUsers } from './sa-users';
import { SaUsersService } from './sa-users.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../shared/forms/form-spec-utils';

const user: any = { id: 'u1', name: 'م', email: 'a@x', accountType: 'CLIENT_INDIVIDUAL', type: 'sk-ind', typeLabel: 'طالب', typeBg: '', typeColor: '', status: 'active', statusOriginal: 'ACTIVE', last: 'الآن', projects: 0, av: 'م', avBg: '', createdAt: '' };

function setup() {
	const svc: any = {
		getUsers: vi.fn(() => of({ success: true, data: [user], meta: { total: 1, page: 1, limit: 15, totalPages: 1 } })),
		getStats: vi.fn(() => of({ success: true, data: { totalUsers: { count: 1, growth: '' }, activeThisMonth: { count: 1, ratio: '' }, suspendedCount: { count: 0, pendingReview: 0 }, newThisWeek: { count: 0, growth: '' }, tabCounts: {} } })),
		getUsersStats: vi.fn(() => of({ success: true, data: { totalUsers: { count: 1, growth: '' }, activeThisMonth: { count: 1, ratio: '' }, suspendedCount: { count: 0, pendingReview: 0 }, newThisWeek: { count: 0, growth: '' }, tabCounts: {} } })),
		updateUserStatus: vi.fn(() => of({ success: true })), deleteUser: vi.fn(() => of({ success: true })),
	};
	TestBed.configureTestingModule({ imports: [SaUsers], providers: [provideRouter([]), { provide: SaUsersService, useValue: svc }, { provide: AuthStore, useValue: { currentUser: signal({ id: 'a', accountType: 'SUPER_ADMIN' }) } }] });
	const f = TestBed.createComponent(SaUsers);
	f.detectChanges();
	return { f, c: f.componentInstance as any, svc, el: f.nativeElement as HTMLElement };
}

describe('SaUsers dialogs - validation UX', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('suspend: empty / short reason is explained under the box with focus; the confirm button is never silently disabled', async () => {
		const { f, c, svc, el } = setup();
		c.toggleStatus(user); f.detectChanges();
		const btn = el.querySelector('.modal-actions .modal-btn-delete') as HTMLButtonElement;
		expect(btn.disabled).toBe(false);
		btn.click(); await settleForm();
		const ta = el.querySelector('#status-reason');
		expectFieldProblem(ta, 'مطلوب');
		expectFocused(ta);
		expect(svc.updateUserStatus).not.toHaveBeenCalled();
	});

	it('suspend: 400 on reason under the box; 403 / 429 / 500 generic alert; one request on double click', async () => {
		const { f, c, svc, el } = setup();
		c.toggleStatus(user); c.statusReason.set('مخالفة'); f.detectChanges();
		svc.updateUserStatus.mockReturnValueOnce(throwError(() => httpFail(400, { errors: [{ field: 'reason', message: 'السبب غير مقبول' }] })));
		c.confirmStatus(); await settleForm(); f.detectChanges();
		expectFieldProblem(el.querySelector('#status-reason'), 'غير مقبول');
		for (const st of [403, 429, 500, 0]) {
			svc.updateUserStatus.mockReturnValueOnce(throwError(() => httpFail(st, { message: 'x' })));
			c.confirmStatus(); await settleForm(); f.detectChanges();
			expect(c.statusError(), String(st)).toBeTruthy();
			expectNoFieldProblem(el);
		}
		svc.updateUserStatus.mockClear();
		svc.updateUserStatus.mockReturnValue(new Subject());
		c.confirmStatus(); c.confirmStatus();
		expect(svc.updateUserStatus).toHaveBeenCalledTimes(1);
		expect(c.statusReason()).toBe('مخالفة');
	});

	it('delete: failure keeps the dialog open with an alert; a double click sends one request', async () => {
		const { f, c, svc, el } = setup();
		c.openDeleteModal(user); f.detectChanges();
		svc.deleteUser.mockReturnValueOnce(throwError(() => httpFail(409, { message: 'لا يمكن حذف حساب لديه مشاريع نشطة' })));
		c.confirmDelete(); await settleForm(); f.detectChanges();
		expect(c.isDeleteModalOpen()).toBe(true);
		expect(el.querySelector('[data-testid="delete-error"]')?.getAttribute('role')).toBe('alert');
		expect(el.querySelector('[data-testid="delete-error"]')?.textContent).toContain('مشاريع نشطة');
		svc.deleteUser.mockClear();
		svc.deleteUser.mockReturnValue(new Subject());
		c.confirmDelete(); c.confirmDelete();
		expect(svc.deleteUser).toHaveBeenCalledTimes(1);
	});
});
