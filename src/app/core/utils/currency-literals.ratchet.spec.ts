/// <reference types="node" />
// RATCHET: a hand-typed currency in a money display ("… $", "… دولار") is a place that cannot show a record in another currency. The central formatter (currency.ts) prints the currency of the RECORD;
// this check counts the remaining hand-typed ones per file and forbids more of them. It can only go DOWN: convert a screen (wsAmount / money pipe with the record's currency) and shrink the baseline.
// Regenerate on purpose (a reviewer sees the diff):  CURRENCY_LITERALS_UPDATE=1 npx ng test --include='**/currency-literals.ratchet.spec.ts' --watch=false
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const APP = join(__dirname, '..', '..');
const BASELINE = join(__dirname, 'currency-literals.baseline.json');
const PATTERNS = [/\}\}\s*\$(?![\{\w])/g, /(?<![\w\$\{])\$\s*\{\{/g, /['"`]\s*\$['"`]/g, /[\w\)\]]\s*\+\s*['"`] ?\$['"`]/g, /\s\$\s*</g, /\d\s*\$(?![\{\w])/g, /دولار/g, /\}\s*\$['"`]/g];
const walk = (d: string, out: string[] = []): string[] => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };
const files = walk(APP).filter(f => /\.(ts|html)$/.test(f) && !/\.spec\.ts$|test-fixtures/.test(f) && !f.endsWith(join('core', 'utils', 'currency.ts')));
const current: Record<string, number> = {};
for (const f of files) { const t = readFileSync(f, 'utf-8'); const n = PATTERNS.reduce((s, re) => s + (t.match(re)?.length ?? 0), 0); if (n) current[relative(APP, f)] = n; }
if (process.env['CURRENCY_LITERALS_UPDATE'] === '1') writeFileSync(BASELINE, JSON.stringify(Object.fromEntries(Object.entries(current).sort()), null, 1) + '\n');
const base: Record<string, number> = JSON.parse(readFileSync(BASELINE, 'utf-8'));

describe('currency literals ratchet', () => {
	it('no file gains a hand-typed currency in a money display (the count per file can only go down)', () => {
		const worse = Object.entries(current).filter(([f, n]) => n > (base[f] ?? 0)).map(([f, n]) => `${f}: ${n} > ${base[f] ?? 0}`);
		expect(worse, `more hand-typed currencies than the baseline - show the record's currency with the wsAmount / money pipe instead:\n${worse.join('\n')}`).toEqual([]);
	});
	it('the baseline has no stale entries (a converted file is removed from it)', () => {
		const stale = Object.keys(base).filter(f => !(f in current));
		expect(stale, `remove from the baseline: ${stale.join(', ')}`).toEqual([]);
	});
});
