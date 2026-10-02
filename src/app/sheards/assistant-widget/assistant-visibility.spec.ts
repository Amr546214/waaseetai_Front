import type { ActivatedRouteSnapshot } from '@angular/router';
import { routes } from '../../app.routes';
import { isAssistantHidden } from './assistant-visibility';

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
