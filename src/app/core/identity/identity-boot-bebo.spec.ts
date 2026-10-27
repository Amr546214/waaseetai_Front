/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { BEBO_ATLAS_KEYS, FE_WIRED_KEYS, IDENTITY_DEFAULTS } from './identity-defaults';
import { IDENTITY_CACHE_KEY } from './site-identity.service';

// Round 2: `logo.boot` (static loader in index.html) and the 14 `character.bebo.*` atlases (public/bebo/robot.js) read the identity, with the default state UNCHANGED.
const ROOT = join(__dirname, '..', '..', '..', '..');
const INDEX = readFileSync(join(ROOT, 'src', 'index.html'), 'utf8');
const ROBOT = readFileSync(join(ROOT, 'public', 'bebo', 'robot.js'), 'utf8');

describe('logo.boot: inline script in index.html', () => {
	const m = INDEX.match(/<\/app-root>\s*<!--[\s\S]*?-->\s*<script>([\s\S]*?)<\/script>\s*<\/body>/);
	it('exists once, after <app-root>, and the default loader markup is exactly the old one', () => {
		expect(m).not.toBeNull();
		expect(INDEX).toContain('<img src="assets/brand/waseet-mark.png" alt="Waseet AI" class="loader-logo">');
		expect(IDENTITY_DEFAULTS['logo.boot']).toEqual({ type: 'file', path: '/assets/brand/waseet-mark.png' });
	});
	const run = (stored: string | null | 'throw') => {
		const img = { src: 'assets/brand/waseet-mark.png' };
		const win: Record<string, unknown> = {};
		const ctx = { window: win, document: { querySelector: (s: string) => (s === 'img.loader-logo' ? img : null) }, localStorage: { getItem: (k: string) => { if (stored === 'throw') throw new Error('blocked'); return k === IDENTITY_CACHE_KEY ? stored : null; } } };
		runInNewContext(m![1], ctx);
		return { img, win };
	};
	const cache = (abs: Record<string, string>) => JSON.stringify({ version: 3, items: {}, abs });
	it('first visit / empty / blocked / corrupt storage: nothing changes', () => {
		for (const s of [null, 'throw', '{not json', '"x"', '{}', cache({})] as const) { const r = run(s); expect(r.img.src).toBe('assets/brand/waseet-mark.png'); }
		expect(run(null).win['__wsIdentityUrls']).toBeUndefined();
	});
	it('a custom logo.boot swaps the loader image src; other keys never touch it', () => {
		expect(run(cache({ 'logo.boot': 'https://x.test/api/public/site-identity/assets/logo.boot/' + 'a'.repeat(64) })).img.src).toContain('/assets/logo.boot/');
		expect(run(cache({ 'logo.mark': 'https://x.test/a.png' })).img.src).toBe('assets/brand/waseet-mark.png');
		expect(run(cache({ 'logo.boot': '/api/public/site-identity/assets/logo.boot/b' })).img.src).toBe('/api/public/site-identity/assets/logo.boot/b');
	});
	it('refuses javascript:, data: and protocol-relative URLs', () => {
		for (const u of ['javascript:alert(1)', 'data:image/png;base64,AAAA', '//evil.test/x.png', '']) expect(run(cache({ 'logo.boot': u })).img.src).toBe('assets/brand/waseet-mark.png');
	});
	it('publishes the custom URLs for plain scripts (robot.js)', () => {
		const r = run(cache({ 'character.bebo.traffic': 'https://x.test/t.png' }));
		expect(r.win['__wsIdentityUrls']).toEqual({ 'character.bebo.traffic': 'https://x.test/t.png' });
	});
});

describe('character.bebo.*: robot.js resolves atlas URLs through the identity', () => {
	const headEnd = ROBOT.indexOf('  const poses = {');
	const head = ROBOT.slice(0, headEnd);
	const BASE = 'https://site.test/bebo/robot.js';
	const evalAssets = (urls?: Record<string, string>) => {
		const ctx: Record<string, unknown> = { window: { __wsIdentityUrls: urls }, document: { currentScript: { src: BASE }, baseURI: 'https://site.test/' }, customElements: { get: () => undefined }, URL };
		runInNewContext(head.replace(/^\(\(\) => \{/m, '(() => {').replace("if (customElements.get('cute-robot') && customElements.get('khaled-guide-robot')) return;", '') + '\n  globalThis.__out = { classicAssets, scoutAssets };\n})();', ctx);
		return (ctx['__out'] ?? (ctx as { globalThis?: { __out?: unknown } })['globalThis']) as { classicAssets: Record<string, string>; scoutAssets: Record<string, string> };
	};
	const expectedDefault = {
		classicAssets: { base: 'bebo/robot-sprites.png', action: 'bebo/robot-actions.png', speech: 'bebo/robot-speaking.png', antics: 'bebo/robot-antics.png', emotions: 'bebo/robot-emotions.png', cat: 'bebo/kitten-sprites.png', traffic: 'bebo/scout/guide-traffic.png', expressions: 'bebo/scout/guide-expressions.png' },
		scoutAssets: { base: 'bebo/scout/guide-sprites.png', action: 'bebo/scout/guide-actions.png', speech: 'bebo/scout/guide-speaking.png', antics: 'bebo/scout/guide-antics.png', emotions: 'bebo/scout/guide-emotions.png', cat: 'bebo/scout/kitten-sprites.png', traffic: 'bebo/scout/guide-traffic.png', expressions: 'bebo/scout/guide-expressions.png' },
	};
	const lift = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, 'https://site.test/' + v]));

	it('the 14 keys are the 14 wired atlas keys', () => expect(BEBO_ATLAS_KEYS.length).toBe(14));
	it('DEFAULT: with no custom version every atlas URL is exactly what robot.js built before (same absolute href)', () => {
		const a = evalAssets(undefined);
		expect({ ...a.classicAssets }).toEqual(lift(expectedDefault.classicAssets));
		expect({ ...a.scoutAssets }).toEqual(lift(expectedDefault.scoutAssets));
		const b = evalAssets({});
		expect({ ...b.classicAssets }).toEqual({ ...a.classicAssets });
	});
	it('each key maps to the atlas whose built-in default it declares (classic.* / scout.* / shared traffic + expressions)', () => {
		const a = evalAssets(Object.fromEntries(BEBO_ATLAS_KEYS.map(k => [k, 'https://cdn.test/' + k])));
		const used = new Set<string>();
		for (const set of [a.classicAssets, a.scoutAssets]) for (const v of Object.values(set)) { used.add(v.replace('https://cdn.test/', '')); }
		expect([...used].sort()).toEqual([...BEBO_ATLAS_KEYS].sort());
		const d = (k: string) => (IDENTITY_DEFAULTS[k] as { path: string }).path.replace('/bebo/', 'bebo/');
		const plain = evalAssets(undefined);
		for (const [set, name] of [[plain.classicAssets, 'classicAssets'], [plain.scoutAssets, 'scoutAssets']] as const) {
			for (const [slot, href] of Object.entries(set)) {
				const key = Object.entries(IDENTITY_DEFAULTS).find(([k, v]) => k.startsWith('character.bebo.') && v.type === 'file' && 'https://site.test' + v.path === href)![0];
				const custom = evalAssets({ [key]: 'https://cdn.test/x.png' });
				expect((custom as Record<string, Record<string, string>>)[name][slot], `${name}.${slot} <- ${key}`).toBe('https://cdn.test/x.png');
				expect(d(key)).toBeTruthy();
			}
		}
	});
	it('a custom atlas is picked up live (getters), a bad value falls back to the default', () => {
		const urls: Record<string, string> = {};
		const a = evalAssets(urls);
		urls['character.bebo.classic.actions'] = 'https://cdn.test/a.png';
		expect(a.classicAssets['action']).toBe('https://cdn.test/a.png');
		delete urls['character.bebo.classic.actions'];
		expect(a.classicAssets['action']).toBe('https://site.test/bebo/robot-actions.png');
		urls['character.bebo.classic.actions'] = 5 as unknown as string;
		expect(a.classicAssets['action']).toBe('https://site.test/bebo/robot-actions.png');
	});
	it('the tuned engine (poses, frame coordinates, timing, drawing) is byte-identical to the shipped file: only the URL resolution block changed', () => {
		const tail = ROBOT.slice(headEnd);
		expect(createHash('sha256').update(tail).digest('hex')).toBe('4513e5baffee9ab511bbedbef489b9db2c0b90462f5f8b97b10298bc2c60f691');
		expect(ROBOT.slice(0, ROBOT.indexOf('  // Site identity'))).toMatch(/const base = document\.currentScript\?\.src \|\| document\.baseURI;\s*$/);
	});
	it('the wired list holds logo.boot and all 14 atlases', () => {
		for (const k of ['logo.boot', ...BEBO_ATLAS_KEYS]) expect(FE_WIRED_KEYS).toContain(k);
	});
});
