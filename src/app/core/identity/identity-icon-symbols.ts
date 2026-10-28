import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ApplicationRef, Injectable, Injector, PLATFORM_ID, effect, inject } from '@angular/core';
import { ParsedSvgIcon, paintGroupAttrs, parseCustomSvg } from './identity-ai-icon';
import { SiteIdentityService } from './site-identity.service';

const SVGNS = 'http://www.w3.org/2000/svg';
/** the dynamic key family of the function icons: `icon.fn.<symbolId>` (one key per <symbol id> of the site) */
export const ICON_FN_PREFIX = 'icon.fn.';
export const iconFnKey = (symbolId: string): string => ICON_FN_PREFIX + symbolId;
export const symbolIdOf = (key: string): string | null => (key.startsWith(ICON_FN_PREFIX) && /^[a-z][a-z0-9-]{0,63}$/.test(key.slice(ICON_FN_PREFIX.length)) ? key.slice(ICON_FN_PREFIX.length) : null);
const CACHE_PREFIX = 'ws-site-identity-fn-';
/** the remembered copies are bounded: at most this many characters in total (the server allows up to 50 icons of up to 64 KB, a typical icon is ~1 KB) */
const CACHE_BUDGET = 1_500_000;

interface Saved { attrs: Map<string, string | null>; html: string }
interface Parsed { sha: string; icon: ParsedSvgIcon; text: string }

/** the attribute that marks an inline / TypeScript-built `<svg>` as "the notifications icon" (or any icon.fn id): the runtime then draws the published file inside it, the default drawing stays untouched otherwise */
export const WS_ICON_ATTR = 'data-ws-icon';
/** ids that are THE SAME ELEMENT as another id (a second copy of the picture under another symbol id): while the alias has no key of its own customised it follows the target */
export const ICON_ALIASES: Readonly<Record<string, string>> = { 'spa-i-bell2': 'i-bell' };
/** icons that CSS draws as a mask / background: while customised the runtime publishes them as `--ws-icon-<id>: url(data:image/svg+xml,…)` on <html>; the stylesheet keeps its own url() as the fallback of var() */
export const CSS_BOUND_ICON_IDS = new Set<string>();
export const cssVarOf = (id: string): string => '--ws-icon-' + id;
const SELECTOR = 'symbol[id], svg[data-ws-icon]';

/**
 * Makes every place that shows a function icon follow the published file. Adapters (all keep the DEFAULT markup byte-for-byte while the manifest has no `icon.fn.*` item):
 *  1. `<symbol id="x">` drawn through `<use href="#x">` (every copy of the id, any template),
 *  2. an inline / TypeScript-built `<svg data-ws-icon="x">` (the place's own size, classes, colour and states stay on the svg; only its drawing and viewBox are swapped),
 *  3. CSS masks / backgrounds through a custom property (`CSS_BOUND_ICON_IDS`), 4. `<img [wsIdentityImg]="'icon.fn.x'">` (the existing image adapter),
 *  5. an alias (`ICON_ALIASES`): a second symbol id that is the same element follows its target until it has its own customisation.
 * The drawing sits in a <g> that resets the host's inherited outline paint, then applies what the file declared (same paint rules as the AI icon runtime); `currentColor` follows the colour the place gives it.
 * Efficiency: only icons PRESENT in the document are fetched (a page uses a few dozen of the ~340), parsed once per sha, remembered by sha; new nodes are handled from the mutation records, never by re-scanning the document.
 * Timing limit (also written on the icons page): the swap runs in the browser after hydration, so the first paint of a server-rendered page shows the default drawing for a moment.
 */
@Injectable({ providedIn: 'root' })
export class IconSymbolsRuntime {
	private readonly identity = inject(SiteIdentityService);
	private readonly doc = inject(DOCUMENT);
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly injector = inject(Injector);
	private readonly appRef = inject(ApplicationRef);
	private readonly saved = new Map<Element, Saved>();
	/** every tracked element (rendered or waiting for its file) by the id whose file it follows */
	private readonly tracked = new Map<string, Set<Element>>();
	private readonly want = new Map<string, { sha: string; url: string }>();
	private readonly parsed = new Map<string, Parsed>();
	private readonly fetching = new Map<string, Promise<void>>();
	private observer: MutationObserver | null = null;
	private added = new Set<Element>();
	private scheduled = false;
	private started = false;
	private hydrated = true;

	start(): void {
		if (!this.browser || this.started) return;
		this.started = true;
		this.hydrated = false;
		// the server-rendered DOM is hydrated first (rewriting symbols before hydration made Angular throw NG0500 for the AI icon runtime); bounded wait, then apply anyway
		void Promise.race([this.appRef.whenStable().catch(() => undefined), new Promise(r => setTimeout(r, 6000))]).then(() => { this.hydrated = true; this.renderAll(); });
		effect(() => {
			const next = new Map<string, { sha: string; url: string }>();
			for (const k of Object.keys(this.identity.manifest().items)) {
				const id = symbolIdOf(k); if (!id) continue;
				const it = this.identity.item(k); if (!it) continue;
				next.set(id, { sha: it.sha256, url: this.identity.absoluteUrl(it.url) });
			}
			this.sync(next);
		}, { injector: this.injector });
	}

	/** the ids that are currently drawn from a published file (specs, admin page) */
	activeIds(): string[] { return [...this.parsed.keys()]; }
	/** (admin page / specs) true while `id` is drawn from a published file by this runtime */
	isCustom(id: string): boolean { return this.parsed.has(id); }

	/** (exposed for specs and the admin preview) make the document show `svgText` for the id; false when the file is not a usable icon */
	applyText(symbolId: string, svgText: string, sha = ''): boolean {
		const icon = parseCustomSvg(svgText, sha);
		if (!icon) return false;
		this.parsed.set(symbolId, { sha, icon, text: svgText });
		this.want.set(symbolId, this.want.get(symbolId) ?? { sha, url: '' });
		this.publishCss(symbolId);
		this.rescan();
		for (const el of [...(this.tracked.get(symbolId) ?? [])]) this.render(el, icon);
		this.observe();
		return true;
	}

	/** (specs) restore the default markup of one id */
	clear(symbolId: string, rescan = true): void {
		this.parsed.delete(symbolId); this.want.delete(symbolId);
		this.unpublishCss(symbolId);
		const els = this.tracked.get(symbolId);
		if (els) for (const el of els) { const s = this.saved.get(el); if (s && el.isConnected) this.restore(el, s); this.saved.delete(el); }
		this.tracked.delete(symbolId);
		// elements that followed this id only as an alias target may now fall back to nothing / another id: re-evaluate them
		if (!this.want.size) { this.observer?.disconnect(); this.observer = null; }
		else if (rescan) this.rescan();
	}

	private sync(next: Map<string, { sha: string; url: string }>): void {
		for (const id of [...this.want.keys()]) if (!next.has(id)) this.clear(id, false);
		const changed: string[] = [];
		for (const [id, w] of next) { const cur = this.want.get(id); if (!cur || cur.sha !== w.sha) changed.push(id); this.want.set(id, w); }
		this.pruneCache(new Set([...next.values()].map(w => w.sha)));
		// a changed sha: the old drawing stays until the new file is parsed (no flash of the default), then every tracked element is redrawn
		for (const id of changed) if (this.parsed.get(id)?.sha !== next.get(id)!.sha) this.invalidate(id);
		if (this.want.size) { this.rescan(); this.observe(); }
	}

	private invalidate(id: string): void {
		const old = this.parsed.get(id);
		if (!old) return;
		// keep drawing the old copy until the new one arrives; mark it stale so `need` fetches
		this.parsed.set(id, { ...old, sha: '' });
	}

	/** register every element in the document that follows a wanted id (one query) */
	private rescan(): void {
		if (!this.want.size && !this.tracked.size) return;
		this.doc.querySelectorAll(SELECTOR).forEach(el => this.register(el));
	}

	private ownId(el: Element): string | null {
		if (el.localName === 'symbol') return el.id || null;
		return el.getAttribute(WS_ICON_ATTR) || null;
	}
	/** the id whose file this element follows: its own while that has a file, else its alias target */
	private effective(id: string): string | null {
		if (this.want.has(id)) return id;
		const a = ICON_ALIASES[id];
		return a && this.want.has(a) ? a : null;
	}

	private register(el: Element): void {
		const own = this.ownId(el); if (!own) return;
		const eff = this.effective(own); if (!eff) return;
		let set = this.tracked.get(eff); if (!set) this.tracked.set(eff, set = new Set());
		if (!set.has(el)) {
			// an element tracked under another target (own file removed / added) moves
			for (const [k, v] of this.tracked) if (k !== eff && v.delete(el)) { const s = this.saved.get(el); if (s && el.isConnected) this.restore(el, s); this.saved.delete(el); }
			set.add(el);
		}
		const p = this.parsed.get(eff);
		if (p && p.sha === (this.want.get(eff)?.sha ?? p.sha)) { if (this.hydrated) this.render(el, p.icon); } else void this.need(eff);
	}

	private renderAll(): void {
		for (const [id, set] of this.tracked) { const p = this.parsed.get(id); if (p) for (const el of set) this.render(el, p.icon); }
	}

	/** fetch + parse the file of `id` once (shared by every element that waits for it) */
	private need(id: string): Promise<void> {
		const w = this.want.get(id); if (!w) return Promise.resolve();
		const running = this.fetching.get(id); if (running) return running;
		const job = (async () => {
			let text = this.readCached(w.sha);
			if (text === null) {
				try {
					const res = await fetch(w.url, { cache: 'force-cache', credentials: 'omit' });
					if (!res.ok) throw new Error('HTTP ' + res.status);
					text = await res.text();
				} catch { if (this.want.get(id)?.sha === w.sha) this.identity.reportBroken(w.url); return; }
			}
			const now = this.want.get(id);
			if (!now || now.sha !== w.sha) return; // superseded while loading
			const icon = parseCustomSvg(text, w.sha);
			if (!icon) { this.identity.reportBroken(w.url); return; }
			this.parsed.set(id, { sha: w.sha, icon, text });
			this.writeCached(w.sha, text);
			this.publishCss(id);
			if (this.hydrated) for (const el of [...(this.tracked.get(id) ?? [])]) this.render(el, icon);
		})().finally(() => { if (this.fetching.get(id) === job) this.fetching.delete(id); });
		this.fetching.set(id, job);
		return job;
	}

	private observe(): void {
		if (this.observer || typeof MutationObserver === 'undefined' || !this.want.size) return;
		this.observer = new MutationObserver(records => {
			for (const r of records) r.addedNodes.forEach(n => { if (n.nodeType === 1) this.added.add(n as Element); });
			if (this.scheduled || !this.added.size) return;
			this.scheduled = true;
			queueMicrotask(() => this.flush());
		});
		this.observer.observe(this.doc.documentElement, { childList: true, subtree: true });
	}

	/** handle only the nodes that were added (never the whole document) */
	private flush(): void {
		this.scheduled = false;
		const nodes = [...this.added]; this.added.clear();
		if (!this.want.size) return;
		for (const n of nodes) {
			if (!n.isConnected) continue;
			if (n.matches(SELECTOR)) this.register(n);
			if (n.firstElementChild) n.querySelectorAll(SELECTOR).forEach(el => this.register(el));
		}
		this.prune();
	}
	private prune(): void {
		for (const [id, set] of this.tracked) { for (const el of set) if (!el.isConnected) { set.delete(el); this.saved.delete(el); } if (!set.size) this.tracked.delete(id); }
	}

	private render(el: Element, icon: ParsedSvgIcon): void {
		if (!this.saved.has(el)) {
			this.saved.set(el, { attrs: new Map(['viewBox', 'preserveAspectRatio'].map(n => [n, el.getAttribute(n)] as [string, string | null])), html: el.innerHTML });
		}
		el.setAttribute('viewBox', icon.viewBox);
		if (icon.preserveAspectRatio) el.setAttribute('preserveAspectRatio', icon.preserveAspectRatio); else el.removeAttribute('preserveAspectRatio');
		while (el.firstChild) el.removeChild(el.firstChild);
		// a <g> first resets every inherited paint property to the SVG initial value, then applies what the file's root declared: the site's outline hosts (fill:none; stroke:currentColor; stroke-width:1.8)
		// never leak into an uploaded drawing, and nothing is forced on it
		const g = el.ownerDocument.createElementNS(SVGNS, 'g');
		for (const [k, v] of Object.entries(paintGroupAttrs(icon))) g.setAttribute(k, v);
		el.appendChild(g);
		for (const c of icon.children) g.appendChild(this.doc.importNode(c, true));
	}

	private restore(el: Element, s: Saved): void {
		for (const [k, v] of s.attrs) { if (v === null) el.removeAttribute(k); else el.setAttribute(k, v); }
		el.innerHTML = s.html;
	}

	// ---- CSS masks / backgrounds
	private publishCss(id: string): void {
		if (!CSS_BOUND_ICON_IDS.has(id)) return;
		const p = this.parsed.get(id); if (!p) return;
		this.doc.documentElement.style.setProperty(cssVarOf(id), `url("data:image/svg+xml,${encodeURIComponent(p.text)}")`);
	}
	private unpublishCss(id: string): void { if (CSS_BOUND_ICON_IDS.has(id)) this.doc.documentElement.style.removeProperty(cssVarOf(id)); }

	// ---- remembered copies (last good): keyed by sha, so a new version is a new entry and the old one is dropped
	private storage(): Storage | null { try { return this.doc.defaultView?.localStorage ?? null; } catch { return null; } }
	private readCached(sha: string): string | null {
		if (!sha) return null;
		try { return this.storage()?.getItem(CACHE_PREFIX + sha) ?? null; } catch { return null; }
	}
	private writeCached(sha: string, text: string): void {
		if (!sha || text.length > 70_000) return;
		try {
			const ls = this.storage(); if (!ls || ls.getItem(CACHE_PREFIX + sha) !== null) return;
			let used = 0;
			for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(CACHE_PREFIX)) used += (ls.getItem(k) ?? '').length; }
			if (used + text.length > CACHE_BUDGET) return; // over budget: simply not remembered (the network copy is still used)
			ls.setItem(CACHE_PREFIX + sha, text);
		} catch { /* ignore */ }
	}
	private pruneCache(keep: Set<string>): void {
		try {
			const ls = this.storage(); if (!ls) return;
			for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k && k.startsWith(CACHE_PREFIX) && !keep.has(k.slice(CACHE_PREFIX.length))) ls.removeItem(k); }
		} catch { /* ignore */ }
	}
}
