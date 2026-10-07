/// <reference types="node" />

// Static guard: the individual provider's pages carry no company wording. Only the individual parts are checked (the company branch of
// each page legitimately keeps its own copy): the else-part of the page-level company/individual @if, or the whole file when there is none.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = __dirname;
const read = (rel: string) => readFileSync(join(APP, rel), 'utf-8');
const WORD = /شركة|الشركة|شركات|الشركات/;

/** The individual part of a template whose first block is `@if (isCompanyMode()) { … } @else { … }`; the whole text otherwise. */
function individualPart(html: string): string {
	const lines = html.split('\n');
	const first = lines.findIndex(l => l.trim().startsWith('@if (isCompanyMode())'));
	if (first !== 0 && first !== 6) return html;
	const els = lines.findIndex((l, i) => i > first && /^\} @else \{/.test(l));
	return els > 0 ? lines.slice(els).join('\n') : html;
}

const P = 'pages/dashboard/provider-overview/';
describe('individual provider pages: no company wording', () => {
	it('public profile (tab, about heading, activity)', () => {
		const t = individualPart(read(P + 'profile/public/public.html'));
		expect(t).not.toMatch(WORD);
	});
	it('profile data / requests / level / notifications / account settings: the individual part has no company word', () => {
		for (const f of ['profile/data/data.html', 'profile/requests/requests.html', 'profile/level/level.html', 'notifications/notifications.html', 'settings/account/account.html'])
			expect(individualPart(read(P + f)), f).not.toMatch(WORD);
	});
	it('the sweep fixes: no invented "شركة" client type, no company example in the specialty placeholder, no company wording in the approvals notice', () => {
		expect(read(P + 'explore-requests/applay-request/applay-request.html')).not.toContain("|| 'شركة'");
		expect(read(P + 'profile/specialties/specialties.html')).not.toContain('لشركة تقنية');
		const notice = read(P + 'marketing/approvals/approvals.html').split('@if (!isCompanyMode())')[1].split('} @else {')[0];
		expect(notice).not.toMatch(WORD);
	});
});
