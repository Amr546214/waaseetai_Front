/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../../../../../../');
const require_ = createRequire(join(ROOT, 'package.json'));
const A = (f: string) => JSON.parse(readFileSync(join(ROOT, 'public/assets/site-control/', f), 'utf8'));
describe('icon usage report (used vs unused, bound vs unbound)', () => {
	it('is up to date with the sources (run: node tools/icon-usage-report.cjs --write)', () => {
		expect(JSON.stringify(A('icon-usage.json'))).toBe(JSON.stringify(require_('./tools/icon-usage-report.cjs').build()));
	}, 120_000);
	it('classifies every real icon exactly once with one of the three statuses', () => {
		const u = A('icon-usage.json'); const real = A('real-icons.json').icons;
		for (const id of Object.keys(real)) expect(['BOUND', 'USED_UNBOUND', 'UNUSED'], id).toContain(u.icons[id]?.status);
	});
	it('no slot is an EMPTY card: every real icon and every library slot has a drawn shape', () => {
		const shape = /<(path|circle|rect|line|polyline|polygon|ellipse)\b/;
		for (const [id, r] of Object.entries<{ inner: string }>(A('real-icons.json').icons)) expect(shape.test(r.inner), 'real ' + id).toBe(true);
		for (const l of A('icons.json').libraries) for (const i of l.icons) expect(shape.test(i.svg), `library ${l.id}/${i.slot}`).toBe(true);
	});
	it('every data-ws-icon id written in a template is a real icon id (a typo would silently never follow)', async () => {
		const { readdirSync, statSync } = await import('node:fs');
		const real = A('real-icons.json').icons as Record<string, unknown>; const bad: string[] = [];
		const walk = (d: string) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(html|ts)$/.test(e) && !/\.spec\.ts$/.test(e) && !p.includes('/core/identity/')) { for (const m of readFileSync(p, 'utf8').matchAll(/data-ws-icon="([a-z][a-z0-9-]*)"/g)) if (!real[m[1]]) bad.push(p.slice(ROOT.length) + ':' + m[1]); } } };
		walk(join(ROOT, 'src/app'));
		expect(bad).toEqual([]);
	});
});
