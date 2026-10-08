/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Support/help/settings/create-request pages whose dropdowns were native <select> (white popup in dark mode) now use the site ws-select.
const APP = __dirname;
const CONVERTED = [
	'pages/dashboard/clients-overview/help/new-ticket/new-ticket.html',
	'pages/dashboard/provider-overview/help/new-ticket/new-ticket.html',
	'pages/dashboard/provider-overview/help/live-support/live-support.html',
	'pages/dashboard/clients-overview/settings/account/account.html',
	'pages/dashboard/provider-overview/settings/account/account.html',
	'pages/dashboard/clients-overview/create-request/components/step2-conditions/step2-conditions.html',
];

describe('site dropdown sweep', () => {
	for (const f of CONVERTED) {
		it(`${f.split('/').slice(-3).join('/')} has no native <select>`, () => {
			const html = readFileSync(join(APP, f), 'utf8');
			expect(html).not.toContain('<select');
			expect(html).toContain('<ws-select');
		});
	}

	it('selects that stay native follow the page theme (color-scheme dark by default, light in the light theme)', () => {
		const css = readFileSync(join(APP, '..', 'styles.css'), 'utf8');
		expect(css).toMatch(/\nselect\{color-scheme:dark\}/);
		expect(css).toMatch(/html\.light-theme select[^{]*\{color-scheme:light\}/);
	});

	it('the country/city selects stay native on purpose (the shared-data static spec depends on them)', () => {
		const html = readFileSync(join(APP, 'pages/dashboard/clients-overview/profile/profile-edit/profile-edit.html'), 'utf8');
		expect(html).toContain('<select');
	});
});
