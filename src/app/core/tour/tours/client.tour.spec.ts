import { CLIENT_TOUR, CLIENT_DASHBOARD_ROUTE } from './client.tour';
import { ALL_TOURS } from './index';
import { ROLE_TOURS } from './role-tours';
import { UserRole } from '../../models/auth.model';

describe('client dashboard tour', () => {
	it('is the client role tour and is part of every tour list (so it gets audio)', () => {
		expect(ROLE_TOURS[UserRole.CLIENT]).toBe(CLIENT_TOUR); expect(ALL_TOURS).toContain(CLIENT_TOUR);
	});
	it('stays inside the client dashboard, has Arabic sentences and unique ids', () => {
		const ids = ALL_TOURS.flatMap(t => t.steps.map(s => s.id)); expect(new Set(ids).size).toBe(ids.length);
		for (const s of CLIENT_TOUR.steps) {
			expect(s.route === CLIENT_DASHBOARD_ROUTE || s.route!.startsWith(CLIENT_DASHBOARD_ROUTE + '/'), s.id).toBe(true);
			expect(/[؀-ۿ]/.test(s.text), s.id).toBe(true); expect(s.text.length, s.id).toBeGreaterThan(20);
			expect(s.text, s.id).not.toContain('بيبو');
		}
	});
});
