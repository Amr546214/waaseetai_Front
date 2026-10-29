/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * GUARD (Round 9): no component stylesheet may carry an UNJUSTIFIED local copy of a registered design token.
 *
 * Why: an edit of a platform token (--txt, --crd-bg, --teal ...) is written on <html>; a component that re-declares the same name in its own scope
 * (`app-login{--txt:#FFFFFF}`) is an island the edit never reaches. Round 8 removed the copies whose value EQUALS the platform's; Round 9 turned every
 * intentional difference into ONE named semantic variable (identity-semantic-tokens.json, defined in styles.css) that the page maps to (`--txt:var(--pub-txt)`).
 *
 * What fails:
 *   - a declaration of a registered/semantic name in a LOADED stylesheet whose value is a literal (or an alias of anything else) and that is not in
 *     identity-token-copies.allowlist.json,
 *   - a mapping to a semantic variable that does not replace that token (e.g. `--txt:var(--soft-bd)`),
 *   - an allow-list entry that no longer matches a real declaration, an orphan stylesheet that gained a loader or lost its copies,
 *   - drift between the semantic manifest (what the BE registry must mirror) and styles.css / the platform golden values.
 * The scanner itself is exercised on fixtures (a violation is detected, the allowed forms pass) and on a mutation of a REAL stylesheet, so the guard is not a repetition of the implementation.
 */
const SRC = join(__dirname, '../../..');
const APP = join(SRC, 'app');
const ROOT = join(SRC, '..');
const GOLDEN = JSON.parse(readFileSync(join(__dirname, 'identity-tokens.effective.golden.json'), 'utf8')) as { dark: Record<string, string>; light: Record<string, string> };
interface SemTok { name: string; type: string; label: string; dark: string; light: string; derivedDark: string | null; derivedLight: string | null; usedBy: string[]; replaces: string[]; reason: string }
const SEM = (JSON.parse(readFileSync(join(__dirname, 'identity-semantic-tokens.json'), 'utf8')) as { tokens: SemTok[] }).tokens;
const ALLOW = JSON.parse(readFileSync(join(__dirname, 'identity-token-copies.allowlist.json'), 'utf8')) as { entries: { file: string; tokens: string[]; kind: string; reason: string }[]; orphanCss: { file: string; reason: string }[] };
const PLATFORM = new Set([...Object.keys(GOLDEN.dark), ...Object.keys(GOLDEN.light)]);
const SEMANTIC = new Set(SEM.map(t => t.name));
const REGISTERED = new Set([...PLATFORM, ...SEMANTIC]);
const DEFINITIONS = new Set(['src/styles.css', 'src/waseet-design-system.css']); // the platform layer itself

// ---------------------------------------------------------------- scanner
const norm = (v: string): string => v.toLowerCase().replace(/\s+/g, '').replace(/(\.\d*?)0+(?=\D|$)/g, '$1').replace(/\.(?=\D|$)/g, '');
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, c => ' '.repeat(c.length));
export interface Decl { selector: string; name: string; value: string }
/** every `--name: value` declaration inside an innermost rule body (comments ignored) */
export function declarations(css: string): Decl[] {
	const out: Decl[] = []; const text = stripComments(css); const re = /([^{}]*)\{([^{}]*)\}/g; let m: RegExpExecArray | null;
	while ((m = re.exec(text))) { const d = /(?:^|[;\s])(--[a-z0-9-]+)\s*:\s*([^;}]+)/g; let x: RegExpExecArray | null; while ((x = d.exec(m[2]))) out.push({ selector: m[1].trim().replace(/\s+/g, ' '), name: x[1], value: x[2].trim() }); }
	return out;
}
/** a declaration is fine only as `--token: var(--semantic)` where that semantic variable is declared to REPLACE this token */
export function judge(d: Decl): 'ok' | 'not-registered' | { problem: string } {
	if (!REGISTERED.has(d.name)) return 'not-registered';
	const ref = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(d.value);
	if (!ref) return { problem: `${d.name}: ${d.value}  (literal or non-semantic alias; selector "${d.selector.slice(0, 60)}")` };
	const sem = SEM.find(t => t.name === ref[1]);
	if (!sem) return { problem: `${d.name}: ${d.value}  (${ref[1]} is not a semantic variable of identity-semantic-tokens.json)` };
	if (!sem.replaces.includes(d.name)) return { problem: `${d.name}: ${d.value}  (${sem.name} replaces ${sem.replaces.join(', ')}, not ${d.name})` };
	return 'ok';
}
const walk = (dir: string, out: string[] = []): string[] => { for (const n of readdirSync(dir)) { if (n === 'node_modules') continue; const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };
const rel = (f: string): string => relative(ROOT, f).split('\\').join('/');
/** stylesheets some component (or angular.json / an @import of a loaded sheet) really loads */
export function loadedStylesheets(): Set<string> {
	const loaded = new Set<string>();
	for (const f of walk(APP).filter(f => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
		const t = readFileSync(f, 'utf8');
		for (const m of t.matchAll(/styleUrls?\s*:\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)) for (const p of m[1].matchAll(/['"]([^'"]+\.css)['"]/g)) loaded.add(rel(resolve(dirname(f), p[1])));
	}
	const ng = JSON.parse(readFileSync(join(ROOT, 'angular.json'), 'utf8')); const s = JSON.stringify(ng);
	for (const m of s.matchAll(/"(src\/[^"]+\.css)"/g)) loaded.add(m[1]);
	for (let again = true; again;) { again = false; for (const f of [...loaded]) { const p = join(ROOT, f); if (!existsSync(p)) continue; for (const m of readFileSync(p, 'utf8').matchAll(/@import\s+(?:url\()?['"]([^'"]+\.css)['"]/g)) { const r = rel(resolve(dirname(p), m[1])); if (!loaded.has(r)) { loaded.add(r); again = true; } } } }
	return loaded;
}
export function violations(files: Iterable<string>, allow = ALLOW.entries): string[] {
	const bad: string[] = [];
	for (const f of files) {
		if (DEFINITIONS.has(f)) continue; const p = join(ROOT, f); if (!existsSync(p)) continue;
		for (const d of declarations(readFileSync(p, 'utf8'))) {
			const j = judge(d); if (j === 'ok' || j === 'not-registered') continue;
			if (allow.some(a => a.file === f && a.tokens.includes(d.name))) continue;
			bad.push(`${f}: ${j.problem}`);
		}
	}
	return bad;
}

// ---------------------------------------------------------------- the guard on the real tree
const LOADED = loadedStylesheets();
const ALL_CSS = walk(APP).filter(f => f.endsWith('.css')).map(rel);
describe('no unjustified local copy of a registered design token (loaded component stylesheets)', () => {
	it('every loaded stylesheet either consumes the platform token or maps it to its semantic variable', () => {
		const files = ALL_CSS.filter(f => LOADED.has(f));
		expect(files.length, 'the scan must really see the component stylesheets').toBeGreaterThan(250);
		expect(violations(files), 'a component re-declares a registered token (an edit of the platform token would not reach it). Consume the platform token, or add ONE named semantic variable to identity-semantic-tokens.json + styles.css').toEqual([]);
	});
	it('inline <style>/styles:[…]/style="…" in templates and components do not re-declare registered tokens either', () => {
		const bad: string[] = [];
		for (const f of walk(APP).filter(f => /\.(html|ts)$/.test(f) && !f.endsWith('.spec.ts') && !/site-control\//.test(f))) {
			const t = readFileSync(f, 'utf8');
			const chunks = [...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).concat([...t.matchAll(/styles\s*:\s*\[\s*`([\s\S]*?)`\s*\]/g)].map(m => m[1])).concat([...t.matchAll(/style="([^"]*)"/g)].map(m => `x{${m[1]}}`));
			for (const c of chunks) for (const d of declarations(/\{/.test(c) ? c : `x{${c}}`)) { const j = judge(d); if (j !== 'ok' && j !== 'not-registered') bad.push(`${rel(f)}: ${j.problem}`); }
		}
		expect(bad).toEqual([]);
	});
	it('stylesheets that NO component loads (orphans) are exactly the documented ones, and they still hold the copies the allow-list says', () => {
		const orphansWithCopies = ALL_CSS.filter(f => !LOADED.has(f) && !DEFINITIONS.has(f) && declarations(readFileSync(join(ROOT, f), 'utf8')).some(d => { const j = judge(d); return j !== 'ok' && j !== 'not-registered'; }));
		expect(orphansWithCopies.sort()).toEqual(ALLOW.orphanCss.map(o => o.file).sort());
		for (const o of ALLOW.orphanCss) expect(o.reason.length, o.file).toBeGreaterThan(40);
	});
	it('the allow-list has no stale or unexplained entry', () => {
		for (const e of ALLOW.entries) {
			expect(e.reason.length, `${e.file}: a justification is required`).toBeGreaterThan(40);
			expect(existsSync(join(ROOT, e.file)), `${e.file} no longer exists`).toBe(true);
			expect(LOADED.has(e.file), `${e.file} is not loaded - an orphan belongs in orphanCss`).toBe(true);
			const ds = declarations(readFileSync(join(ROOT, e.file), 'utf8'));
			for (const t of e.tokens) expect(ds.some(d => d.name === t && judge(d) !== 'ok'), `${e.file}: no remaining copy of ${t} - remove the entry`).toBe(true);
		}
	});
});

// ---------------------------------------------------------------- the scanner is not a tautology
describe('the guard bites (scanner fixtures + a mutation of a real stylesheet)', () => {
	it('flags a literal, an alias of another platform token, a foreign var() and a semantic variable that does not replace the token', () => {
		const css = 'app-x{--txt:#123456} app-y{--crd-bg:var(--txt)} app-z{--txt:var(--nope)} app-w{--txt:var(--soft-bd)} app-v{--pub-txt:#fff}';
		const bad = declarations(css).map(d => ({ d, j: judge(d) })).filter(x => typeof x.j === 'object');
		expect(bad.map(x => x.d.name)).toEqual(['--txt', '--crd-bg', '--txt', '--txt', '--pub-txt']);
	});
	it('accepts the sanctioned forms and ignores everything else', () => {
		expect(declarations('app-x{--txt:var(--pub-txt);--cta-shd:0 1px #000;--teal:var(--brand-teal)} /* app-y{--txt:#000} */').map(d => judge(d))).toEqual(['ok', 'not-registered', 'ok']);
	});
	it('a copy injected into a REAL loaded stylesheet is caught (login.css), the untouched file is clean', () => {
		const f = 'src/app/pages/auth/login/login.css'; const real = readFileSync(join(ROOT, f), 'utf8');
		expect(declarations(real).filter(d => judge(d) !== 'ok' && judge(d) !== 'not-registered')).toEqual([]);
		const mutated = real.replace('app-login{', 'app-login{--txt:#FFFFFF;');
		expect(mutated).not.toBe(real);
		expect(declarations(mutated).filter(d => { const j = judge(d); return j !== 'ok' && j !== 'not-registered'; }).map(d => d.name)).toEqual(['--txt']);
	});
	it('an allow-list entry silences exactly its file and token, nothing wider', () => {
		const f = 'src/app/pages/dashboard/provider-overview/disputes/disputes.css';
		expect(violations([f], []).length).toBeGreaterThan(0);
		expect(violations([f], [{ file: f, tokens: ['--txt-3'], kind: 'test', reason: 'x'.repeat(50) }]).some(v => /--txt-3/.test(v))).toBe(false);
		expect(violations([f], [{ file: f, tokens: ['--txt-3'], kind: 'test', reason: 'x'.repeat(50) }]).length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------- the semantic manifest == styles.css == platform golden
describe('semantic variables: manifest, styles.css and the platform golden agree', () => {
	const css = readFileSync(join(SRC, 'styles.css'), 'utf8');
	const block = (selector: RegExp): Record<string, string> => {
		const out: Record<string, string> = {}; const text = stripComments(css); const re = new RegExp(`${selector.source}\\s*\\{([^{}]*)\\}`, 'g'); let m: RegExpExecArray | null;
		while ((m = re.exec(text))) for (const d of m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);?/g)) out[d[1]] = d[2].trim();
		return out;
	};
	// the semantic block starts after its own comment banner (the central :root / .theme-light layer above it is the platform's)
	const startOfSemantic = css.indexOf('IDENTITY SEMANTIC VARIABLES');
	const semCss = css.slice(startOfSemantic, css.indexOf("body{margin:0;font-family", startOfSemantic));
	const rootSem = (() => { const o: Record<string, string> = {}; const m = /:root\{([^{}]*)\}/.exec(stripComments(semCss)); for (const d of (m?.[1] ?? '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);?/g)) o[d[1]] = d[2].trim(); return o; })();
	const lightSem = (() => { const o: Record<string, string> = {}; const m = /\.theme-light,\.light-theme\{([^{}]*)\}/.exec(stripComments(semCss)); for (const d of (m?.[1] ?? '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);?/g)) o[d[1]] = d[2].trim(); return o; })();
	void block;
	it('styles.css defines exactly the manifest names, in :root (dark) and in .theme-light/.light-theme (light)', () => {
		expect(startOfSemantic).toBeGreaterThan(0);
		expect(Object.keys(rootSem).sort()).toEqual([...SEMANTIC].sort());
		expect(Object.keys(lightSem).sort()).toEqual([...SEMANTIC].sort());
	});
	it('a derived default is var(--platform token) and its recorded value is the platform golden value; a literal default is the recorded value', () => {
		const wrong: string[] = [];
		for (const t of SEM) for (const th of ['dark', 'light'] as const) {
			const cssVal = (th === 'dark' ? rootSem : lightSem)[t.name]; const derived = th === 'dark' ? t.derivedDark : t.derivedLight; const recorded = t[th];
			if (derived) {
				if (cssVal !== `var(${derived})`) wrong.push(`${th} ${t.name}: css=${cssVal} manifest derives from ${derived}`);
				// the golden is measured on <html>; --txt-like platform values differing on <body> are not derived from here (none today)
				const g = GOLDEN[th][derived]; if (norm(g) !== norm(recorded) && norm(expandHex(g)) !== norm(expandHex(recorded))) wrong.push(`${th} ${t.name}: golden ${derived}=${g} but manifest says ${recorded}`);
			} else if (norm(cssVal ?? '') !== norm(recorded)) wrong.push(`${th} ${t.name}: css=${cssVal} manifest=${recorded}`);
		}
		expect(wrong).toEqual([]);
	});
	it('every semantic variable is mapped by at least one loaded stylesheet and no loaded stylesheet maps a variable the manifest does not know', () => {
		const used = new Map<string, Set<string>>();
		for (const f of ALL_CSS.filter(f => LOADED.has(f))) for (const d of declarations(readFileSync(join(ROOT, f), 'utf8'))) { const m = /^var\((--[a-z0-9-]+)\)$/.exec(d.value); if (m && REGISTERED.has(d.name)) { if (!used.has(m[1])) used.set(m[1], new Set()); used.get(m[1])!.add(f); } }
		for (const t of SEM) expect(used.get(t.name)?.size ?? 0, `${t.name} is declared but no stylesheet uses it`).toBeGreaterThan(0);
		for (const k of used.keys()) expect(SEMANTIC.has(k), `${k} is mapped by a stylesheet but missing in the manifest`).toBe(true);
		// the manifest's "usedBy" names are real: each lists a stylesheet whose path contains it (checkout-* = the shared checkout-tokens sheet)
		for (const t of SEM) for (const u of t.usedBy) { const needle = u.replace('-*', ''); expect([...(used.get(t.name) ?? [])].some(f => f.includes(needle)), `${t.name}: usedBy "${u}" matches no stylesheet that maps it`).toBe(true); }
	});
	it('the semantic names do not collide with the 38 platform tokens, and each replaces only platform tokens', () => {
		for (const t of SEM) { expect(PLATFORM.has(t.name), t.name).toBe(false); for (const r of t.replaces) expect(PLATFORM.has(r), `${t.name} replaces ${r}`).toBe(true); expect(t.label.length).toBeGreaterThan(5); }
	});
	// BE registry mirror: while the BE has not been given the names yet this test only reports; the moment it has, the defaults must match
	const BE = [join(ROOT, '../wt-be-id/src/config/site-identity-tokens.ts'), join(ROOT, '../sc-be-team/src/config/site-identity-tokens.ts')].find(existsSync);
	it.skipIf(!BE)('names that the BE registry already holds carry exactly the manifest defaults (dark/light)', () => {
		const be = readFileSync(BE!, 'utf8'); const bad: string[] = [];
		for (const t of SEM) { const m = new RegExp(`['"]${t.name}['"],\\s*['"][^'"]*['"],\\s*['"]([^'"]*)['"](?:,\\s*['"]([^'"]*)['"])?`).exec(be); if (!m) continue; const d = m[1], l = m[2] ?? m[1]; if (norm(d) !== norm(t.dark)) bad.push(`dark ${t.name}: be=${d} manifest=${t.dark}`); if (norm(l) !== norm(t.light)) bad.push(`light ${t.name}: be=${l} manifest=${t.light}`); }
		expect(bad).toEqual([]);
	});
});
function expandHex(v: string): string { return /^#[0-9a-f]{3}$/i.test(v.trim()) ? '#' + v.trim().slice(1).split('').map(c => c + c).join('') : v; }
