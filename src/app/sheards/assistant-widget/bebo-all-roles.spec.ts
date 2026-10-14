import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Route } from '@angular/router';
import { CLIENT_OVERVIEW_ROUTES } from '../../pages/dashboard/clients-overview/client.routes';
import { PROVIDER_OVERVIEW_ROUTES } from '../../pages/dashboard/provider-overview/provider.routes';
import { MARKETER_ROUTES } from '../../pages/dashboard/marketer-overview/marketer.routes';
import { SUPPER_ADMIN_ROUTES } from '../../pages/dashboard/supper-admin-overview/supper-admin.routes';
import { routes as APP_ROUTES } from '../../app.routes';
import { helpRoleOfUrl } from '../../core/help/help-guided';

// Area X (28): Bebo is never hidden. It is mounted once at the app root; only auth + error pages opt out. The GUIDED mode exists only on /<role>-overview/help*
// (client, provider, marketer); every other page of every role (including all admin pages) gets the normal assistant.
const flagged = (list: readonly Route[], trail = ''): string[] =>
	list.flatMap(r => [
		...(r.data?.['hideAssistant'] === true ? [`${trail}/${r.path}`] : []),
		...flagged(r.children ?? [], `${trail}/${r.path}`),
	]);

describe('Bebo is present for every role layout', () => {
	it('no route of the client, provider, marketer or admin dashboards hides it, except the embedded not-found wildcard', () => {
		// the in-dashboard 404 page (path "**", embedded) is the only opt-out inside a role layout
		expect(flagged(CLIENT_OVERVIEW_ROUTES)).toEqual(['/**']);
		expect(flagged(PROVIDER_OVERVIEW_ROUTES)).toEqual(['/**']);
		expect(flagged(MARKETER_ROUTES)).toEqual(['//**']); // under the pathless prefs-guard wrapper
		expect(flagged(SUPPER_ADMIN_ROUTES)).toEqual(['/**']);
	});

	it('at the app root only auth + error pages + not-found (root and the per-role embedded 404) opt out', () => {
		expect(flagged(APP_ROUTES).sort()).toEqual([
			'/**', '/auth', '/error/403', '/error/500', '/error/maintenance', '/error/session-expired',
			'/client-overview/**', '/provider-overview/**', '/marketer-overview//**', '/supper-admin-overview/**',
		].sort());
	});

	it('it is mounted once at the root, behind the single hideAssistant check, and nowhere else', () => {
		const app = readFileSync(join(__dirname, '..', '..', 'app.ts'), 'utf8');
		expect(app).toMatch(/@if \(\(authStore\.isInitialized\$ \| async\) && !assistantHidden\(\)\) \{\s*@defer \(on idle\) \{\s*<app-assistant-widget/);
	});
});

describe('guided mode only on /<role>-overview/help*', () => {
	it('client, provider and marketer help pages (and their sub-pages) are guided', () => {
		for (const role of ['client', 'provider', 'marketer']) {
			for (const sub of ['/help', '/help/tickets', '/help/live-support?x=1', '/help#top']) expect(helpRoleOfUrl(`/${role}-overview${sub}`), `${role}${sub}`).toBe(role);
		}
	});

	it('every other page is the normal assistant: dashboards, other pages, look-alike paths, the admin area and the website', () => {
		for (const url of [
			'/client-overview', '/client-overview/my-requests', '/provider-overview/finance/wallet', '/marketer-overview', '/marketer-overview/commissions',
			'/provider-overview/helpful', '/client-overview/helper/x', '/supper-admin-overview', '/supper-admin-overview/help', '/supper-admin-overview/sa-support',
			'/', '/marketplace', '/help', '/admin-overview/help', '', null, undefined,
		]) expect(helpRoleOfUrl(url as any), String(url)).toBeNull();
	});

	it('the admin area has no help page that could turn the assistant guided', () => {
		expect(SUPPER_ADMIN_ROUTES.map(r => r.path).filter(p => /^help/.test(p ?? ''))).toEqual([]);
	});
});
