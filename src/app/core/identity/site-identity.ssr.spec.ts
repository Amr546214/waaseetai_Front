import { PLATFORM_ID, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDENTITY_CACHE_KEY, IDENTITY_STATE_KEY, SiteIdentityService, resetServerIdentityMemory } from './site-identity.service';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const body = (version: number, items: Record<string, unknown> = {}) => ({ success: true, data: { version, items } });
const item = (key: string, sha: string) => ({ url: `/public/site-identity/assets/${key}/${sha}`, sha256: sha, mime: 'image/png', width: 1, height: 1, version: 1 });
const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b }) as Response;

function server(): SiteIdentityService {
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
	return TestBed.inject(SiteIdentityService);
}
function browser(seed?: (t: TransferState) => void): SiteIdentityService {
	TestBed.resetTestingModule();
	if (seed) seed(TestBed.inject(TransferState));
	return TestBed.inject(SiteIdentityService);
}

describe('SiteIdentityService on the server (SSR): the manifest is read BEFORE render, never from browser storage', () => {
	beforeEach(() => { resetServerIdentityMemory(); localStorage.removeItem(IDENTITY_CACHE_KEY); });
	afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); resetServerIdentityMemory(); delete (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env['SITE_IDENTITY_SSR_API_BASE']; });

	it('published custom logo.boot: the server service resolves it after loadForServer() and hands the manifest to the browser through transfer state', async () => {
		const f = vi.fn(() => Promise.resolve(ok(body(5, { 'logo.boot': item('logo.boot', SHA_A) }))));
		vi.stubGlobal('fetch', f);
		const s = server();
		await s.loadForServer();
		expect(s.customUrl('logo.boot')).toContain(`/assets/logo.boot/${SHA_A}`);
		expect(s.resolve('logo.mark')).toBe('/images/waseet-mark.png');
		expect(TestBed.inject(TransferState).get(IDENTITY_STATE_KEY, null)?.version).toBe(5);
		expect((f.mock.calls[0] as unknown as [string])[0]).toMatch(/\/public\/site-identity$/);
	});

	it('nothing published: default for every key and an empty manifest in transfer state', async () => {
		vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok(body(0)))));
		const s = server();
		await s.loadForServer();
		expect(s.isCustom('logo.boot')).toBe(false);
		expect(s.resolve('logo.boot')).toBe('/assets/brand/waseet-mark.png');
		expect(TestBed.inject(TransferState).get(IDENTITY_STATE_KEY, null)?.items).toEqual({});
	});

	it('the BE is down / slow / answers garbage: the render is not blocked longer than the 1 s limit and uses the defaults (no previous good manifest in the process)', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn((_u: string, init?: RequestInit) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))));
		const s = server();
		const p = s.loadForServer();
		await vi.advanceTimersByTimeAsync(1100);
		await p;
		expect(s.isCustom('logo.boot')).toBe(false);
		expect(TestBed.inject(TransferState).get(IDENTITY_STATE_KEY, null)).toBeNull();
		vi.useRealTimers();
		for (const f of [() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response), () => Promise.resolve(ok({ version: 'x' })), () => Promise.reject(new TypeError('down'))]) {
			resetServerIdentityMemory();
			vi.stubGlobal('fetch', vi.fn(f));
			const s2 = server();
			await s2.loadForServer();
			expect(s2.isCustom('logo.boot')).toBe(false);
		}
	});

	it('last good fallback: after one good answer, a later failure still renders the custom logo (same process memory)', async () => {
		vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok(body(7, { 'logo.boot': item('logo.boot', SHA_B) })))));
		await server().loadForServer();
		resetServerIdentityMemoryTimeOnly();
		vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('down'))));
		const s = server();
		await s.loadForServer();
		expect(s.customUrl('logo.boot')).toContain(SHA_B);
	});

	it('a fresh answer is reused for a few seconds (one fetch for many renders)', async () => {
		const f = vi.fn(() => Promise.resolve(ok(body(1))));
		vi.stubGlobal('fetch', f);
		await server().loadForServer(); await server().loadForServer(); await server().loadForServer();
		expect(f).toHaveBeenCalledTimes(1);
	});

	it('url_api that is relative and no SITE_IDENTITY_SSR_API_BASE: no request is made, defaults are rendered', async () => {
		const f = vi.fn(() => Promise.resolve(ok(body(1))));
		vi.stubGlobal('fetch', f);
		const s = server();
		// environment.url_api in tests is absolute; emulate a relative API root
		(s as unknown as { serverApiBase: () => string }).serverApiBase = () => '';
		await s.loadForServer();
		expect(f).not.toHaveBeenCalled();
		expect(s.isCustom('logo.boot')).toBe(false);
	});

	it('never writes to or reads from browser storage on the server (the localStorage entry is ignored)', async () => {
		localStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify(body(99, { 'logo.boot': item('logo.boot', SHA_B) }).data));
		vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok(body(2)))));
		const s = server();
		expect(s.isCustom('logo.boot')).toBe(false);
		await s.loadForServer();
		expect(s.isCustom('logo.boot')).toBe(false);
		expect(JSON.parse(localStorage.getItem(IDENTITY_CACHE_KEY)!).version).toBe(99);
	});
});

function resetServerIdentityMemoryTimeOnly(): void {
	// age the memory past the reuse window without dropping the manifest
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(Date.now() + 60_000);
}

describe('SiteIdentityService in the browser after SSR hydration', () => {
	beforeEach(() => { localStorage.removeItem(IDENTITY_CACHE_KEY); });
	afterEach(() => { vi.useRealTimers(); delete (window as unknown as { __wsIdentityBoot?: unknown }).__wsIdentityBoot; delete (window as unknown as { __wsIdentityBootPromise?: unknown }).__wsIdentityBootPromise; localStorage.removeItem(IDENTITY_CACHE_KEY); });

	it('first client render == server HTML: the transfer-state manifest is used with EMPTY localStorage (first visit)', () => {
		const s = browser(t => t.set(IDENTITY_STATE_KEY, { version: 5, items: { 'logo.boot': item('logo.boot', SHA_A) } as never, tokensCss: '' }));
		expect(s.isCustom('logo.boot')).toBe(true);
		expect(s.customUrl('logo.boot')).toContain(SHA_A);
	});

	it('the newest of transfer state / boot answer / remembered cache wins (a stale cache never beats the server HTML)', () => {
		localStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify({ version: 3, items: { 'logo.boot': item('logo.boot', SHA_B) } }));
		const s = browser(t => t.set(IDENTITY_STATE_KEY, { version: 5, items: { 'logo.boot': item('logo.boot', SHA_A) } as never, tokensCss: '' }));
		expect(s.customUrl('logo.boot')).toContain(SHA_A);
		const s2 = browser(t => t.set(IDENTITY_STATE_KEY, { version: 2, items: {}, tokensCss: '' }));
		expect(s2.customUrl('logo.boot')).toContain(SHA_B);
	});

	it('static host first visit: awaitBoot() waits for the boot script\'s fetch and adopts its answer, so the app loader uses the right file', async () => {
		let release!: () => void;
		(window as unknown as { __wsIdentityBootPromise: Promise<void> }).__wsIdentityBootPromise = new Promise<void>(r => { release = r; });
		const s = browser();
		const waiting = s.awaitBoot();
		expect(s.isCustom('logo.boot')).toBe(false);
		(window as unknown as { __wsIdentityBoot: unknown }).__wsIdentityBoot = { version: 4, items: { 'logo.boot': item('logo.boot', SHA_A) } };
		release();
		await waiting;
		expect(s.customUrl('logo.boot')).toContain(SHA_A);
	});

	it('an unchanged answer is still remembered once, so a visitor with nothing published is not a "first visit" again', async () => {
		const s = browser();
		vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok(body(0)))));
		await s.refresh(true);
		const raw = JSON.parse(localStorage.getItem(IDENTITY_CACHE_KEY)!);
		expect(raw.version).toBe(0);
		expect(raw.abs).toEqual({});
		vi.unstubAllGlobals();
	});
});
