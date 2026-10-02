import type { ActivatedRouteSnapshot } from '@angular/router';
import { routes } from '../../app.routes';
import { CLIENT_OVERVIEW_ROUTES } from '../../pages/dashboard/clients-overview/client.routes';
import { PROVIDER_OVERVIEW_ROUTES } from '../../pages/dashboard/provider-overview/provider.routes';
import { ASSISTANT_LIFT_PX, assistantLiftPx, isAssistantHidden } from './assistant-visibility';

/** Minimal snapshot chain: each entry is the `data` of one route level, root first. */
function chain(...levels: Array<Record<string, unknown>>): ActivatedRouteSnapshot {
	let next: ActivatedRouteSnapshot | null = null;
	for (let i = levels.length - 1; i >= 0; i--) {
		next = { data: levels[i], firstChild: next } as unknown as ActivatedRouteSnapshot;
	}
	return next as ActivatedRouteSnapshot;
}

describe('isAssistantHidden', () => {
	it('public pages and dashboards show the assistant', () => {
		expect(isAssistantHidden(chain({}, {}))).toBe(false); // website layout > page
		expect(isAssistantHidden(chain({}, {}, { title: 'x' }))).toBe(false); // dashboard layout > page
		expect(isAssistantHidden(null)).toBe(false);
		expect(isAssistantHidden(undefined)).toBe(false);
	});

	it('a flag on a parent route (auth) hides it for every child page', () => {
		expect(isAssistantHidden(chain({}, { hideAssistant: true }, { title: 'login' }))).toBe(true);
	});

	it('a flag on the leaf (error pages / not found) hides it', () => {
		expect(isAssistantHidden(chain({}, { type: '500', hideAssistant: true }))).toBe(true);
	});

	it('only an explicit true counts', () => {
		expect(isAssistantHidden(chain({}, { hideAssistant: 'yes' }))).toBe(false);
		expect(isAssistantHidden(chain({}, { hideAssistant: false }))).toBe(false);
	});
});

describe('app.routes hideAssistant flags', () => {
	const flagged = (path: string) => routes.find((r) => r.path === path)?.data?.['hideAssistant'] === true;

	it('hides the assistant on auth, every error page and the not-found route', () => {
		for (const path of ['auth', 'error/500', 'error/403', 'error/maintenance', 'error/session-expired', '**']) {
			expect(flagged(path), path).toBe(true);
		}
	});

	it('keeps it on the public website and on every dashboard', () => {
		for (const path of ['', 'client-overview', 'provider-overview', 'marketer-overview', 'supper-admin-overview']) {
			expect(flagged(path), path).toBe(false);
		}
	});
});

describe('assistantLiftPx (clears fixed bottom action bars)', () => {
	it('is 0 by default and only an explicit true lifts, from any level of the active branch', () => {
		expect(assistantLiftPx(null)).toBe(0);
		expect(assistantLiftPx(chain({}, {}, { title: 'x' }))).toBe(0);
		expect(assistantLiftPx(chain({}, { assistantLift: 'yes' }))).toBe(0);
		expect(assistantLiftPx(chain({}, {}, { assistantLift: true }))).toBe(ASSISTANT_LIFT_PX);
		expect(assistantLiftPx(chain({}, { assistantLift: true }, {}))).toBe(ASSISTANT_LIFT_PX);
	});

	it('the lift clears the tallest measured wizard footer (87px) with the robot 12px above the floor', () => {
		expect(ASSISTANT_LIFT_PX + 12).toBeGreaterThan(87);
	});

	it('is set exactly on the wizard pages that have a fixed bottom action bar', () => {
		const lifted = (list: readonly { path?: string; data?: Record<string, unknown> }[], path: string) =>
			list.find((r) => r.path === path)?.data?.['assistantLift'] === true;
		for (const path of ['create-request', 'my-requests/:id', 'my-requests/:id/deposit']) expect(lifted(CLIENT_OVERVIEW_ROUTES, path), path).toBe(true);
		for (const path of ['explore-requests/:id/apply', 'business-models/new-project', 'business-models/accreditation/new']) expect(lifted(PROVIDER_OVERVIEW_ROUTES, path), path).toBe(true);
		expect(lifted(CLIENT_OVERVIEW_ROUTES, 'my-requests')).toBe(false);
		expect(lifted(PROVIDER_OVERVIEW_ROUTES, 'explore-requests')).toBe(false);
	});
});
