/// <reference types="node" />

// Static guard: terms / privacy links inside forms and wizards must open in a NEW tab (target="_blank" +
// rel="noopener noreferrer"); a same-tab link throws the user out of the form and loses what they typed.
// Also no placeholder href="#" may be used for them.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = __dirname;
const CONSENT_TEXT = /شروط\s*الاستخدام|الشروط والأحكام|سياسة الخصوصية/;

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (full.endsWith('.html')) out.push(full);
	}
	return out;
}

/** Forms / wizards where the consent links sit next to the data the user is typing. */
const FORM_TEMPLATES = [
	'pages/auth/register/register.html',
	'pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html',
	'pages/dashboard/clients-overview/profile/profile-setup/profile-setup.html',
	'pages/dashboard/clients-overview/create-request/components/step6-review/step6-review.html',
	'pages/website/checkout/payment/payment.html',
	'pages/website/checkout/custom-request/custom-request.html',
	'pages/dashboard/clients-overview/my-request/contract-signature/contract-signature.html',
	'pages/dashboard/provider-overview/offers/sign-contract/sign-contract.html',
];

const consentAnchors = (html: string) =>
	[...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]).filter((a) => CONSENT_TEXT.test(a.replace(/<[^>]+>/g, '')));

describe('consent links in forms', () => {
	it('every terms/privacy link in a form or wizard opens in a new tab with noopener noreferrer', () => {
		const bad: string[] = [];
		for (const rel of FORM_TEMPLATES) {
			const anchors = consentAnchors(readFileSync(join(APP, rel), 'utf-8'));
			expect(anchors.length, `${rel} has no consent link (guard would be vacuous)`).toBeGreaterThan(0);
			for (const a of anchors) {
				if (!/target="_blank"/.test(a) || !/rel="noopener noreferrer"/.test(a)) bad.push(`${rel}: ${a.slice(0, 80)}`);
			}
		}
		expect(bad).toEqual([]);
	});

	it('no terms/privacy link anywhere uses the dead placeholder href ("#" / javascript:void(0))', () => {
		const bad = walk(APP)
			.filter((f) => consentAnchors(readFileSync(f, 'utf-8')).some((a) => /href="(#|javascript:[^"]*)"/.test(a)))
			.map((f) => relative(APP, f));
		expect(bad).toEqual([]);
	});
});
