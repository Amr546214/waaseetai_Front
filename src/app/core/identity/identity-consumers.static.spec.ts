/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FE_WIRED_KEYS, IDENTITY_DEFAULTS } from './identity-defaults';

// Static guard of the migrated consumers: a template that reads the identity service must keep the built-in default in markup (so the default DOM is the one that always shipped),
// and no shared-logo <img> may be left unmigrated (that would make a published logo appear in some places and not in others).
const APP = join(__dirname, '..', '..');
function walk(dir: string, out: string[] = []): string[] {
	for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(html|ts)$/.test(n) && !n.endsWith('.spec.ts')) out.push(p); }
	return out;
}
const FILES = walk(APP);

describe('identity consumers (static)', () => {
	it('every <img [wsIdentityImg]="key"> carries the key\'s built-in default as its own src, and the key is a wired FE key', () => {
		let n = 0;
		for (const f of FILES) for (const m of readFileSync(f, 'utf8').matchAll(/<img\s+\[wsIdentityImg\]="'([^']+)'"\s+src="([^"]+)"/g)) {
			n++;
			const d = IDENTITY_DEFAULTS[m[1]];
			expect(d, `${f}: ${m[1]}`).toBeDefined();
			expect(d.type === 'file' ? d.path : '', f).toBe(m[2]);
			expect(FE_WIRED_KEYS, `${f}: ${m[1]} is not in FE_WIRED_KEYS`).toContain(m[1]);
		}
		expect(n).toBeGreaterThanOrEqual(12);
	});

	it('no template still draws the shared logo (/images/waseet-mark.png) without the identity directive', () => {
		const bad: string[] = [];
		for (const f of FILES) for (const m of readFileSync(f, 'utf8').matchAll(/<img\b[^>]*?src="\/images\/waseet-mark\.png"[^>]*>/g)) if (!/wsIdentityImg/.test(m[0])) bad.push(f.replace(APP, ''));
		expect(bad).toEqual([]);
	});

	it('the AI-mark runtime is wired at app start next to the favicon runtime and the service', () => {
		const cfg = readFileSync(join(APP, 'app.config.ts'), 'utf8');
		expect(cfg).toContain('provideSiteIdentity()');
		const prov = readFileSync(join(__dirname, 'identity.providers.ts'), 'utf8');
		for (const c of ['AiIconRuntime', 'FaviconRuntime', 'SiteIdentityService']) expect(prov).toContain(c);
	});

	it('Round 2: the AI-mark runtime never rewrites the DOM before hydration finished (waits for ApplicationRef.whenStable) and paints the uploaded root on a <g> inside the symbol', () => {
		const src = readFileSync(join(__dirname, 'identity-ai-icon.ts'), 'utf8');
		expect(src.indexOf('whenStable')).toBeGreaterThan(-1);
		expect(src.indexOf('whenStable')).toBeLessThan(src.indexOf('if (!this.applyText(text, sha))'));
		expect(src).toContain("createElementNS(SVGNS, 'g')");
	});
});
