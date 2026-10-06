/// <reference types="node" />

// Static guard for the temporary payment policy: the platform supports PayPal only, so no payment /
// payout / deposit method other than PayPal may be selectable. Legacy history rows stay (they only display
// stored data). Marketer payout screens are a documented exception: the backend has no PayPal destination for
// marketers yet (AffiliateProfile / marketer withdrawals are bank-based), so they cannot be switched off.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = __dirname;
const read = (rel: string) => readFileSync(join(APP, rel), 'utf-8');

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (full.endsWith('.html')) out.push(full);
	}
	return out;
}

/** Marketer payout screens (backend blocker) and admin screens (read-only views of stored data). */
const EXCEPTIONS = /pages\/dashboard\/(marketer-overview|supper-admin-overview)\//;
/** Client onboarding step 3 still collects the only payout data the backend can store (bank); see the PR notes. */
const CLIENT_SETUP = 'pages/dashboard/clients-overview/profile/profile-setup/profile-setup.html';

describe('only PayPal is a selectable payment method', () => {
	const templates = walk(APP).map((f) => relative(APP, f));

	it('no wallet-provider / alternative-wallet choice (STC Pay, urpay, barq, Alinma Pay, Apple Pay) outside the documented exceptions', () => {
		const offenders = templates
			.filter((rel) => !EXCEPTIONS.test(rel) && !rel.startsWith('pages/website/'))
			.filter((rel) => /<option[^>]*>\s*(STC Pay|urpay|barq|Alinma Pay|Apple Pay)\s*<\/option>/i.test(read(rel)))
			.map((rel) => rel);
		expect(offenders).toEqual([]);
	});

	it('client profile/edit: the bank option is a disabled, non-form radio with the "غير متاح حاليًا" badge', () => {
		const html = read('pages/dashboard/clients-overview/profile/profile-edit/profile-edit.html');
		expect(html).toMatch(/<input type="radio" name="pm-bank-unavailable" value="bank" disabled/);
		expect(html).toContain('غير متاح حاليًا');
		expect(html).not.toMatch(/formControlName="paymentMethod" value="bank"/);
		expect(html).not.toMatch(/formControlName="(ibanNumber|bankName|walletProvider|walletPhone|walletId)"/);
	});

	it('provider wallet deposit dialog: PayPal is the only method and it is disabled', () => {
		const html = read('pages/dashboard/provider-overview/finance/wallet/deposit-modal/deposit-modal.html');
		const buttons = [...html.matchAll(/<button[^>]*class="dpm-method"[^>]*>/g)].map((m) => m[0]);
		expect(buttons.length).toBe(1);
		for (const b of buttons) expect(b).toMatch(/\bdisabled\b/);
	});

	it('shared client deposit dialog offers PayPal only (no Moyasar / card flow left)', () => {
		const ts = read('sheards/deposit-modal/deposit-modal.ts');
		expect(ts).not.toMatch(/moyasar/i);
		expect(ts).not.toContain('initiateDeposit');
		const html = read('sheards/deposit-modal/deposit-modal.html');
		expect(html).not.toMatch(/moyasar|mysr/i);
		expect(html).toContain('PayPal');
	});

	it('client onboarding step 3 is left as is on purpose (documented, not silently changed)', () => {
		expect(templates).toContain(CLIENT_SETUP);
	});
});
