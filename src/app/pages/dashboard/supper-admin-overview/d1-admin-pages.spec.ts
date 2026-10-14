import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { signal } from '@angular/core';

import { SupperAdminOverview } from './supper-admin-overview/supper-admin-overview';
import { SaUsers } from './sa-users/sa-users';
import { SaRoles } from './sa-roles/sa-roles';
import { SaCategories } from './sa-categories/sa-categories';
import { SaSuperAdmins } from './sa-super-admins/sa-super-admins';
import { SaNotifyModal } from './sa-notify-modal';
import { AuthStore } from '../../../core/store/auth.store';

const ok = (data: any) => ({ success: true, data });
const emptySummary = { generatedAt: new Date().toISOString(), currency: 'USD', kpis: { users: { total: 0, active: 0, suspended: 0, newThisMonth: 0, newPreviousMonth: 0, growthPercent: null }, projects: { active: 0, completed: 0, openRequests: 0 }, revenue: { platformCommissionTotal: 0, platformCommissionThisMonth: 0, escrowHeld: 0 }, disputes: { open: 0, openOver7Days: 0 }, tickets: { open: 0 }, withdrawals: { pending: 0, pendingAmount: 0 } }, queues: [{ key: 'kyc', label: 'طلبات توثيق الهوية', count: 0, link: '/supper-admin-overview/kyc' }], alerts: [] };

function mount<T>(cmp: new (...a: any[]) => T, get: any, extra: any[] = []) {
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({ imports: [cmp as any], providers: [provideRouter([]), { provide: HttpClient, useValue: { get, patch: vi.fn(), delete: vi.fn() } }, { provide: AuthStore, useValue: { currentUser: signal({ id: 'a', accountType: 'SUPER_ADMIN' }) } }, ...extra] });
	const f = TestBed.createComponent(cmp as any);
	f.detectChanges();
	return f;
}

describe('D1 admin pages read the real endpoints', () => {
	it('dashboard: empty aggregates render zeros, no alerts strip, honest empty states, no fixed fake figures', () => {
		const get = vi.fn((url: string) => of(url.includes('/summary') ? ok(emptySummary) : url.includes('/charts') ? ok({ days: 7, currency: 'USD', registrations: [], registrationsTotal: 0, commission: [], commissionTotal: 0, projectsByStatus: [] }) : ok({ items: [] })));
		const f = mount(SupperAdminOverview, get);
		expect(get.mock.calls.map((c: any[]) => c[0]).some((u: string) => u.includes('/admin/dashboard/summary'))).toBe(true);
		const el: HTMLElement = f.nativeElement;
		expect(el.textContent).not.toContain('12,480');
		expect(el.textContent).not.toContain('99.8%');
		expect(el.textContent).not.toContain('SAMA');
		expect(el.textContent).toContain('لا توجد نشاطات بعد');
		expect(el.querySelector('.alerts-sec')).toBeNull();
	});

	it('dashboard: a load error shows the message with a retry', () => {
		const get = vi.fn(() => throwError(() => ({ error: { message: 'فشل الخادم' } })));
		const f = mount(SupperAdminOverview, get);
		expect((f.nativeElement as HTMLElement).textContent).toContain('فشل الخادم');
	});

	it('users: super admin sees delete; status toggle opens a confirmation that requires a reason', () => {
		const user = { id: 'u1', name: 'م', email: 'a@x', accountType: 'CLIENT_INDIVIDUAL', type: 'sk-ind', typeLabel: 'طالب', typeBg: '', typeColor: '', status: 'active', statusOriginal: 'ACTIVE', last: 'الآن', projects: 0, av: 'م', avBg: '', createdAt: '' };
		const get = vi.fn((url: string) => of(url.endsWith('/stats') ? ok({ totalUsers: { count: 1, growth: '' }, activeThisMonth: { count: 1, ratio: '' }, suspendedCount: { count: 0, pendingReview: 0 }, newThisWeek: { count: 0, growth: '' }, tabCounts: {} }) : { success: true, data: [user], meta: { total: 1, page: 1, limit: 15, totalPages: 1 } }));
		const f = mount(SaUsers, get);
		const c: any = f.componentInstance;
		expect(c.isSuperAdmin()).toBe(true);
		c.toggleStatus(user);
		expect(c.statusTarget()).toBe(user);
		c.confirmStatus();
		expect(c.statusError()).toContain('سبب');
	});

	it('roles: renders the real roles overview and keeps create/edit disabled with the reason', () => {
		const get = vi.fn(() => of(ok({ roles: [{ role: 'CLIENT', label: 'طالب خدمة', description: 'د', members: 3 }], accountTypes: [{ accountType: 'ADMIN', count: 1 }], suspendedAccounts: 0, adminCapabilities: [{ key: 'user-delete', label: 'حذف', admin: false, superAdmin: true }] })));
		const f = mount(SaRoles, get);
		const el: HTMLElement = f.nativeElement;
		expect(el.textContent).toContain('3 عضو');
		expect(el.textContent).toContain('الأدوار ثابتة في النظام');
		expect(el.querySelector('.rl-btn-primary')?.hasAttribute('disabled')).toBe(true);
	});

	it('provider levels: real ladder and empty top list', () => {
		const levels = Array.from({ length: 15 }, (_, i) => ({ level: i + 1, name: `L${i + 1}`, commissionPercent: 12, color: '#fff', thresholds: { points: 0, projects: 0, rating: 0 }, providers: i === 1 ? 3 : 0 }));
		const get = vi.fn(() => of(ok({ levels, totalProviders: 3, providersWithoutLevelRow: 0, topProviders: [] })));
		const f = mount(SaCategories, get);
		expect((f.nativeElement as HTMLElement).textContent).toContain('لا يوجد مقدمو خدمة بسجل نقاط بعد');
		expect((f.nativeElement as HTMLElement).textContent).not.toContain('824');
	});

	it('super-admins page: settings are read-only (no save), audit reads real events', () => {
		const get = vi.fn(() => of(ok({ events: [{ id: 'e1', category: 'SECURITY_CHANGE', eventType: 'X', title: 'حدث حقيقي', summary: 's', severity: 'INFO', source: 'ADMIN', status: 'COMPLETED', occurredAt: new Date().toISOString(), ipAddress: null, device: null, actorLabel: null }], kpis: {} })));
		const f = mount(SaSuperAdmins, get);
		const el: HTMLElement = f.nativeElement;
		expect(el.textContent).not.toContain('smtp.sendgrid.net');
		expect(el.textContent).not.toContain('حفظ التغييرات');
		(f.componentInstance as any).setSection('audit');
		f.detectChanges();
		expect(el.textContent).toContain('حدث حقيقي');
		expect(el.textContent).not.toContain('4812');
	});

	it('notify modal: needs 5+ chars, posts to /admin/users/:id/notify with the request context, shows the BE error', () => {
		const post = vi.fn().mockReturnValueOnce(throwError(() => ({ error: { message: 'هذا الطلب لا يخص المستخدم المحدد' } }))).mockReturnValueOnce(of({ success: true }));
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ imports: [SaNotifyModal], providers: [{ provide: HttpClient, useValue: { post } }] });
		const f = TestBed.createComponent(SaNotifyModal);
		f.componentInstance.userId = 'u1';
		f.componentInstance.context = { type: 'REQUEST', id: 'r1' };
		const sent = vi.fn();
		f.componentInstance.sent.subscribe(sent);
		f.detectChanges();
		f.componentInstance.message.set('abc');
		f.componentInstance.send();
		expect(post).not.toHaveBeenCalled();
		f.componentInstance.message.set('رسالة للمالك');
		f.componentInstance.send();
		expect(post.mock.calls[0][0]).toContain('/admin/users/u1/notify');
		expect(post.mock.calls[0][1]).toEqual({ message: 'رسالة للمالك', context: { type: 'REQUEST', id: 'r1' } });
		expect(f.componentInstance.error()).toContain('لا يخص');
		f.componentInstance.send();
		expect(sent).toHaveBeenCalled();
	});
});
