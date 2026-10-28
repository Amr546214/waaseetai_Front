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

interface Saved { attrs: Map<string, string | null>; html: string; id: string }
interface Active { sha: string; icon: ParsedSvgIcon }

/**
 * Makes every `<use href="#id">` of the site follow a customised function icon. For each manifest item `icon.fn.<id>` it replaces the content of EVERY `<symbol id="<id>">` in the document by
 * the published SVG (several templates define the same id; every copy is replaced, later-rendered copies are caught by a MutationObserver), with the SAME paint rules as the AI icon runtime:
 * the file keeps its own fill / stroke semantics (root attributes, root style, its own <style> rules), a property it does not declare gets the SVG initial value (never the host's outline paint),
 * `currentColor` follows the colour the site gives the icon.
 *
 * Nothing is touched while the manifest has no `icon.fn.*` item: the templates' own <symbol> markup stays byte-for-byte what ships. A restore (item gone) puts each element's saved
 * markup back. A file that cannot be fetched or parsed is reported broken and that id keeps its default (last good copy first: the remembered copy of the same sha is used before any network).
 * Limits (also written on the icons page): a swap happens in the browser after hydration, so the very first paint of a server-rendered page shows the default symbol for a moment; inline
 * `<svg>` shapes written in a template, svg strings built in TypeScript, CSS masks / backgrounds and <img> icons do not use a <symbol> and are not reached.
 */
@Injectable({ providedIn: 'root' })
export class IconSymbolsRuntime {
	private readonly identity = inject(SiteIdentityService);
	private readonly doc = inject(DOCUMENT);
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly injector = inject(Injector);
	private readonly appRef = inject(ApplicationRef);
	private readonly saved = new Map<Element, Saved>();
	private readonly active = new Map<string, Active>();
	private observer: MutationObserver | null = null;
	private scheduled = false;
	private seq = 0;
	private started = false;

	start(): void {
		if (!this.browser || this.started) return;
		this.started = true;
		effect(() => {
			const want: Record<string, { sha: string; url: string }> = {};
			for (const k of Object.keys(this.identity.manifest().items)) {
				const id = symbolIdOf(k); if (!id) continue;
				const it = this.identity.item(k); if (!it) continue;
				want[id] = { sha: it.sha256, url: this.identity.absoluteUrl(it.url) };
			}
			void this.sync(want);
		}, { injector: this.injector });
	}

	/** the ids that are currently drawn from a published file (specs, admin page) */
	activeIds(): string[] { return [...this.active.keys()]; }

	/** (exposed for specs and the admin preview) make the document show `svgText` for `<symbol id=symbolId>`; false when the file is not a usable icon */
	applyText(symbolId: string, svgText: string, sha = ''): boolean {
		const parsed = parseCustomSvg(svgText, sha);
		if (!parsed) return false;
		this.active.set(symbolId, { sha, icon: parsed });
		for (const [el, s] of this.saved) if (s.id === symbolId && el.isConnected) this.render(el, parsed);
		this.scan();
		this.observe();
		return true;
	}

	/** (specs) restore the default markup of one id */
	clear(symbolId: string): void {
		this.active.delete(symbolId);
		for (const [el, s] of [...this.saved]) {
			if (s.id !== symbolId) continue;
			if (el.isConnected) this.restore(el, s);
			this.saved.delete(el);
		}
		if (!this.active.size) { this.observer?.disconnect(); this.observer = null; }
	}

	private async sync(want: Record<string, { sha: string; url: string }>): Promise<void> {
		const my = ++this.seq;
		// ids that are not customised any more go back to their default markup at once
		for (const id of [...this.active.keys()]) if (!want[id]) this.clear(id);
		const todo = Object.entries(want).filter(([id, w]) => this.active.get(id)?.sha !== w.sha);
		this.pruneCache(new Set(Object.values(want).map(w => w.sha)));
		if (!todo.length) return;
		const texts = new Map<string, string>();
		await Promise.all(todo.map(async ([id, w]) => {
			let text = this.readCached(w.sha);
			if (text === null) {
				try {
					const res = await fetch(w.url, { cache: 'force-cache', credentials: 'omit' });
					if (!res.ok) throw new Error('HTTP ' + res.status);
					text = await res.text();
				} catch { if (my === this.seq) this.identity.reportBroken(w.url); return; }
			}
			texts.set(id, text);
		}));
		if (my !== this.seq) return;
		// the server-rendered DOM is hydrated first (rewriting symbols before hydration made Angular throw NG0500 for the AI icon runtime); bounded wait, then apply anyway
		try { await Promise.race([this.appRef.whenStable(), new Promise(r => setTimeout(r, 6000))]); } catch { /* apply anyway */ }
		if (my !== this.seq) return;
		for (const [id, text] of texts) {
			const w = want[id];
			if (!this.applyText(id, text, w.sha)) { this.identity.reportBroken(w.url); continue; }
			this.writeCached(w.sha, text);
		}
	}

	private observe(): void {
		if (this.observer || typeof MutationObserver === 'undefined') return;
		this.observer = new MutationObserver(() => {
			if (this.scheduled) return;
			this.scheduled = true;
			queueMicrotask(() => { this.scheduled = false; if (this.active.size) this.scan(); });
		});
		this.observer.observe(this.doc.documentElement, { childList: true, subtree: true });
	}

	private scan(): void {
		for (const el of this.saved.keys()) if (!el.isConnected) this.saved.delete(el);
		this.doc.querySelectorAll('symbol[id]').forEach(s => {
			const a = this.active.get(s.id);
			if (!a || this.saved.has(s)) return;
			this.saved.set(s, { attrs: new Map(['viewBox', 'preserveAspectRatio'].map(n => [n, s.getAttribute(n)] as [string, string | null])), html: s.innerHTML, id: s.id });
			this.render(s, a.icon);
		});
	}

	private render(el: Element, icon: ParsedSvgIcon): void {
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
