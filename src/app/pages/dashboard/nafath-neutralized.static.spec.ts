/// <reference types="node" />

// Nafath verification has no backend integration (POST /client/profile/nafath-verify answers 503). The UI must not pretend otherwise:
// no call to nafath-verify, no "linking with NAFATH" toast, no "verified through Nafath" claim, and no isNafathVerified in setup payloads.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(APP, p), 'utf-8');
function walk(dir: string, out: string[] = []): string[] {
	for (const f of readdirSync(dir)) {
		const p = join(dir, f);
		if (statSync(p).isDirectory()) walk(p, out);
		else out.push(p);
	}
	return out;
}
const production = walk(APP).filter(f => /\.(ts|html)$/.test(f) && !/\.spec\.ts$/.test(f) && !/test-fixtures/.test(f));

describe('Nafath UI is neutralised', () => {
	it('no production file calls nafath-verify or shows the fake "linking" toast / "verified through Nafath" claim', () => {
		for (const f of production) {
			const t = readFileSync(f, 'utf-8');
			expect(/nafath-verify/i.test(t), `${f}: nafath-verify`).toBe(false);
			expect(t.includes('جاري الربط مع NAFATH'), `${f}: fake toast`).toBe(false);
			expect(/موثّقة عبر نفاذ|موثق عبر نفاذ|موثّق عبر نفاذ/.test(t), `${f}: verified-through-Nafath claim`).toBe(false);
		}
	});

	it('the Nafath buttons are disabled and say "التحقق عبر نفاذ غير متاح حاليًا"', () => {
		const client = read('pages/dashboard/clients-overview/profile/profile-setup/profile-setup.html');
		expect(client).not.toContain('triggerNafath');
		expect(client).toContain('التحقق عبر نفاذ غير متاح حاليًا');
		const edit = read('pages/dashboard/clients-overview/profile/profile-edit/profile-edit.html');
		// the edit page no longer carries a Nafath control at all (identity documents are collected in the setup wizard)
		expect(edit).not.toContain('triggerNafath');
		const provider = read('pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html');
		expect(provider).toContain('التحقق عبر نفاذ غير متاح حاليًا');
		expect(provider).toMatch(/class="nafath-btn"[^>]*disabled/);
	});

	it('the setup payloads never send isNafathVerified', () => {
		expect(read('pages/dashboard/provider-overview/profile/profile-setup/profile-setup.ts')).not.toMatch(/isNafathVerified:\s*this\./);
		expect(read('pages/dashboard/clients-overview/profile/profile-setup/profile-setup.ts')).not.toMatch(/isNafathVerified\s*:/);
	});

	it('the public client profile badge says "هوية موثّقة" only', () => {
		const h = read('pages/website/marketplace/client-profile/client-profile.html');
		expect(h).toContain('هوية موثّقة');
		expect(h).not.toContain('نفاذ');
	});
});
