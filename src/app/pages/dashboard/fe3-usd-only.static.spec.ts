/// <reference types="node" />

// FE-3: PayPal only, and (until the currency formatter of phase D exists) no riyal / SAR LABEL in production files. Production files (including the withdrawal screens) must never bring back
// Moyasar or a non-PayPal deposit rail.
// POLICY (2026-10-26, currency batch C): "USD only" is no longer an absolute product rule - each amount keeps its own currency (USD / SAR) and nothing is summed across currencies. A currency code or
// name may therefore appear in production files ONLY inside the central formatter (core/utils/currency.ts); everywhere else an amount goes through formatMoneyIn / the `money` pipe. Moyasar, the mada
// network and Apple Pay stay banned everywhere. The consistency of amounts and currencies is guarded on the server by src/config/currency-consistency.guard.test.ts.

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
/** the only files allowed to name a currency (its code or its Arabic name) */
const CURRENCY_NAMING_ALLOWED = [join('core', 'utils', 'currency.ts')];
const CURRENCY_ONLY = new Set(['SAR', 'ريال', 'ر.س', '﷼']);
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

describe('FE-3 PayPal only; currencies only through the central formatter', () => {
	it('no production file names a currency outside the formatter, and none mentions Moyasar, Apple Pay or the mada network', () => {
		for (const f of production) {
			const text = readFileSync(f, 'utf-8');
			const allowedHere = CURRENCY_NAMING_ALLOWED.some(a => f.endsWith(a));
			for (const b of BANNED) { if (allowedHere && CURRENCY_ONLY.has(b.name)) continue; expect(b.re.test(text), `${f.replace(SRC, 'src')}: ${b.name}`).toBe(false); }
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
		// M2: the limits come from the server wallet and are shown in dollars ("$"), never in riyals
		expect(read('pages/dashboard/marketer-overview/withdraw/withdraw.html')).toMatch(/الحد الأدنى: \{\{ wallet\(\) \? minimumWithdrawal\(\) : '—' \}\} \$/);
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
