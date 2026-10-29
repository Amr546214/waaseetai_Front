/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CSS_BOUND_ICONS } from './identity-icon-symbols';
import { INLINE_ICON_IDS, INLINE_ICON_SYMBOLS } from './identity-inline-icons';

// Round 9 guards: every drawing in a template / sidebar item / TS table that looks like an icon either FOLLOWS a key (data-ws-icon / ws / wsIcon) or is listed with its exact reason; every `pl-*` key written in the code
// exists in the registry (and the other way round), the registry matches the library file and the generator, and the CSS arrows read the same colours the runtime publishes.
const ROOT = join(__dirname, '../../../../');
const req = createRequire(join(ROOT, 'package.json'));
const inline = req('./tools/inline-icon-keys.cjs');
const nav = req('./tools/nav-icon-keys.cjs');
const walk = (dir: string, out: string[] = []): string[] => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(html|ts|css)$/.test(n) && !/\.spec\.ts$|\.d\.ts$/.test(n)) out.push(p); } return out; };
const ids = new Set<string>(INLINE_ICON_IDS);

describe('inline icon keys (registry, places, sidebar, CSS)', () => {
	it('every inline <svg> drawing is bound or excluded by a documented rule (run: node tools/inline-icon-keys.cjs --write)', () => {
		const pl = inline.plan();
		expect(pl.assign.map((a: { p: { f: string; line: number } }) => `${a.p.f}:${a.p.line}`)).toEqual([]);
		expect(pl.excluded.filter((e: { excluded: string }) => e.excluded === 'UNNAMED').map((e: { p: { f: string; line: number } }) => `${e.p.f}:${e.p.line}`)).toEqual([]);
		for (const e of pl.excluded as { excluded: string; why: string }[]) { expect(['DYNAMIC', 'AI_MARK', 'NOT_AN_ICON']).toContain(e.excluded); expect(e.why.length).toBeGreaterThan(10); }
	}, 120_000);

	it('every sidebar item that has an icon has a ws key (run: node tools/nav-icon-keys.cjs --write)', () => {
		expect(nav.plan().filter((p: { key?: string }) => p.key).length).toBe(0);
		expect(nav.plan().filter((p: { excluded?: string }) => p.excluded).length).toBe(0);
	});

	it('every `pl-*` key written in the code is in the registry and every registry key is used at least once', () => {
		const used = new Map<string, number>(); const asKey = new Set<string>();
		for (const f of walk(join(ROOT, 'src/app'))) {
			if (f.includes('/core/identity/identity-inline-icons.ts')) continue;
			const t = readFileSync(f, 'utf8');
			for (const m of t.matchAll(/['"`](pl-(?:site|auth|errors|assistant|client|provider|marketer|admin|shared|nav|notify)-[a-z0-9-]+)['"`]/g)) used.set(m[1], (used.get(m[1]) ?? 0) + 1);
			// only a name written where a KEY is expected must exist (a CSS class such as pl-client-lbl is not one)
			for (const m of t.matchAll(/(?:data-ws-icon="|wsIcon="|\bws: '|return ')(pl-[a-z0-9-]+)['"]/g)) asKey.add(m[1]);
		}
		expect([...asKey].filter(k => !ids.has(k))).toEqual([]);
		expect([...ids].filter(k => !used.has(k))).toEqual([]);
	});

	it('the registry is well formed: unique valid ids (never the AI rule), a drawn shape and a viewBox each, an Arabic label, one library slot each', () => {
		const lib = JSON.parse(readFileSync(join(ROOT, 'public/assets/site-control/icons.json'), 'utf8')) as { libraries: { id: string; icons: { slot: string; label: string }[] }[] };
		const slots = new Map<string, string>(); for (const l of lib.libraries) for (const i of l.icons) slots.set(i.slot, i.label);
		const syms = [...INLINE_ICON_SYMBOLS.matchAll(/<symbol id="([^"]+)" viewBox="([^"]+)"[^>]*data-label="([^"]*)"[^>]*>([\s\S]*?)<\/symbol>/g)];
		expect(syms.length).toBe(ids.size);
		const seen = new Set<string>();
		for (const [, id, vb, label, inner] of syms) {
			expect(seen.has(id), 'duplicate ' + id).toBe(false); seen.add(id);
			expect(id).toMatch(/^[a-z][a-z0-9-]{0,63}$/); expect(/(^|-)ai$/.test(id), 'AI-named ' + id).toBe(false);
			expect(vb).toMatch(/^\d+ \d+ \d+ \d+$/); expect(inner).toMatch(/<(path|circle|rect|line|polyline|polygon|ellipse)\b/);
			expect(/[؀-ۿ]/.test(label), 'Arabic label ' + id).toBe(true);
			expect(slots.has(id), 'library slot ' + id).toBe(true);
		}
	});

	it('the glyph dictionary keeps the official AI mark out of the function-icon keys (it is followed by geometry and its key is icon.ai)', () => {
		expect(Object.values(inline.GLYPHS as Record<string, { slug: string | null; ai?: boolean }>).filter(g => g.ai).length).toBeGreaterThan(0);
		for (const i of ids) expect(/hub-nodes/.test(i), i).toBe(false);
	});

	it('CSS arrows: every var(--ws-icon-<id>-<hex>, url(...)) reads a colour the runtime publishes and its fallback draws that same colour (default pixels unchanged)', () => {
		const re = /var\(--ws-icon-([a-z0-9-]+?)-([0-9a-f]{6}), url\("data:image\/svg\+xml,[^"]*stroke='%23([0-9A-Fa-f]{6})'[^"]*"\)\)/g;
		let n = 0;
		for (const f of walk(join(ROOT, 'src')).filter(p => p.endsWith('.css'))) {
			const t = readFileSync(f, 'utf8');
			expect((t.match(/--ws-icon-/g) ?? []).length, f).toBe([...t.matchAll(re)].length);
			for (const m of t.matchAll(re)) { n++; expect(m[2], f).toBe(m[3].toLowerCase()); expect(CSS_BOUND_ICONS[m[1]], m[1]).toContain(m[2]); expect(ids.has(m[1]), m[1]).toBe(true); }
		}
		expect(n).toBe(5);
		// and no stylesheet still draws a select arrow with a bare data URI (it would not follow the published icon)
		for (const f of walk(join(ROOT, 'src')).filter(p => p.endsWith('.css'))) expect(/background-image:\s*url\(\s*["']?data:image\/svg/.test(readFileSync(f, 'utf8')), f).toBe(false);
	});
});
