/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Round 7 (2): the central design tokens must reach the places that used to hard-code the value. This guards the steps that were proven pixel-identical in the default state.
const SRC = join(__dirname, '../../..');
const walk = (d: string, out: string[] = []): string[] => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };
const files = walk(SRC).filter(f => /\.(css|html|ts)$/.test(f) && !f.endsWith('.spec.ts') && !/identity-tokens\.effective\.golden/.test(f));
const rel = (f: string) => relative(SRC, f);

describe('light page surface follows --pg', () => {
	const ds = readFileSync(join(SRC, 'waseet-design-system.css'), 'utf8');
	it('--pg-dashboard is derived from --pg on :root and on <html> in the light theme (no literal #eef2fa / #070d24 copy left)', () => {
		expect(ds).toMatch(/:root\s*\{[^}]*--pg-dashboard:\s*var\(--pg\)/);
		expect(ds).toMatch(/html\.light-theme,\s*html\.theme-light\s*\{\s*--pg-dashboard:\s*var\(--pg\);\s*\}/);
		expect(ds).not.toMatch(/--pg-dashboard:\s*#/);
	});
	it('the body rule still reads --pg-dashboard (default colour unchanged: html --pg in light is #EEF2FA)', () => {
		expect(ds).toContain('body.theme-light { background-color: var(--pg-dashboard) !important;');
		expect(readFileSync(join(SRC, 'styles.css'), 'utf8')).toMatch(/html\.light-theme,html\.theme-light,body\.light-theme,body\.theme-light\{\s*--pg:#EEF2FA;/);
	});
});

describe('the platform font reaches every direct Tajawal declaration', () => {
	// allowed literal: the @font-face definitions, the token definition itself, the local panel sandbox (the two admin pages that used Tailwind `font-[Tajawal]` now use font-[family-name:var(--font-family,Tajawal)])
	const ALLOW = (f: string, line: string) => /site-control\//.test(rel(f)) || /^\s*font-family:\s*'Tajawal';\s*$/.test(line) || /--font-(family|sans):/.test(line) || /^\s*(\/\*|\*)/.test(line) || /fonts\.googleapis/.test(line);
	it('no `font-family: Tajawal` declaration is left without var(--font-family, …) outside the allow-list', () => {
		const bad: string[] = [];
		for (const f of files) {
			readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
				for (const m of line.matchAll(/font-family\s*[:=]\s*\\?["']?([^;"'}]*)/g)) {
					if (/Tajawal/.test(m[1]) && !/var\(--font-family/.test(line) && !ALLOW(f, line)) bad.push(`${rel(f)}:${i + 1}`);
				}
			});
		}
		expect(bad).toEqual([]);
	});
	it('no Tailwind arbitrary class pins the family (`font-[Tajawal]`, `font-[\'Tajawal\']`): the admin specialties pages use font-[family-name:var(--font-family,Tajawal)]', () => {
		const bad = files.filter(f => /\.(html|ts)$/.test(f) && !/site-control\//.test(rel(f)) && /font-\[['"]?Tajawal/.test(readFileSync(f, 'utf8'))).map(rel);
		expect(bad).toEqual([]);
		expect(readFileSync(join(SRC, 'app/pages/dashboard/supper-admin-overview/sa-specialties/sa-specialties.html'), 'utf8')).toContain('font-[family-name:var(--font-family,Tajawal)]');
	});
	it('SVG <text> font-family presentation attributes (cannot carry var()) were moved to style', () => {
		for (const f of files) expect(readFileSync(f, 'utf8'), rel(f)).not.toMatch(/font-family="Tajawal/);
	});
});

describe('admin light-mode overrides: text / border literals that equal a token and mean the same thing are bound', () => {
	const css = readFileSync(join(SRC, 'styles.css'), 'utf8');
	const start = css.indexOf('ADMIN DASHBOARD — SHARED LIGHT MODE OVERRIDES');
	const block = css.slice(start, css.indexOf('\n}\n', css.indexOf('.kpi-card, .dash-card', start)) + 3);
	it('secondary text uses --txt-2, borders --border, muted --txt-3, danger --red, success --green, warn --kahr, AI text --ai-txt, accent text --teal-txt', () => {
		for (const t of ['var(--txt-2)', 'var(--border)', 'var(--txt-3)', 'var(--red)', 'var(--green)', 'var(--kahr)', 'var(--ai-txt)', 'var(--teal-txt)']) expect(block).toContain(t);
	});
	it('rules of classes that component-local token copies also style are NOT touched (their local --txt-2/--border differ from the platform value)', () => {
		expect(block).toMatch(/\.pg-btn \{[^}]*color: #475569/);
		expect(block).toMatch(/\.filt-chip, \.fl-chip, \.tab-btn \{[^}]*color: #475569/);
	});
	it('--txt is NOT bound here: its value on <body> (#1e293b) differs from <html> (#0F172A)', () => {
		expect(block).toMatch(/color: #0F172A/);
	});
});

describe('ws-light-polish.js (bell border flip, Round 9)', () => {
	const js = readFileSync(join(SRC, '..', 'public/assets/ws-light-polish.js'), 'utf8');
	it('measures and applies with transitions switched off and always switches them back (a transitioned element must not be read mid-transition)', () => {
		const run = js.slice(js.indexOf('function run()'), js.indexOf('function doRun()'));
		expect(run.indexOf('freezeOn()')).toBeGreaterThan(-1);
		expect(run.indexOf('freezeOn()')).toBeLessThan(run.indexOf('doRun()'));
		expect(run.indexOf('getComputedStyle(document.body)')).toBeGreaterThan(run.indexOf('doRun()'));
		expect(run.indexOf('finally')).toBeGreaterThan(run.indexOf('getComputedStyle(document.body)'));
		expect(run.indexOf('removeChild(fz)')).toBeGreaterThan(run.indexOf('finally'));
		expect(js).toContain("transition:none!important");
	});
	it('does not re-declare registered tokens on <body> (equal to the platform value, dead behind html.theme-light body)', () => {
		expect(js).not.toMatch(/body\{--(teal-txt|ai-txt|kahr)/);
	});
});
