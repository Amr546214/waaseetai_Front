/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARKETER_ROUTES } from './marketer.routes';
import { helpRoleOfUrl, guidedCatalog } from '../../../core/help/help-guided';
import { TICKET_STATUS_LABELS } from './help/ticket-detail/ticket-detail';

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8');
const flat = (routes: any[]): string[] => routes.flatMap(r => [r.path, ...(r.children ? flat(r.children) : [])]);

describe('marketer area: routes, role guards, help honesty', () => {
	it('every page a notification or link points at is a real marketer route', () => {
		const paths = flat(MARKETER_ROUTES as any[]);
		for (const p of ['referrals', 'commissions', 'withdraw', 'assets', 'notifications', 'help', 'help/tickets/:id', 'data']) expect(paths, p).toContain(p);
		// the routes the backend notifications use
		for (const url of ['/marketer-overview/referrals', '/marketer-overview/commissions', '/marketer-overview/withdraw', '/marketer-overview/profile/data', '/marketer-overview/help/tickets/abc']) {
			const rel = url.replace('/marketer-overview/', '').replace(/abc$/, ':id');
			expect(paths.some(p => p === rel || (rel.startsWith('profile/') && paths.includes(rel.slice(8))))).toBe(true);
		}
	});

	it('every marketer page opens through the prefs guard (saved timezone)', () => {
		expect((MARKETER_ROUTES as any[])[0].canActivateChild?.length).toBe(1);
	});

	it('the help page makes no invented promise: no 24h SLA, no payout weekday, no "available now" badge', () => {
		const html = read('help/help.html');
		expect(html).not.toMatch(/خلال 24 ساعة|خلال 48|الخميس|الأحد|متاح الآن|الدعم البشري/);
		expect(html).toContain('يصلك الرد في التذكرة');
	});

	it('ticket statuses show Arabic labels', () => {
		expect(TICKET_STATUS_LABELS.AWAITING_CUSTOMER).toBe('بانتظار ردّك');
		expect(Object.keys(TICKET_STATUS_LABELS).length).toBe(5);
	});

	it('Bebo is guided ONLY inside the marketer help pages (including a ticket page), normal everywhere else', () => {
		expect(helpRoleOfUrl('/marketer-overview/help')).toBe('marketer');
		expect(helpRoleOfUrl('/marketer-overview/help/tickets/abc')).toBe('marketer');
		expect(helpRoleOfUrl('/marketer-overview/help?ticket=1')).toBe('marketer');
		for (const u of ['/marketer-overview', '/marketer-overview/withdraw', '/marketer-overview/assets', '/marketer-overview/profile/data', '/marketer-overview/helpful', '/marketplace', '/']) expect(helpRoleOfUrl(u), u).toBeNull();
	});

	it('the guided marketer answers carry no SLA / schedule claim', () => {
		const text = guidedCatalog('marketer').map(c => c.answer).join(' ');
		expect(text).not.toMatch(/خلال \d+ ساعة|24|48|الأربعاء|الخميس|SAMA|PDPL|VAT/);
	});

	it('the data page claims no automatic level-up, no 90-day advice, no compliance claim', () => {
		const html = read('profile/data/data.html');
		expect(html).not.toMatch(/90 يوما|يرتفع مستواك تلقائيًا|PDPL|SAMA/);
	});

	it('no marketer page offers a purchase: no cart, checkout or marketplace buy control', () => {
		for (const f of ['marketer.routes.ts', 'withdraw/withdraw.html', 'assets/assets.html', 'help/help.html']) expect(read(f), f).not.toMatch(/\/cart|\/checkout|أضف إلى السلة|اشترِ الآن/);
	});

	it('the sidebar links the assets page', () => {
		const sidebar = readFileSync(join(__dirname, '../../../sheards/dashboard/sidebar/sidebar.ts'), 'utf8');
		expect(sidebar).toContain("route: '/marketer-overview/assets'");
	});
});
