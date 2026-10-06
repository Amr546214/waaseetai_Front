/// <reference types="node" />

// (C) The calibration test timer must come from one named source equal to the backend limit (15 min / 15 questions,
//     setup-test.gateway.ts:21-22), not a hard-coded 30 minutes.
// (D) /provider-profile/:id overflowed the 390px viewport by 5px because .identity-actions (nowrap flex) and .profile-tabs
//     were wider than the page; the fix lives in that component's CSS (no body/html overflow hiding).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf-8');

describe('setup-test timer and provider-profile overflow stay fixed', () => {
	it('profile-setup uses the single named 15-minute / 15-question constants', () => {
		const ts = read('pages/dashboard/provider-overview/profile/profile-setup/profile-setup.ts');
		expect(ts).not.toContain('30 * 60');
		expect(ts).not.toContain('30 mins');
		expect(ts).toContain('SETUP_TEST_TIME_LIMIT_MINUTES * 60');
		const svc = read('core/services/setup-test.service.ts');
		expect(svc).toContain('export const SETUP_TEST_TIME_LIMIT_MINUTES = 15;');
		expect(svc).toContain('export const SETUP_TEST_QUESTION_COUNT = 15;');
		const html = read('pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html');
		expect(html).not.toContain('|| 10 }}');
		expect(html).not.toContain('30 دقيقة');
	});

	it('provider-profile css wraps the identity actions on narrow screens and scrolls the tab strip inside itself', () => {
		const css = read('pages/website/marketplace/provider-profile/provider-profile.css');
		expect(css).toMatch(/\.profile-tabs\{[^}]*overflow-x:auto/);
		expect(css).toMatch(/max-width:820px\)\{\.identity-row\{flex-wrap:wrap\}\.identity-actions\{flex-wrap:wrap;max-width:100%\}/);
		expect(css).not.toMatch(/(^|\n)\s*(html|body)\s*\{[^}]*overflow-x\s*:\s*hidden/);
	});
});
