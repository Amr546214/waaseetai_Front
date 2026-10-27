/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// BE registry (sibling worktree) vs this front end: the token defaults the server shows / drops as "equal to default" must be what the site really renders.
const CANDIDATES = [join(process.cwd(), '../wt-be-id/src/config/site-identity-tokens.ts'), join(process.cwd(), '../sc-be-team/src/config/site-identity-tokens.ts'), join(process.cwd(), '../../wt-be-id/src/config/site-identity-tokens.ts')];
const REG = CANDIDATES.find(existsSync);
const GOLDEN = JSON.parse(readFileSync(join(__dirname, 'identity-tokens.effective.golden.json'), 'utf8')) as { dark: Record<string, string>; light: Record<string, string>; knownBeDrift: string[] };
const STYLES = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

/** same normalisation as the BE guard: lower-case, no whitespace, trailing zeros of decimals dropped (`.10` -> `.1`); `#fff` and `#ffffff` are NOT equal */
const norm = (v: string): string => v.toLowerCase().replace(/\s+/g, '').replace(/(\.\d*?)0+(?=\D|$)/g, '$1').replace(/\.(?=\D|$)/g, '');
/** the declarations of the first block that starts with `selector{` */
function block(css: string, selector: string): Record<string, string> {
	const i = css.indexOf(selector + '{') >= 0 ? css.indexOf(selector + '{') : css.indexOf(selector + ' {');
	if (i < 0) return {};
	const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
	const out: Record<string, string> = {};
	for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);?/g)) out[m[1]] = m[2].trim();
	return out;
}
interface BeTok { name: string; dark: string; light?: string; scope: string }
function parseBe(src: string): BeTok[] {
	const out: BeTok[] = [];
	for (const m of src.matchAll(/\b[cp]\('(--[a-z0-9-]+)',\s*'[^']*',\s*'([^']*)'(?:,\s*'([^']*)')?\)/g)) out.push({ name: m[1], dark: m[2], light: m[3], scope: 'color' });
	for (const m of src.matchAll(/\{\s*name:\s*'(--[a-z0-9-]+)',\s*type:\s*'[a-z-]+',\s*scope:\s*'(color|layout|typography)',\s*label:\s*'[^']*',\s*dark:\s*(?:'([^']*)'|"([^"]*)")(?:,\s*light:\s*'([^']*)')?/g)) out.push({ name: m[1], dark: m[3] ?? m[4], light: m[5], scope: m[2] });
	return out;
}

describe('design-token defaults: BE registry == what the front end ships', () => {
	const root = block(STYLES, ':root'), light = block(STYLES, '.theme-light');
	it('styles.css still declares the central layer the registry mirrors (37 in :root, 29 colour-like redefined by .theme-light)', () => {
		expect(Object.keys(root).length).toBe(37);
		expect(Object.keys(light).length).toBeGreaterThanOrEqual(29);
	});
	it.skipIf(!REG)('every BE token default equals the styles.css value (dark = :root, light = .theme-light, else the dark value) after the shared normalisation', () => {
		const be = parseBe(readFileSync(REG!, 'utf8'));
		expect(be.length).toBe(38);
		const drift: string[] = [];
		for (const t of be) {
			if (t.name === '--font-family') continue; // not in styles.css (design-system file defines it; see the golden test below)
			if (norm(root[t.name] ?? '<missing>') !== norm(t.dark)) drift.push(`dark ${t.name}: styles.css=${root[t.name]} be=${t.dark}`);
			if (t.light !== undefined && norm(light[t.name] ?? '<missing>') !== norm(t.light)) drift.push(`light ${t.name}: styles.css=${light[t.name]} be=${t.light}`);
			if (t.light === undefined && t.scope === 'color' && light[t.name] !== undefined) drift.push(`light ${t.name}: styles.css redefines it but the BE says shared`);
		}
		expect(drift).toEqual([]);
		for (const n of Object.keys(root)) expect(be.some(t => t.name === n), `${n} is declared in :root but not in the BE registry`).toBe(true);
	});
	it.skipIf(REG)('SKIPPED: BE registry not found beside this checkout', () => { expect(REG).toBeUndefined(); });

	// What the BROWSER computes on the production build (all stylesheets, both themes) - measured by tools in the evidence folder; refreshed when styles change.
	it.skipIf(!REG)('EFFECTIVE defaults: the BE default of every colour / layout token equals the golden computed value of the production build, except the listed known drift (reported to the BE owner)', () => {
		const be = parseBe(readFileSync(REG!, 'utf8'));
		const g = GOLDEN;
		const drift: string[] = [];
		for (const t of be) {
			if (t.scope === 'typography') continue;
			const d = g.dark[t.name], l = g.light[t.name];
			if (norm(d ?? '') !== norm(t.dark) && norm(expandHex(d ?? '')) !== norm(expandHex(t.dark))) drift.push(`dark ${t.name}`);
			const beLight = t.light ?? t.dark;
			if (norm(l ?? '') !== norm(beLight) && norm(expandHex(l ?? '')) !== norm(expandHex(beLight))) drift.push(`light ${t.name}`);
		}
		const unknown = drift.filter(x => !g.knownBeDrift.includes(x));
		expect(unknown, 'a BE default drifted from the real computed default and is not on the known list').toEqual([]);
	});
	it('the golden covers every :root token in both themes and lists --font-family', () => {
		const g = GOLDEN;
		for (const n of Object.keys(root)) { expect(g.dark[n], 'dark ' + n).toBeTruthy(); expect(g.light[n], 'light ' + n).toBeTruthy(); }
		expect(g.dark['--font-family']).toBeTruthy();
	});
});
/** #abc -> #aabbcc (the browser normalises shorthand hex only in some serialisations) */
function expandHex(v: string): string { return /^#[0-9a-f]{3}$/i.test(v.trim()) ? '#' + v.trim().slice(1).split('').map(c => c + c).join('') : v; }
