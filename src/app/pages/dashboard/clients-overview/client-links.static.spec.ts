/// <reference types="node" />

// Static guard for the client area: every "/client-overview/..." link in the app resolves to a real route of client.routes.ts (not the
// not-found catch-all), no placeholder links (javascript:void, href="#"), and the client footers carry no unsourced compliance claim.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { helpRoleOfUrl } from '../../../core/help/help-guided';

const APP = join(__dirname, '../../..');
const CLIENT_DIR = __dirname;

function walk(dir: string, exts: string[], out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, exts, out);
		else if (exts.some(e => full.endsWith(e)) && !full.endsWith('.spec.ts')) out.push(full);
	}
	return out;
}

interface RouteDef { path: string; redirectTo?: string }

function readRoutes(): RouteDef[] {
	const src = readFileSync(join(CLIENT_DIR, 'client.routes.ts'), 'utf8');
	const defs: RouteDef[] = [];
	for (const m of src.matchAll(/\{\s*path:\s*'([^']*)'([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) {
		const redirect = /redirectTo:\s*'([^']*)'/.exec(m[2]);
		defs.push({ path: m[1], redirectTo: redirect?.[1] });
	}
	return defs;
}

const ROUTES = readRoutes();

function resolve(target: string, depth = 0): RouteDef | null {
	if (depth > 4) return null;
	const rest = target.replace(/^\/client-overview\/?/, '').replace(/\/+$/, '');
	const segs = rest ? rest.split('/') : [];
	for (const r of ROUTES) {
		if (r.path === '**') continue;
		const ps = r.path ? r.path.split('/') : [];
		if (ps.length !== segs.length || !ps.every((p, i) => p.startsWith(':') || p === segs[i])) continue;
		if (r.redirectTo) {
			if (r.redirectTo.startsWith('/')) return r; // leaves the client area (e.g. the public marketplace)
			return resolve('/client-overview/' + r.redirectTo, depth + 1);
		}
		return r;
	}
	return null;
}

function linkTargets(): Array<{ file: string; target: string }> {
	const out: Array<{ file: string; target: string }> = [];
	for (const f of walk(APP, ['.ts', '.html'])) {
		const s = readFileSync(f, 'utf8');
		for (const m of s.matchAll(/['"`](\/client-overview(?:\/[A-Za-z0-9_\-:.]*)*)(?=[?#'"`$]|\{\{)/g)) {
			const after = s.slice(m.index! + m[0].length, m.index! + m[0].length + 2);
			const t = m[1];
			if (t.endsWith('/') || after.startsWith('${') || after.startsWith('{{')) continue; // a prefix continued by a dynamic part
			out.push({ file: relative(APP, f), target: t });
		}
	}
	return out;
}

describe('client area links', () => {
	it('client.routes.ts is read (sanity)', () => {
		expect(ROUTES.length).toBeGreaterThan(40);
		expect(ROUTES.some(r => r.path === 'help/tickets/:id')).toBe(true);
	});

	it('every "/client-overview/..." link in the app resolves to a real client route (never the not-found catch-all)', () => {
		const bad = linkTargets().filter(l => !resolve(l.target)).map(l => `${l.target}  <- ${l.file}`);
		expect([...new Set(bad)]).toEqual([]);
	});

	it('the section roots and the old placeholder pages redirect to a real page', () => {
		expect(resolve('/client-overview/projects')?.path).toBe('projects/active');
		expect(resolve('/client-overview/finance')?.path).toBe('finance/wallet');
		expect(resolve('/client-overview/settings')?.path).toBe('settings/account');
		expect(resolve('/client-overview/support')?.path).toBe('help');
		expect(resolve('/client-overview/market')?.redirectTo).toBe('/marketplace');
	});

	it('no placeholder links in the client area: no javascript:void and no href="#"', () => {
		const offenders: string[] = [];
		for (const f of walk(CLIENT_DIR, ['.html', '.ts'])) {
			const s = readFileSync(f, 'utf8');
			if (/javascript:\s*void|href\s*=\s*["']#["']/.test(s)) offenders.push(relative(APP, f));
		}
		expect(offenders).toEqual([]);
	});

	it('client footers carry no SAMA / PDPL claim and no fixed version string', () => {
		const offenders: string[] = [];
		for (const f of walk(CLIENT_DIR, ['.html'])) {
			if (/SAMA|PDPL|v1\.0\.0/.test(readFileSync(f, 'utf8'))) offenders.push(relative(APP, f));
		}
		expect(offenders).toEqual([]);
	});

	it('Bebo is guided only inside /client-overview/help* (every client help route) and normal everywhere else in the client area', () => {
		for (const r of ROUTES) {
			if (r.path === '**' || r.redirectTo) continue;
			const url = '/client-overview/' + r.path.replace(/:\w+/g, 'x');
			const isHelp = r.path === 'help' || r.path.startsWith('help/');
			expect(helpRoleOfUrl(url), url).toBe(isHelp ? 'client' : null);
		}
		expect(helpRoleOfUrl('/client-overview')).toBeNull();
		expect(helpRoleOfUrl('/client-overview/helpful')).toBeNull();
	});
});
