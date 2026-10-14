import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Why: `main.main` (dashboard) and `.page-wrap` (website pages) used to be stacking contexts (z-index:1 / 2). A toast/modal inside them could never rise above the fixed header (z 100 / 50),
// so a toast at top:28px was hidden under the 56px topbar. These guards keep the layering central and fail if a stacking context or an under-the-header toast comes back.
const read = (p: string) => readFileSync(p, 'utf8');
const walk = (dir: string, out: string[] = []): string[] => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };
const rules = (css: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));

describe('overlay layering (central)', () => {
	it('dashboard .main is not a stacking context (no z-index)', () => {
		const main = rules(read('src/app/layouts/dashboard-layout/dashboard-layout.css')).filter(r => /^\.main$/.test(r.sel));
		expect(main.length).toBeGreaterThan(0);
		for (const r of main) expect(r.body).not.toMatch(/z-index\s*:/);
	});
	it('global stylesheet: page wrappers are not stacking contexts, particles stay under content, toast offset variables exist', () => {
		const css = read('src/styles.css');
		expect(css).toMatch(/\.page-wrap\{z-index:auto !important\}/);
		expect(css).toMatch(/\.page-wrap\.filters-open\{z-index:1100 !important\}/);
		expect(css).toMatch(/\.particles\{[^}]*z-index:0/);
		expect(css).toMatch(/--ws-header-h:56px/);
		expect(css).toMatch(/--ws-toast-top:calc\(var\(--ws-header-h\)/);
	});
	it('central notification host: fixed, above every overlay, header-aware, safe-area aware', () => {
		const src = read('src/app/shared/forms/notification-host.component.ts');
		expect(src.match(/z-\[2147483000\]/g)?.length).toBe(2);
		expect(src).toContain('top-[var(--ws-toast-top,12px)]');
		expect(src).toContain('bottom-[var(--ws-toast-bottom,16px)]');
		expect(src.match(/fixed/g)?.length).toBeGreaterThanOrEqual(2);
	});
	it('no page toast sits under the fixed header: every fixed toast rule is either header-aware or at/below 64px, or anchored at the bottom', () => {
		const offenders: string[] = [];
		for (const file of walk('src/app').filter(f => f.endsWith('.css'))) {
			for (const r of rules(read(file))) {
				if (!/toast/i.test(r.sel) || !/position\s*:\s*fixed/.test(r.body)) continue;
				const top = r.body.match(/(?:^|[;\s])top\s*:\s*([^;]+)/);
				if (!top) continue;
				const v = top[1].trim();
				if (/var\(--ws-toast-top/.test(v) || /calc\(/.test(v)) continue;
				const px = parseFloat(v);
				if (Number.isFinite(px) && px < 64) offenders.push(`${file}: ${r.sel} top:${v}`);
			}
		}
		expect(offenders).toEqual([]);
	});
});
