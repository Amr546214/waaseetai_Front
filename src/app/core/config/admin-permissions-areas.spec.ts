import { describe, expect, it } from 'vitest';
import { ruleForPath } from './admin-access-rules';

// Route entry of the four reviewed areas (docs/admin-permissions-matrix.md in the backend repo). Notifications history / templates / broadcast have no grantable key: Super Admin only.
describe('admin access rules: reports / support / disputes / notifications', () => {
	it('reports, support and disputes open with their view key; notifications, templates and broadcast are Super Admin only', () => {
		expect(ruleForPath('/supper-admin-overview/reports')).toEqual({ all: ['reports.view'] });
		expect(ruleForPath('/supper-admin-overview/reports/abc')).toEqual({ all: ['reports.view'] });
		expect(ruleForPath('/supper-admin-overview/support/abc')).toEqual({ all: ['support.review'] });
		expect(ruleForPath('/supper-admin-overview/disputes/abc')).toEqual({ all: ['disputes.view'] });
		expect(ruleForPath('/supper-admin-overview/communication')).toEqual({ superAdmin: true });
		expect(ruleForPath('/supper-admin-overview/communication/broadcast')).toEqual({ superAdmin: true });
		expect(ruleForPath('/supper-admin-overview/communication/anything-new')).toEqual({ superAdmin: true });
	});
});
