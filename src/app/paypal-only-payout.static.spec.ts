/// <reference types="node" />

// Static guard: the platform pays out through PayPal only (for now), so the provider payout screens must
// not bring back bank-account inputs (bank / account holder / IBAN) and must keep the PayPal email field.
// (Marketer and client screens are intentionally not covered: the backend has no PayPal destination for them yet.)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = __dirname;
const read = (rel: string) => readFileSync(join(APP, rel), 'utf-8');

const PROVIDER_PAYOUT_SCREENS = {
	'provider onboarding (setup)': 'pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html',
	'provider profile data': 'pages/dashboard/provider-overview/profile/data/data.html',
	'provider withdraw': 'pages/dashboard/provider-overview/finance/withdraw/withdraw.html',
};

const BANK_INPUT_IDS = ['pr-bank', 'pr-acct-owner', 'pr-iban', 'bk-bank', 'bk-holder', 'bk-iban', 'wdName', 'wdIban', 'wdAcc'];
const BANK_CONTROLS = /formControlName="(bankName|accountOwner|accountHolderName|ibanNumber|iban)"/;
const BANK_LABELS = /اسم البنك|اختر البنك|رقم الآيبان|رقم IBAN|اسم صاحب الحساب|بنك الراجحي|البنك الأهلي|\(SNB\)|\(SABB\)/;

describe('provider payout screens are PayPal-only', () => {
	for (const [name, rel] of Object.entries(PROVIDER_PAYOUT_SCREENS)) {
		it(`${name}: no bank-account inputs or bank lists`, () => {
			const html = read(rel);
			for (const id of BANK_INPUT_IDS) expect(html, `${rel} still has #${id}`).not.toContain(`id="${id}"`);
			expect(html).not.toMatch(BANK_CONTROLS);
			expect(html).not.toMatch(BANK_LABELS);
		});
	}

	it('onboarding step 3 and profile data both ask for the PayPal email (required email control)', () => {
		const setup = read(PROVIDER_PAYOUT_SCREENS['provider onboarding (setup)']);
		expect(setup).toContain('formControlName="paypalEmail"');
		expect(setup).toContain('سنستخدم هذا البريد لإرسال مستحقاتك عبر PayPal.');
		const data = read(PROVIDER_PAYOUT_SCREENS['provider profile data']);
		expect(data).toContain('formControlName="paypalPayoutEmail"');
		expect(data).toContain('سنستخدم هذا البريد لإرسال مستحقاتك عبر PayPal.');
	});

	it('the onboarding payload never sends a bank block (it would overwrite saved values with empties)', () => {
		const ts = read('pages/dashboard/provider-overview/profile/profile-setup/profile-setup.ts');
		expect(ts).not.toMatch(/\bbank\s*:\s*\{/);
		expect(ts).not.toMatch(/iban|accountHolder|bankName/i);
	});

	it('the withdraw request carries no bank fields', () => {
		const ts = read('pages/dashboard/provider-overview/finance/withdraw/withdraw.ts');
		expect(ts).toContain("method = 'paypal'");
		expect(ts).not.toMatch(/accountName\s*:|iban\s*:|accountNumber\s*:/);
	});
});
