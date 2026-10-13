/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RequestApprovalsComponent } from './request-approvals/request-approvals.component';
import { SpendingLimitsComponent } from './spending-limits/spending-limits.component';

// Company-client pages that had hand-written example requests, limits, penalty rules and policies (invented names, amounts, "5% / 48 hours / 30 days").
// The backend has no such system: the pages now say so instead of showing figures nobody configured.
describe('company client pages carry no example data', () => {
	it('approvals: no example requests, counts follow the (empty) list', () => {
		const c = new RequestApprovalsComponent();
		expect(c.requests).toEqual([]);
		expect(c.filters.map(f => f.count)).toEqual([0, 0, 0]);
		expect(c.filteredRequests).toEqual([]);
	});

	it('spending limits: no example limits, penalties or policies, and no division by a zero limit', () => {
		const c = new SpendingLimitsComponent();
		expect([c.limits, c.penalties, c.policies]).toEqual([[], [], []]);
		expect(c.percentSpent({ id: 'x', category: 'c', limit: 0, spent: 5, period: 'شهري' })).toBe(0);
	});

	it('the templates say the feature is not active and show an empty state', () => {
		const dir = __dirname;
		const sl = readFileSync(join(dir, 'spending-limits/spending-limits.component.html'), 'utf8');
		const ra = readFileSync(join(dir, 'request-approvals/request-approvals.component.html'), 'utf8');
		expect(sl).toContain('sl-unavailable');
		expect(sl).toContain('@empty');
		expect(ra).toContain('ra-unavailable');
		expect(ra).toContain('@empty');
		expect(ra).not.toContain('معتمد هذا الشهر');
	});
});
