import { PROVIDER_TOUR, PROVIDER_DASHBOARD_ROUTE } from './provider.tour';
import { ALL_TOURS } from './index';
import { ROLE_TOURS, ROLE_TOUR_AREAS } from './role-tours';
import { UserRole } from '../../models/auth.model';

describe('provider dashboard tour', () => {
	it('is the provider role tour, lives in the provider area and is part of every tour list (so it gets audio)', () => {
		expect(ROLE_TOURS[UserRole.PROVIDER]).toBe(PROVIDER_TOUR); expect(ALL_TOURS).toContain(PROVIDER_TOUR);
		expect(ROLE_TOUR_AREAS[UserRole.PROVIDER]).toBe(PROVIDER_DASHBOARD_ROUTE);
	});
	it('stays inside the provider dashboard, has Arabic sentences, unique ids and never calls the assistant «بيبو»', () => {
		const ids = ALL_TOURS.flatMap(t => t.steps.map(s => s.id)); expect(new Set(ids).size).toBe(ids.length);
		for (const s of PROVIDER_TOUR.steps) {
			expect(s.route === PROVIDER_DASHBOARD_ROUTE || s.route!.startsWith(PROVIDER_DASHBOARD_ROUTE + '/'), s.id).toBe(true);
			expect(/[؀-ۿ]/.test(s.text), s.id).toBe(true); expect(s.text.length, s.id).toBeGreaterThan(20);
			expect(s.text, s.id).not.toContain('بيبو');
		}
	});
	it('every sidebar target points at a menu group / link the provider menu really has', async () => {
		const { readFileSync } = await import('node:fs');
		const sidebar = readFileSync('src/app/sheards/dashboard/sidebar/sidebar.ts', 'utf8');
		for (const s of PROVIDER_TOUR.steps) {
			const group = /^#acc-(\w+)$/.exec(s.target ?? '');
			if (group) expect(sidebar, s.id).toContain(`id: '${group[1]}'`);
			const link = /a\[href="([^"]+)"\]/.exec(s.target ?? '');
			if (link && link[1].endsWith('/bebo')) expect(sidebar, s.id).toContain("withBeboTab(this.getProviderNavItems(), 'provider-overview')"); // the assistant tab is appended to every role's menu
			else if (link) expect(sidebar, s.id).toContain(link[1]);
		}
	});
});
