/// <reference types="node" />

// Regression guard for the Arabic text-clipping fix (docs/ui-arabic-text-clipping.md).
// Static assertions over the raw CSS - no rendering - so it also runs in the
// project's jsdom setup. The visual proof (Playwright clip detector) is
// described in the doc; this spec keeps the *causes* from coming back:
//   1. the bundled Arabic font must keep its normalised vertical metrics,
//   2. the shared safety-net utilities must exist,
//   3. the components that actually clipped keep their breathing room,
//   4. no NEW single-line-ellipsis / line-clamp rule may combine overflow
//      clipping with a tight line-height (existing ones are allow-listed and
//      should be burned down, never extended).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');           // .../src
const ROOT = join(SRC, '..');                 // project root
const read = (p: string) => readFileSync(p, 'utf-8');

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) { if (name !== 'node_modules') walk(full, out); }
		else if (full.endsWith('.css')) out.push(full);
	}
	return out;
}

const stylesCss = read(join(SRC, 'styles.css'));

describe('Arabic text vertical safety - font metrics', () => {
	const faces = stylesCss.match(/@font-face\s*\{[^}]*\}/g) ?? [];
	const localTajawal = faces.filter(f => /font-family:\s*'Tajawal'/.test(f) && /\/assets\/fonts\//.test(f));

	it('declares both bundled DIN Next LT Arabic faces (regular + bold)', () => {
		expect(localTajawal.length).toBe(2);
		expect(localTajawal.some(f => /Regular/.test(f))).toBe(true);
		expect(localTajawal.some(f => /Bold/.test(f))).toBe(true);
	});

	it('normalises the vertical metrics of every bundled face (ascent/descent/line-gap overrides)', () => {
		for (const face of localTajawal) {
			expect(face).toMatch(/ascent-override:\s*98%/);
			expect(face).toMatch(/descent-override:\s*40%/);
			expect(face).toMatch(/line-gap-override:\s*0%/);
		}
	});
});

describe('Arabic text vertical safety - shared safety net', () => {
	it('keeps the zero-specificity ellipsis/clamp utilities with layout-neutral padding', () => {
		expect(stylesCss).toMatch(/:where\(\.truncate,\s*\.ws-text-safe\)\s*\{\s*padding-block:\s*\.12em;\s*margin-block:\s*-\.12em;\s*\}/);
		expect(stylesCss).toMatch(/:where\(\[class\*="line-clamp-"\]\)\s*\{\s*padding-top:\s*\.12em;\s*margin-top:\s*-\.12em;\s*\}/);
	});
});

describe('Arabic text vertical safety - components that clipped', () => {
	const rule = (file: string, selector: string): string => {
		const css = read(join(SRC, file));
		const idx = css.indexOf(selector + '{');
		expect(idx, `${selector} not found in ${file}`).toBeGreaterThan(-1);
		return css.slice(idx, css.indexOf('}', idx));
	};
	const lh = (r: string) => Number(/line-height:\s*([0-9.]+)/.exec(r)?.[1] ?? 'NaN');

	it('marketplace quick-category strip: labels have line-height >= 1.4 and the scroller has vertical room', () => {
		const name = rule('app/pages/website/marketplace/marketplace.css', 'app-marketplace .mk-home .qcat-name');
		expect(lh(name)).toBeGreaterThanOrEqual(1.4);
		const inner = rule('app/pages/website/marketplace/marketplace.css', 'app-marketplace .mk-home .quick-cats-inner');
		expect(inner).toMatch(/padding:\s*4px 20px/);
		expect(inner).toMatch(/margin-block:\s*-4px/);
	});

	it('marketplace clamped service title: line-height >= 1.4 and top room only', () => {
		const r = rule('app/pages/website/marketplace/marketplace.css', 'app-marketplace .mk-home .svc-title');
		expect(lh(r)).toBeGreaterThanOrEqual(1.4);
		expect(r).toMatch(/padding-top:\s*\.12em/);
		expect(r).not.toMatch(/padding-bottom|padding-block/); // a bottom padding would reveal the clamped 3rd line
	});

	it('category-guide mini name and the account name in both navs keep room above/below the ellipsis', () => {
		const mini = rule('app/pages/website/marketplace/category-guide/category-guide.css', 'app-category-guide .mini-name');
		expect(lh(mini)).toBeGreaterThanOrEqual(1.4);
		expect(mini).toMatch(/padding-block:\s*\.12em/);
		for (const f of ['app/sheards/navbar/navbar.css', 'app/sheards/dashboard/nav-dashboard/nav-dashboard.css']) {
			const r = rule(f, '.udrop-acc-name');
			expect(lh(r)).toBeGreaterThanOrEqual(1.4);
			expect(r).toMatch(/padding-block:\s*\.1em/);
		}
	});
});

describe('Arabic text vertical safety - no NEW tight clipped text', () => {
	// Every existing rule was fixed when this guard was added, so the allow-list
	// is empty. Never add to it - give new rules line-height >= 1.4, padding
	// room, or use the shared utilities (.truncate / .ws-text-safe).
	const LEGACY_ALLOWLIST = new Set<string>([]);

	const violations: string[] = [];
	for (const file of [...walk(join(SRC, 'app')), join(SRC, 'styles.css'), join(SRC, 'waseet-design-system.css'), ...walk(join(ROOT, 'public', 'assets'))]) {
		const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
		for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
			const selector = m[1].trim().replace(/\s+/g, ' ');
			const body = m[2];
			const clips = /text-overflow:\s*ellipsis/.test(body) || /-webkit-line-clamp/.test(body);
			if (!clips) continue;
			const lhm = /(?:^|[;\s])line-height:\s*([0-9.]+)\s*(?:!important)?\s*(?:;|$)/.exec(body);
			if (!lhm) continue; // inherits the page default (1.5)
			if (Number(lhm[1]) >= 1.4) continue;
			const hasRoom = /padding-(block|top|bottom)/.test(body);
			if (hasRoom) continue;
			violations.push(`${relative(ROOT, file)} :: ${selector}`);
		}
	}

	it('introduces no clipped Arabic text rule with line-height < 1.4 outside the allow-list', () => {
		const fresh = violations.filter(v => !LEGACY_ALLOWLIST.has(v));
		expect(fresh, 'New rules combine ellipsis/line-clamp with a tight line-height:\n' + fresh.join('\n')).toEqual([]);
	});

	it('the allow-list only contains rules that still exist (so it can only shrink)', () => {
		const stale = [...LEGACY_ALLOWLIST].filter(v => !violations.includes(v));
		expect(stale, 'Remove fixed rules from the allow-list:\n' + stale.join('\n')).toEqual([]);
	});
});
