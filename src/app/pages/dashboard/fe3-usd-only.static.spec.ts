/// <reference types="node" />

// FE-3: USD only, PayPal only. Production files (including the withdrawal screens) must never bring back a riyal / SAR label,
// Moyasar, or a non-PayPal deposit rail.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '..', '..');
const SRC = join(APP, '..');

function walk(dir: string, out: string[] = []): string[] {
	for (const f of readdirSync(dir)) {
		const p = join(dir, f);
		if (statSync(p).isDirectory()) walk(p, out);
		else out.push(p);
	}
	return out;
}
const production = walk(SRC).filter(f => /\.(ts|html|css)$/.test(f) && !/\.spec\.ts$/.test(f) && !/test-fixtures/.test(f));
const read = (rel: string) => readFileSync(join(APP, rel), 'utf-8');
const BANNED = [
	{ name: 'SAR', re: /\bSAR\b/ },
	{ name: 'ريال', re: /ريال/ },
	{ name: 'ر.س', re: /ر\.س/ },
	{ name: '﷼', re: /﷼/ },
	{ name: 'Moyasar', re: /moyasar|mysr/i },
	{ name: 'ميسر', re: /ميسر/ },
	{ name: 'Apple Pay', re: /apple\s?pay/i },
	{ name: 'مدى (شبكة الدفع)', re: /بمدى|>\s*مدى\s*<|[\/،]\s*مدى(?!\s*الحياة)|مدى\s*[\/،]/ },
];

describe('FE-3 USD only / PayPal only', () => {
	it('no production file mentions SAR, riyal wording/symbols, Moyasar, Apple Pay or the mada network', () => {
		for (const f of production) {
			const text = readFileSync(f, 'utf-8');
			for (const b of BANNED) expect(b.re.test(text), `${f.replace(SRC, 'src')}: ${b.name}`).toBe(false);
		}
	});

	it('the withdrawal screens (provider, marketer, admin) exist and carry no riyal wording', () => {
		const files = [
			'pages/dashboard/provider-overview/finance/withdraw/withdraw.html',
			'pages/dashboard/provider-overview/finance/withdraw/withdraw.ts',
			'pages/dashboard/marketer-overview/withdraw/withdraw.html',
			'pages/dashboard/marketer-overview/withdraw/withdraw.ts',
			'pages/dashboard/supper-admin-overview/sa-withdrawals/sa-withdrawals.html',
			'pages/dashboard/supper-admin-overview/sa-withdrawals/sa-withdrawals.ts',
			'pages/dashboard/supper-admin-overview/sa-withdrawals/sa-withdrawal-detail/sa-withdrawal-detail.ts',
		];
		for (const f of files) {
			const t = read(f);
			expect(t, f).not.toMatch(/ريال|ر\.س|﷼|\bSAR\b/);
		}
		// numeric limits are shown with no currency symbol until the owner sets the USD value
		expect(read('pages/dashboard/marketer-overview/withdraw/withdraw.html')).toContain('الحد الأدنى: 300 ·');
	});

	it('index.html and styles.css no longer load or style Moyasar', () => {
		expect(readFileSync(join(SRC, 'index.html'), 'utf-8')).not.toMatch(/moyasar|mysr/i);
		expect(readFileSync(join(SRC, 'styles.css'), 'utf-8')).not.toMatch(/moyasar|mysr/i);
	});

	it('the Moyasar callback (?id=) is no longer handled by the wallet or the escrow deposit page', () => {
		expect(read('pages/dashboard/clients-overview/finance/wallet/wallet.ts')).not.toContain('verifyDeposit');
		expect(read('pages/dashboard/clients-overview/my-request/escrow-deposit/escrow-deposit.ts')).not.toContain('verifyDeposit');
		expect(read('core/services/client-finance.service.ts')).not.toMatch(/deposit\/init|deposit\/verify|initiateDeposit/);
	});

	it('the legal deposit table lists PayPal only', () => {
		const t = read('pages/website/legal/legal-page.component.ts');
		expect(t).toContain("rows: [['باي بال', '7%']]");
		expect(t).not.toMatch(/'فيزا \/ ماستر'|'تحويل دولي'|'غير ذلك'/);
	});
});
