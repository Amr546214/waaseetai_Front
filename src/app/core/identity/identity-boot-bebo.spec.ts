/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
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
	type Img = { src: string; style: { visibility: string } };
	const flush = () => new Promise(r => setTimeout(r, 0));
	const run = (stored: string | null | 'throw', opts: { server?: boolean; fetchImpl?: (u: string, init?: unknown) => Promise<unknown> | null } = {}) => {
		const img: Img = { src: 'assets/brand/waseet-mark.png', style: { visibility: '' } };
		const win: Record<string, unknown> = {};
		const calls: string[] = [];
		const fetchImpl = opts.fetchImpl;
		const ctx: Record<string, unknown> = {
			window: win, setTimeout, clearTimeout, AbortController,
			document: { querySelector: (s: string) => (s === 'img.loader-logo' ? img : s === 'app-root[ng-server-context]' ? (opts.server ? {} : null) : null) },
			localStorage: { getItem: (k: string) => { if (stored === 'throw') throw new Error('blocked'); return k === IDENTITY_CACHE_KEY ? stored : null; } },
			fetch: fetchImpl ? (u: string, init?: unknown) => { calls.push(u); return fetchImpl(u, init); } : undefined,
		};
		runInNewContext(m![1], ctx);
		return { img, win, calls };
	};
	const cache = (abs: Record<string, string>) => JSON.stringify({ version: 3, items: {}, abs });
	const answer = (body: unknown, okFlag = true) => () => Promise.resolve({ ok: okFlag, status: okFlag ? 200 : 500, json: async () => body });
	it('remembered manifest: a custom logo.boot swaps the loader image src at once; other keys never touch it', () => {
		expect(run(cache({ 'logo.boot': 'https://x.test/api/public/site-identity/assets/logo.boot/' + 'a'.repeat(64) })).img.src).toContain('/assets/logo.boot/');
		expect(run(cache({ 'logo.mark': 'https://x.test/a.png' })).img.src).toBe('assets/brand/waseet-mark.png');
		expect(run(cache({ 'logo.boot': '/api/public/site-identity/assets/logo.boot/b' })).img.src).toBe('/api/public/site-identity/assets/logo.boot/b');
	});
	it('remembered manifest: refuses javascript:, data: and protocol-relative URLs', () => {
		for (const u of ['javascript:alert(1)', 'data:image/png;base64,AAAA', '//evil.test/x.png', '']) expect(run(cache({ 'logo.boot': u })).img.src).toBe('assets/brand/waseet-mark.png');
	});
	it('remembered manifest: publishes the custom URLs for plain scripts (robot.js) and never fetches', () => {
		const r = run(cache({ 'character.bebo.traffic': 'https://x.test/t.png' }), { fetchImpl: answer({}) });
		expect(r.win['__wsIdentityUrls']).toEqual({ 'character.bebo.traffic': 'https://x.test/t.png' });
		expect(r.calls).toEqual([]);
	});
	it('server-rendered page (app-root has ng-server-context): the script does NOTHING, whatever the browser remembers (no different asset can be swapped in)', () => {
		const r = run(cache({ 'logo.boot': 'https://x.test/stale.png' }), { server: true, fetchImpl: answer({}) });
		expect(r.img.src).toBe('assets/brand/waseet-mark.png');
		expect(r.win['__wsIdentityUrls']).toBeUndefined();
		expect(r.calls).toEqual([]);
		expect(r.img.style.visibility).toBe('');
	});
	it('first visit / blocked / corrupt storage: the logo is held invisible (never the wrong file) until ONE anonymous fetch answers, then shown with the right file', async () => {
		for (const s of [null, 'throw', '{not json', '"x"', '{}', '{"version":1,"items":{}}'] as const) {
			const sha = 'c'.repeat(64);
			const r = run(s, { fetchImpl: answer({ success: true, data: { version: 4, items: { 'logo.boot': { url: '/public/site-identity/assets/logo.boot/' + sha, sha256: sha } } } }) });
			expect(r.img.style.visibility).toBe('hidden');
			expect(r.calls).toEqual(['/api/public/site-identity']);
			await (r.win['__wsIdentityBootPromise'] as Promise<unknown>);
			expect(r.img.src).toBe('/api/public/site-identity/assets/logo.boot/' + sha);
			expect(r.img.style.visibility).toBe('');
			expect((r.win['__wsIdentityBoot'] as { version: number }).version).toBe(4);
		}
	});
	it('first visit with nothing published: the default file is shown after the answer; on 500 / bad JSON / network error / timeout the default stays and the logo is shown', async () => {
		const sha = 'c'.repeat(64);
		const cases: Array<() => Promise<unknown>> = [
			answer({ version: 0, items: {} }), answer({}, false), answer({ version: 'x' }),
			() => Promise.reject(new TypeError('offline')), () => Promise.resolve({ ok: true, json: async () => { throw new SyntaxError('x'); } }),
			answer({ version: 1, items: { 'logo.boot': { url: 'javascript:alert(1)', sha256: sha } } }),
			answer({ version: 1, items: { 'logo.boot': { url: '//evil.test/x.png', sha256: sha } } }),
		];
		for (const c of cases) {
			const r = run(null, { fetchImpl: c });
			await (r.win['__wsIdentityBootPromise'] as Promise<unknown>);
			await flush();
			expect(r.img.src).toBe('assets/brand/waseet-mark.png');
			expect(r.img.style.visibility).toBe('');
		}
	});
	it('a fetch that never answers is released by the 1.5 s timer (default shown); no fetch API at all = nothing changes', async () => {
		vi.useFakeTimers();
		try {
			const img: Img = { src: 'assets/brand/waseet-mark.png', style: { visibility: '' } };
			const ctx = { window: {} as Record<string, unknown>, setTimeout, clearTimeout, AbortController, document: { querySelector: (s: string) => (s === 'img.loader-logo' ? img : null) }, localStorage: { getItem: () => null }, fetch: () => new Promise(() => undefined) };
			runInNewContext(m![1], ctx);
			expect(img.style.visibility).toBe('hidden');
			vi.advanceTimersByTime(1600);
			expect(img.style.visibility).toBe('');
			expect(img.src).toBe('assets/brand/waseet-mark.png');
		} finally { vi.useRealTimers(); }
		const r = run(null);
		expect(r.img.style.visibility).toBe('');
		expect(r.img.src).toBe('assets/brand/waseet-mark.png');
	});
	it('design tokens: the remembered CSS is injected as ONE <style id="ws-identity-tokens"> at the end of <head> before first paint; hostile / absent CSS injects nothing; SSR page: nothing', async () => {
		const CSS = ':root{--radius:24px}\n:root:not(.theme-light):not(.light-theme){--pg:#0b1020;--teal:#14b8a6}';
		const exec = (stored: string | null, opts: { server?: boolean; fetchImpl?: () => Promise<unknown> } = {}) => {
			const els: Array<{ id: string; textContent: string }> = [];
			const img: Img = { src: 'assets/brand/waseet-mark.png', style: { visibility: '' } };
			const win: Record<string, unknown> = {};
			const doc = {
				querySelector: (q: string) => (q === 'img.loader-logo' ? img : q === 'app-root[ng-server-context]' ? (opts.server ? {} : null) : null),
				getElementById: (id: string) => els.find(e => e.id === id) ?? null,
				createElement: () => ({ id: '', textContent: '' }),
				head: { appendChild: (e: { id: string; textContent: string }) => { if (!els.includes(e)) els.push(e); } },
			};
			runInNewContext(m![1], { window: win, document: doc, setTimeout, clearTimeout, AbortController, localStorage: { getItem: () => stored }, fetch: opts.fetchImpl });
			return { els, win };
		};
		const cacheWith = (tokensCss: unknown) => JSON.stringify({ version: 3, items: {}, abs: {}, tokensCss });
		const r = exec(cacheWith(CSS)); expect(r.els.length).toBe(1); expect(r.els[0].id).toBe('ws-identity-tokens'); expect(r.els[0].textContent).toBe(CSS);
		for (const bad of ['body{display:none}', ':root{--a:url(http://x)}', ':root{--a:1}</style><script>', '', null, 5]) expect(exec(cacheWith(bad)).els.length, String(bad)).toBe(0);
		expect(exec(cacheWith(CSS), { server: true }).els.length).toBe(0);
		// first visit: the fetched manifest's CSS is injected too
		const f = exec(null, { fetchImpl: async () => ({ ok: true, json: async () => ({ success: true, data: { version: 2, items: {}, tokensCss: CSS } }) }) });
		await (f.win['__wsIdentityBootPromise'] as Promise<unknown>); await flush();
		expect(f.els.length).toBe(1); expect(f.els[0].textContent).toBe(CSS);
		const g = exec(null, { fetchImpl: async () => ({ ok: true, json: async () => ({ success: true, data: { version: 2, items: {} } }) }) });
		await (g.win['__wsIdentityBootPromise'] as Promise<unknown>); await flush();
		expect(g.els.length).toBe(0);
	});
	it('the two loaders read the same key AND the same default URL: app.ts loader binds logo.boot with src /assets/brand/waseet-mark.png (the very URL of the index.html loader; the old /images/ copy is byte-identical)', () => {
		const APP = readFileSync(join(ROOT, 'src', 'app', 'app.ts'), 'utf8');
		expect(APP).toContain(`<img [wsIdentityImg]="'logo.boot'" src="/assets/brand/waseet-mark.png" alt="Waseet AI Logo" class="loader-logo" />`);
		expect(INDEX).toContain('<img src="assets/brand/waseet-mark.png" alt="Waseet AI" class="loader-logo">');
		expect(createHash('sha256').update(readFileSync(join(ROOT, 'public', 'images', 'waseet-mark.png'))).digest('hex')).toBe(createHash('sha256').update(readFileSync(join(ROOT, 'public', 'assets', 'brand', 'waseet-mark.png'))).digest('hex'));
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
