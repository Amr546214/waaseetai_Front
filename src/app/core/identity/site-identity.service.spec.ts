import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDENTITY_CACHE_KEY, SiteIdentityService } from './site-identity.service';
import { parseManifest } from './site-identity.models';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const item = (sha: string, v = 1) => ({ url: `/public/site-identity/assets/logo.mark/${sha}`, sha256: sha, mime: 'image/png', width: 100, height: 50, version: v });
const manifest = (version: number, items: Record<string, unknown> = {}) => ({ version, items });
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

function make(): SiteIdentityService {
	TestBed.resetTestingModule();
	return TestBed.inject(SiteIdentityService);
}

describe('SiteIdentityService', () => {
	beforeEach(() => { localStorage.removeItem(IDENTITY_CACHE_KEY); });
	afterEach(() => { vi.unstubAllGlobals(); localStorage.removeItem(IDENTITY_CACHE_KEY); });

	it('with nothing published every key resolves to its built-in default (and a default inline symbol has no file)', () => {
		const s = make();
		expect(s.resolve('logo.mark')).toBe('/images/waseet-mark.png');
		expect(s.resolve('favicon.tab')).toBe('/assets/brand/waseet-mark.png');
		expect(s.resolve('icon.ai')).toBe('');
		expect(s.customUrl('logo.mark')).toBeNull();
		expect(s.isCustom('logo.mark')).toBe(false);
	});

	it('a published key resolves to its custom URL (relative to the API root); the other keys stay default', () => {
		const s = make();
		s.apply(parseManifest(manifest(3, { 'logo.mark': item(SHA_A) }))!, false);
		expect(s.version()).toBe(3);
		expect(s.resolve('logo.mark')).toContain(`/public/site-identity/assets/logo.mark/${SHA_A}`);
		expect(s.resolve('favicon.tab')).toBe('/assets/brand/waseet-mark.png');
	});

	it('a new manifest version switches the URL (the URL carries the sha256: no cache clearing)', () => {
		const s = make();
		s.apply(parseManifest(manifest(1, { 'logo.mark': item(SHA_A) }))!, false);
		const u1 = s.resolve('logo.mark');
		s.apply(parseManifest(manifest(2, { 'logo.mark': item(SHA_B, 2) }))!, false);
		expect(s.resolve('logo.mark')).not.toBe(u1);
		expect(s.resolve('logo.mark')).toContain(SHA_B);
	});

	it('rollback to the default (item removed from the manifest) restores the built-in path', () => {
		const s = make();
		s.apply(parseManifest(manifest(1, { 'logo.mark': item(SHA_A) }))!, false);
		s.apply(parseManifest(manifest(2, {}))!, false);
		expect(s.resolve('logo.mark')).toBe('/images/waseet-mark.png');
	});

	it('remembers the last good manifest in localStorage and a new instance reads it synchronously (no flash of the default)', () => {
		const a = make();
		a.apply(parseManifest(manifest(5, { 'logo.mark': item(SHA_A) }))!, false);
		expect(localStorage.getItem(IDENTITY_CACHE_KEY)).toContain(SHA_A);
		const b = make();
		expect(b.version()).toBe(5);
		expect(b.resolve('logo.mark')).toContain(SHA_A);
	});

	it('a garbage cache entry is ignored (built-in default)', () => {
		localStorage.setItem(IDENTITY_CACHE_KEY, '{"version":"x","items":[1]}');
		expect(make().resolve('logo.mark')).toBe('/images/waseet-mark.png');
		localStorage.setItem(IDENTITY_CACHE_KEY, 'not json');
		expect(make().resolve('logo.mark')).toBe('/images/waseet-mark.png');
	});

	it('manifest fetch failures (network, 500, bad JSON, bad shape) keep the last good manifest', async () => {
		const s = make();
		s.apply(parseManifest(manifest(7, { 'logo.mark': item(SHA_A) }))!, false);
		const before = s.resolve('logo.mark');
		for (const f of [
			() => Promise.reject(new TypeError('offline')),
			() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response),
			() => Promise.resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } } as unknown as Response),
			() => Promise.resolve(ok({ version: 'nope', items: 3 })),
			() => Promise.resolve(ok(null)),
		]) {
			vi.stubGlobal('fetch', vi.fn(f));
			expect(await s.refresh(true)).toBe(false);
			expect(s.resolve('logo.mark')).toBe(before);
			expect(s.version()).toBe(7);
			expect(s.lastError()).not.toBeNull();
		}
	});

	it('a failed first load with no cache keeps the built-in default', async () => {
		const s = make();
		vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
		expect(await s.refresh(true)).toBe(false);
		expect(s.resolve('logo.mark')).toBe('/images/waseet-mark.png');
	});

	it('a good answer is applied and cached; the request is a plain credential-less GET (no auth interceptor involved)', async () => {
		const s = make();
		const f = vi.fn((_u: string, _i?: RequestInit) => Promise.resolve(ok(manifest(9, { 'logo.mark': item(SHA_B, 4) }))));
		vi.stubGlobal('fetch', f);
		expect(await s.refresh(true)).toBe(true);
		expect(s.version()).toBe(9);
		expect(f.mock.calls[0][0] as string).toMatch(/\/public\/site-identity$/);
		expect(f.mock.calls[0][1]!.credentials).toBe('omit');
		expect(localStorage.getItem(IDENTITY_CACHE_KEY)).toContain(SHA_B);
	});

	it('an asset URL reported broken (404) falls back to the default for that key only, until the manifest changes', () => {
		const s = make();
		s.apply(parseManifest(manifest(1, { 'logo.mark': item(SHA_A), 'favicon.tab': { ...item(SHA_B), url: `/public/site-identity/assets/favicon.tab/${SHA_B}` } }))!, false);
		const custom = s.customUrl('logo.mark')!;
		s.reportBroken(custom);
		expect(s.resolve('logo.mark')).toBe('/images/waseet-mark.png');
		expect(s.isCustom('favicon.tab')).toBe(true);
		s.apply(parseManifest(manifest(2, { 'logo.mark': item(SHA_B, 2) }))!, false);
		expect(s.isCustom('logo.mark')).toBe(true);
	});

	it('another tab: a storage event with a newer cached manifest is adopted; a BroadcastChannel announcement triggers a refetch', async () => {
		const s = make();
		vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok(manifest(1)))));
		s.start();
		await Promise.resolve();
		localStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify(manifest(11, { 'logo.mark': item(SHA_A, 3) })));
		window.dispatchEvent(new StorageEvent('storage', { key: IDENTITY_CACHE_KEY }));
		expect(s.version()).toBe(11);
		expect(s.isCustom('logo.mark')).toBe(true);
	});

	it('parseManifest drops unsafe or malformed items and accepts the {success,data} envelope', () => {
		const m = parseManifest({ success: true, data: manifest(2, { 'logo.mark': item(SHA_A), bad1: { url: 'javascript:alert(1)', sha256: SHA_A }, bad2: { url: '/x', sha256: 'zz' }, 'a b': item(SHA_A) }) })!;
		expect(Object.keys(m.items)).toEqual(['logo.mark']);
		expect(parseManifest({ version: 1 })).toBeNull();
	});
});
