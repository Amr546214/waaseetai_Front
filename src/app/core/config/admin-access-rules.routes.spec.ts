import { describe, it, expect } from 'vitest';
import { ruleForPath } from './admin-access-rules';

import type { Route } from '@angular/router';
import { SUPPER_ADMIN_ROUTES } from '../../pages/dashboard/supper-admin-overview/supper-admin.routes';
import { hasExplicitRule } from './admin-access-rules';

// Every page of the admin console has an EXPLICIT access rule. The real route table is walked, so a page added later without a rule fails here instead of being opened by omission.
const leaves = (routes: Route[], prefix = ''): string[] => routes.flatMap(r => {
	const full = [prefix, r.path ?? ''].filter(Boolean).join('/');
	return r.children ? [...(r.loadComponent ? [full] : []), ...leaves(r.children, full)] : r.path === '**' ? [] : [full];
});
describe('admin pages: an explicit rule for each one', () => {
	const pages = [...new Set(leaves(SUPPER_ADMIN_ROUTES))].filter(p => !/^\*\*/.test(p));
	it('found the pages', () => expect(pages.length).toBeGreaterThan(60));
	it('every page (with its parent prefix) has an explicit rule: none is open by omission', () => {
		expect(pages.filter(p => !hasExplicitRule(p))).toEqual([]);
	});
	it('an unlisted path is closed to staff (SUPER_ADMIN only), not open to any member', () => {
		expect(ruleForPath('/supper-admin-overview/some-new-page')).toEqual({ superAdmin: true });
		expect(ruleForPath('/supper-admin-overview/some-new-page/deep/child')).toEqual({ superAdmin: true });
	});
	it('the sensitive groups are bound to what the server binds them to', () => {
		const r = (p: string) => ruleForPath(`/supper-admin-overview/${p}`);
		expect(r('it/servers')).toEqual({ superAdmin: true }); expect(r('it/security')).toEqual({ all: ['audit.view'] });
		expect(r('communication/broadcast')).toEqual({ superAdmin: true }); expect(r('ai/dashboard')).toEqual({ superAdmin: true });
		expect(r('subscriptions/plans')).toEqual({ all: ['packages.manage'] }); expect(r('subscriptions/invoices')).toEqual({ all: ['finance.read'] });
		expect(r('analytics/quality')).toEqual({ all: ['finance.read'] }); expect(r('analytics/coupons')).toEqual({ all: ['packages.manage'] });
		expect(r('risk-center')).toEqual({ all: ['finance.read'] });
		expect(r('withdrawals/abc')).toEqual({ all: ['withdrawals.review'] });
	});
});
