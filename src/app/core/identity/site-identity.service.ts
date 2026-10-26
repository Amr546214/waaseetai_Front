import { DOCUMENT } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { defaultPathOf } from './identity-defaults';
import { EMPTY_MANIFEST, IdentityManifest, IdentityManifestItem, parseManifest } from './site-identity.models';

export const IDENTITY_CACHE_KEY = 'ws-site-identity-manifest-v1';
export const IDENTITY_CHANNEL = 'ws-site-identity';
const REFRESH_EVERY_MS = 5 * 60_000;
const FOCUS_THROTTLE_MS = 5_000;
const FETCH_TIMEOUT_MS = 8_000;

/**
 * The single front-end source of the platform's visual identity (design 2026-10-27, decision 9).
 *  - `resolve(key)` / `url(key)` = the published custom URL, else the built-in default path (identity-defaults.ts). Reading them inside a template/effect tracks the manifest signal.
 *  - Loads GET /public/site-identity at app start WITHOUT blocking render; the last good manifest is remembered in localStorage and read synchronously, so a returning visitor never flashes the default.
 *  - ANY failure (network, 5xx, bad JSON, bad shape, storage blocked) keeps the last good manifest, or the built-in default: icons never disappear.
 *  - Refreshes on window focus / tab visible / every few minutes / when another tab announces a new version (BroadcastChannel + `storage` event).
 *  - Asset URLs carry the sha256, so a new version simply changes the URL: no manual cache clearing. An asset URL that 404s is reported by its consumer (reportBroken) and falls back to the default.
 * Nothing here runs on the server (SSR): there the manifest stays empty = built-in defaults.
 */
@Injectable({ providedIn: 'root' })
export class SiteIdentityService {
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly doc = inject(DOCUMENT);
	private started = false;
	private lastFetch = 0;
	private inflight: Promise<boolean> | null = null;
	private channel: BroadcastChannel | null = null;

	readonly manifest = signal<IdentityManifest>(EMPTY_MANIFEST);
	readonly version = computed(() => this.manifest().version);
	/** asset URLs that failed to load (404 / decode error): treated as "no custom version" for their key until the manifest changes */
	private readonly broken = signal<ReadonlySet<string>>(new Set());
	/** last failed refresh (null = last attempt fine / none yet); informational only, never shown to visitors */
	readonly lastError = signal<string | null>(null);

	constructor() {
		const cached = this.readCache();
		if (cached) this.manifest.set(cached);
	}

	/** the API base the manifest and the (relative) asset URLs hang on */
	private get apiBase(): string { return String(environment.url_api || '/api').replace(/\/+$/, ''); }
	private get apiOrigin(): string { try { return /^https?:\/\//i.test(this.apiBase) ? new URL(this.apiBase).origin : ''; } catch { return ''; } }

	/**
	 * absolute-or-site-relative URL a browser can request for a manifest item. The server's URLs are relative to the API root ("/public/site-identity/assets/<key>/<sha>");
	 * a URL that already carries the API prefix ("/api/public/...") or is absolute is used as is.
	 */
	absoluteUrl(url: string): string {
		if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url;
		let prefix = '/api';
		try { prefix = (/^https?:\/\//i.test(this.apiBase) ? new URL(this.apiBase).pathname : this.apiBase).replace(/\/+$/, '') || ''; } catch { /* keep default */ }
		if (url.startsWith('/')) return prefix && (url === prefix || url.startsWith(prefix + '/')) ? this.apiOrigin + url : this.apiBase + url;
		return this.apiBase + '/' + url;
	}

	/** the active custom item of a key, or null (default / not published / known broken) */
	item(key: string): IdentityManifestItem | null {
		const it = this.manifest().items[key];
		if (!it) return null;
		return this.broken().has(this.absoluteUrl(it.url)) ? null : it;
	}
	/** the custom URL, or null when the key shows its built-in default */
	customUrl(key: string): string | null { const it = this.item(key); return it ? this.absoluteUrl(it.url) : null; }
	isCustom(key: string): boolean { return this.item(key) !== null; }
	/** custom URL, else the built-in default file path ('' for an inline-symbol default) */
	resolve(key: string): string { return this.customUrl(key) ?? defaultPathOf(key); }
	url(key: string): string { return this.resolve(key); }

	/** a consumer's asset failed to load: every consumer of that URL falls back to the default; cleared when the manifest changes */
	reportBroken(absoluteUrl: string): void {
		if (!absoluteUrl || this.broken().has(absoluteUrl)) return;
		this.broken.set(new Set([...this.broken(), absoluteUrl]));
	}

	/** start loading + listening; idempotent; never throws, never awaited by the app */
	start(): void {
		if (!this.browser || this.started) return;
		this.started = true;
		void this.refresh(true);
		try {
			const win = this.doc.defaultView;
			win?.addEventListener('focus', () => this.refreshThrottled());
			this.doc.addEventListener('visibilitychange', () => { if (this.doc.visibilityState === 'visible') this.refreshThrottled(); });
			win?.addEventListener('storage', (e: StorageEvent) => { if (e.key === IDENTITY_CACHE_KEY) { const m = this.readCache(); if (m) this.apply(m, false); } });
			win?.setInterval(() => { if (this.doc.visibilityState !== 'hidden') void this.refresh(false); }, REFRESH_EVERY_MS);
			if (typeof BroadcastChannel !== 'undefined') {
				this.channel = new BroadcastChannel(IDENTITY_CHANNEL);
				this.channel.onmessage = (e: MessageEvent) => { const v = Number((e.data as { version?: unknown } | null)?.version); if (Number.isFinite(v) && v !== this.manifest().version) void this.refresh(true); };
			}
		} catch { /* a blocked/unsupported API only removes the live refresh */ }
	}

	private refreshThrottled(): void { if (Date.now() - this.lastFetch >= FOCUS_THROTTLE_MS) void this.refresh(false); }

	/** fetch the public manifest; resolves true when the answer was applied (or already current), false on any failure (last good stays) */
	refresh(force = false): Promise<boolean> {
		if (!this.browser) return Promise.resolve(false);
		if (this.inflight) return this.inflight;
		if (!force && Date.now() - this.lastFetch < 1_000) return Promise.resolve(true);
		this.lastFetch = Date.now();
		this.inflight = this.fetchManifest().finally(() => { this.inflight = null; });
		return this.inflight;
	}

	private async fetchManifest(): Promise<boolean> {
		const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
		const timer = ctl ? setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS) : null;
		try {
			// plain fetch on purpose: the app's HTTP interceptors (auth, 401 logout, error toasts, cache) must never see this background call
			const res = await fetch(`${this.apiBase}/public/site-identity`, { headers: { Accept: 'application/json' }, cache: 'no-cache', credentials: 'omit', signal: ctl?.signal });
			if (!res.ok) throw new Error('HTTP ' + res.status);
			const m = parseManifest(await res.json());
			if (!m) throw new Error('bad manifest');
			this.lastError.set(null);
			this.apply(m, true);
			return true;
		} catch (e) {
			this.lastError.set(String((e as Error)?.message ?? e).slice(0, 120));
			return false;
		} finally { if (timer) clearTimeout(timer); }
	}

	/** swap in a manifest (from the server, another tab, or the admin page right after a save) */
	apply(m: IdentityManifest, announce: boolean): void {
		const cur = this.manifest();
		if (cur.version === m.version && JSON.stringify(cur.items) === JSON.stringify(m.items)) return;
		this.manifest.set(m);
		this.broken.set(new Set());
		this.writeCache(m);
		if (announce) { try { this.channel?.postMessage({ version: m.version }); } catch { /* ignore */ } }
	}

	/** the admin page calls this after a publish/restore so the very tab that changed it switches at once */
	adopt(m: IdentityManifest): void { this.apply(m, true); }

	private readCache(): IdentityManifest | null {
		if (!this.browser) return null;
		try { const raw = this.doc.defaultView?.localStorage.getItem(IDENTITY_CACHE_KEY); return raw ? parseManifest(JSON.parse(raw)) : null; } catch { return null; }
	}
	private writeCache(m: IdentityManifest): void {
		try { this.doc.defaultView?.localStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify(m)); } catch { /* storage blocked/full: the in-memory manifest still works */ }
	}
}
