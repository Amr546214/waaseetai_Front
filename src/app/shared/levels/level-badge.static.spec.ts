/// <reference types="node" />

// Static guards: every page shows a level through the ONE shared badge (shared/levels/level-badge.component.ts, fed by core/levels/level-display.ts),
// and the AI identity banners of the level page use the official i-ai mark (a shield is not the AI mark).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(__dirname, '../..');
const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');
function walk(dir: string, out: string[] = []): string[] {
	for (const n of readdirSync(dir)) {
		const p = join(dir, n);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(html|ts)$/.test(n) && !/\.spec\.ts$/.test(n)) out.push(p);
	}
	return out;
}
const FILES = walk(APP);

describe('one level badge for every role and page', () => {
	it.each([
		'pages/dashboard/provider-overview/provider-overview/provider-overview.html',
		'pages/dashboard/provider-overview/profile/level/level.html',
		'pages/dashboard/provider-overview/profile/public/public.html',
		'pages/dashboard/clients-overview/client-overview/client-overview.component.html',
		'pages/dashboard/clients-overview/profile/profile.html',
		'pages/dashboard/clients-overview/my-request/request-details/request-details.html',
		'pages/website/marketplace/provider-profile/provider-profile.html',
		'pages/website/marketplace/marketplace.html',
		'pages/website/marketplace/favorites/favorites.html',
		'pages/website/marketplace/offer/offer.html',
		'pages/website/marketplace/compare-services/compare-services.html',
		'pages/website/marketplace/compare-providers/compare-providers.html',
		'pages/website/marketplace/curated/curated.html',
		'pages/website/marketplace/slug/slug.html',
		'pages/website/checkout/cart/cart.html',
		'pages/website/checkout/review/review.html',
		'sheards/card/card.html',
	])('%s renders levels through <ws-level-badge>', (page) => {
		const html = read(page);
		expect(html).toContain('<ws-level-badge');
		expect(html).not.toMatch(/ws-level-tag/);
	});

	it.each([
		'pages/dashboard/marketer-overview/withdraw/withdraw.html',
		'pages/dashboard/marketer-overview/help/help.html',
		'pages/dashboard/marketer-overview/notifications/notifications.html',
		'pages/dashboard/marketer-overview/profile/public/public.html',
		'pages/dashboard/marketer-overview/profile/data/data.html',
		'pages/dashboard/marketer-overview/marketing-broker-overview/marketing-broker-overview.html',
	])('%s renders the marketer level through the shared badge with no typed fallback name', (page) => {
		const html = read(page);
		expect(html).toContain('<ws-marketer-level');
		expect(html).not.toMatch(/ws-level-tag/);
		expect(html).not.toMatch(/\|\| 'مساعد'/);
	});

	it('no page keeps a typed list of level colours or the old 3/4-bucket level styles', () => {
		const bad = FILES.filter((f) => /homeLevelStyles|levelClass\(|resultLevelStyle|level-خبير|level-متقدم/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(APP.length + 1));
		expect(bad).toEqual([]);
	});

	it('the badge colours come from the shared pair and switch with the page theme', () => {
		const src = read('shared/levels/level-badge.component.ts');
		expect(src).toContain('--lvl-dark');
		expect(src).toContain(':host-context(.light-theme)');
		expect(src).not.toMatch(/#[0-9a-fA-F]{6}/);
	});
});

describe('provider level page: rule-based notes are not AI', () => {
	const html = read('pages/dashboard/provider-overview/profile/level/level.html');
	it('the "وسيط، نظام التصنيف" card and the level advice box are neutral ws-notes (the backend builds the advice from the real gaps, no AI), never purple + i-ai', () => {
		expect(html).toContain('ws-note');
		expect(html).not.toContain('<use href="#i-ai">');
		expect(html).not.toContain('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z');
	});
});

describe('provider dashboard "وسيط، …" banners: AI only when the banner is a real AI function', () => {
	const base = 'pages/dashboard/provider-overview/';
	// Real AI / smart follow-up → purple + the official i-ai mark.
	it.each(['projects/archived/archived.html', 'projects/active/active.html', 'help/help.html'])('%s: draws the official i-ai mark', (file) => {
		expect(read(base + file)).toContain('href="#i-ai"');
	});

	// Security / invoices / account / reviews / reports notes are NOT AI: a neutral ws-note, never purple + i-ai (ai-purple.static.spec.ts guards the rule).
	it.each(['settings/account/account.html', 'profile/add-account/add-account.html', 'finance/invoices/invoices.html', 'notifications/favorite/favorite.html', 'reports/reports.html',
		'company/official-invoices/official-invoices.component.html', 'disputes/disputes.html', 'profile/requests/requests.html'])('%s: is a non-AI ws-note banner', (file) => {
		expect(read(base + file)).toContain('ws-note');
	});
});
