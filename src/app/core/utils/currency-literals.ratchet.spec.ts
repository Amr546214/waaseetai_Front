/// <reference types="node" />
// ZERO TOLERANCE: no production file types a currency by hand next to an amount ("… $", "… دولار"). Every amount goes through the central formatter with the RECORD's currency (wsAmount / money pipes,
// formatAmount in TypeScript) or, for a new entry that has no record yet, the platform base currency (wsBase / formatBase / wsCurrency). core/utils/currency.ts is the only file that names currencies.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const APP = join(__dirname, '..', '..');
const PATTERNS = [/\}\}\s*\$(?![\{\w])/g, /(?<![\w\$\{])\$\s*\{\{/g, /['"`]\s*\$['"`]/g, /[\w\)\]]\s*\+\s*['"`] ?\$['"`]/g, /\s\$\s*</g, /\d\s*\$(?![\{\w])/g, /دولار/g, /\}\s*\$['"`]/g, /(?<![\u0600-\u06FF])ريال(?![\u0600-\u06FF])/g];
const walk = (d: string, out: string[] = []): string[] => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };
const files = walk(APP).filter(f => /\.(ts|html)$/.test(f) && !/\.spec\.ts$|test-fixtures/.test(f) && !f.endsWith(join('core', 'utils', 'currency.ts')));

describe('currency literals (zero tolerance)', () => {
	it('no production file types a currency symbol or name by hand', () => {
		const offenders: string[] = [];
		for (const f of files) { const t = readFileSync(f, 'utf-8'); const n = PATTERNS.reduce((s, re) => s + (t.match(re)?.length ?? 0), 0); if (n) offenders.push(`${relative(APP, f)}: ${n}`); }
		expect(offenders, `hand-typed currencies - use the money pipes / formatAmount / formatBase:\n${offenders.join('\n')}`).toEqual([]);
	});
});
