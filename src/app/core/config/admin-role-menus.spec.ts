import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { AdminAccessService } from '../services/admin-access.service';
import { ruleForPath } from './admin-access-rules';

// The pages each job role of the design can open (menu AND direct link use the same rule). Permission sets are the design columns (P-AD-024); the expectation is written by hand.
const ROLES: Record<string, string[]> = {
	'مدير فريق': ['users.view', 'users.suspend', 'disputes.view', 'disputes.resolve', 'reports.view', 'support.review', 'specialties.approve', 'packages.manage', 'withdrawals.review', 'withdrawals.approve', 'finance.read', 'team.view', 'tasks.manage'],
	'مشرف نزاعات': ['users.view', 'users.suspend', 'disputes.view', 'disputes.resolve', 'reports.view'],
	'مشرف دعم': ['users.view', 'reports.view', 'support.review', 'support.reply'],
	'مشرف محتوى': ['specialties.approve'],
	'مشرف مالي': ['withdrawals.review', 'withdrawals.approve', 'finance.read'],
};
const PAGES = ['users', 'brokers', 'disputes', 'reports', 'support', 'accreditations', 'withdrawals', 'revenues', 'finance-reports', 'fees', 'subscriptions/plans', 'team', 'tasks', 'team-performance', 'roles', 'super-admins', 'system-settings', 'audit', 'it/servers', 'communication/broadcast', 'ai/dashboard', 'projects', 'specialties', 'kyc', 'marketing-assets'];
const EXPECT: Record<string, string[]> = {
	'مدير فريق': ['users', 'brokers', 'disputes', 'reports', 'support', 'accreditations', 'withdrawals', 'revenues', 'finance-reports', 'fees', 'subscriptions/plans', 'team', 'tasks'],
	'مشرف نزاعات': ['users', 'brokers', 'disputes', 'reports', 'tasks'],
	'مشرف دعم': ['users', 'brokers', 'reports', 'support', 'tasks'],
	'مشرف محتوى': ['accreditations', 'tasks'],
	'مشرف مالي': ['withdrawals', 'revenues', 'finance-reports', 'fees', 'tasks'],
};
const open = (perms: string[], superAdmin = false) => {
	TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
	const a = TestBed.inject(AdminAccessService);
	a.access.set({ userId: 'u', isSuperAdmin: superAdmin, staffStatus: 'ACTIVE', roleName: 'r', permissions: superAdmin ? [] : perms, hasAnyPermission: true, state: superAdmin ? 'SUPER_ADMIN' : 'ACTIVE', displayRole: 'r' }); a.status.set('ready');
	return PAGES.filter(p => a.allows(ruleForPath(`/supper-admin-overview/${p}`)));
};

describe('which admin pages each job role opens (menu and direct link share one rule)', () => {
	for (const [role, perms] of Object.entries(ROLES)) {
		it(`${role}: exactly its pages, never roles / super-admins / settings / audit / infrastructure / broadcast / operations lists`, () => {
			const pages = open(perms); TestBed.resetTestingModule();
			expect(pages.sort()).toEqual([...EXPECT[role]].sort());
			for (const never of ['roles', 'super-admins', 'system-settings', 'audit', 'it/servers', 'communication/broadcast', 'ai/dashboard', 'projects']) expect(pages).not.toContain(never);
		});
	}
	it('an ADMIN with no grant opens no data page; a SUPER_ADMIN opens all of them', () => {
		const none = open([]); TestBed.resetTestingModule(); expect(none).toEqual(['tasks'].filter(() => false));
		const all = open([], true); TestBed.resetTestingModule(); expect(all.sort()).toEqual([...PAGES].sort());
	});
	it('the team manager sees the team but not the role / permission pages, and personal changes follow the same rules (a DENY removes the page)', () => {
		const tm = open(ROLES['مدير فريق']); TestBed.resetTestingModule(); expect(tm).toContain('team'); expect(tm).not.toContain('roles');
		const denied = open(ROLES['مدير فريق'].filter(p => p !== 'finance.read' && p !== 'withdrawals.review')); TestBed.resetTestingModule(); expect(denied).not.toContain('revenues'); expect(denied).not.toContain('withdrawals');
	});
});
