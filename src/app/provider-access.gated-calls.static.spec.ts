import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Backend DASHBOARD_DATA_PREFIXES answer 403 for an unapproved individual provider. Pages/services that run while unapproved (allow-listed pages and
// the provider layout) must never call them. Best-effort, list based.
const root = join(process.cwd(), 'src/app');
const walk = (dir: string, out: string[] = []): string[] => {
	for (const n of readdirSync(dir)) {
		const p = join(dir, n);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.ts$/.test(n) && !/\.spec\.ts$/.test(n)) out.push(p);
	}
	return out;
};
const P = 'pages/dashboard/provider-overview/';
const files = [
	...['profile/profile-setup', 'profile/data', 'profile/specialties', 'business-models/accreditation', 'business-models/center/accreditation-details', 'help', 'notifications', 'settings', 'account-actions']
		.flatMap(d => walk(join(root, P + d))),
	...['provider-profile', 'profile-api', 'provider-prefs.store', 'notification-engine', 'notification-preferences', 'account', 'chat', 'setup-test', 'specialty', 'ticket-api', 'provider-access']
		.map(n => join(root, `core/services/${n}${n.endsWith('.store') ? '' : '.service'}.ts`)),
	join(root, 'core/store/assistant.store.ts'),
	...walk(join(root, 'sheards/dashboard/nav-dashboard')),
	...walk(join(root, 'sheards/notification-bell')),
	...walk(join(root, 'layouts/dashboard-layout')),
];
const gatedUrl = /\/provider\/(statistics|offers|finance|reports|services|projects|amendments|requests|coupons|special-offers|marketing|explore-requests)\b|\/proposals\/ai-suggest|url_api\}\/assistant\b(?!-)/;
const gatedMethods = /\.(getOverviewStats|getProviderStatistics|getExploreRequests|getProviderReports|getProviderInvoices|analyzeProjectWithAi)\(/;

describe('pages that run while unapproved never call gated provider endpoints', () => {
	for (const f of files) {
		const rel = f.replace(root + '/', '');
		it(rel, () => {
			const text = readFileSync(f, 'utf8');
			expect(gatedUrl.test(text)).toBe(false);
			expect(gatedMethods.test(text)).toBe(false);
		});
	}
});
