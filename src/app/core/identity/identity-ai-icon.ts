import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ApplicationRef, Injectable, Injector, PLATFORM_ID, effect, inject } from '@angular/core';
import { AI_ICON_INNER } from '../constants/ai-icon';
import { SiteIdentityService } from './site-identity.service';

const SVGNS = 'http://www.w3.org/2000/svg';
const AI_ID_RULE = /(^|-)ai$/; // the same rule ai-icon.static.spec.ts uses for "an AI-named symbol"
const KEY = 'icon.ai';
const SVG_CACHE_PREFIX = 'ws-site-identity-svg-';
/** presentation properties that may sit on the root / be set by the file's own <style>; everything else in a style is dropped */
const PAINT_PROPS = ['fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'paint-order', 'opacity', 'color', 'display', 'visibility'] as const;
const PAINT_ATTRS = PAINT_PROPS;
/** the SVG initial values of every INHERITED paint property: a file that does not declare a property gets exactly what it would get as a standalone file, never what the host <svg> around the <use> sets (stroke/fill/stroke-width of the site's outline icons) */
const SVG_INITIAL: Readonly<Record<string, string>> = { fill: '#000', 'fill-opacity': '1', 'fill-rule': 'nonzero', 'clip-rule': 'nonzero', stroke: 'none', 'stroke-opacity': '1', 'stroke-width': '1', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'stroke-miterlimit': '4', 'stroke-dasharray': 'none', 'stroke-dashoffset': '0', 'paint-order': 'normal' };
/** NOT reset on purpose: `color` (so `currentColor` in the file follows the colour the site gives the icon, e.g. the AI purple) */

/**
 * The attributes of the wrapper <g> that carries a custom icon: SVG initial values for every inherited paint property, then what the file's root declared (attribute or style).
 * Exported so the admin preview draws the icon EXACTLY like the site does.
 */
export function paintGroupAttrs(icon: ParsedSvgIcon): Record<string, string> {
	const out: Record<string, string> = { ...SVG_INITIAL };
	for (const [k, v] of Object.entries(icon.attrs)) out[k] = v;
	return out;
}

/** geometry signature of an element's drawing: the shapes (tag + geometry attributes), ignoring paint (stroke-width etc.) and whitespace */
export function geometrySignature(el: Element): string {
	const out: string[] = [];
	for (const n of Array.from(el.children)) {
		const tag = n.localName;
		const g = (a: string) => n.getAttribute(a) ?? '';
		if (tag === 'circle') out.push(`c:${g('cx')},${g('cy')},${g('r')}`);
		else if (tag === 'path') out.push(`p:${g('d').replace(/\s+/g, '')}`);
		else out.push(`x:${tag}`);
	}
	return out.join('|');
}
let canonical: string | null = null;
export function officialAiSignature(): string {
	if (canonical === null) {
		const host = document.createElementNS(SVGNS, 'svg');
		host.innerHTML = AI_ICON_INNER;
		canonical = geometrySignature(host);
	}
	return canonical;
}

export interface ParsedSvgIcon { viewBox: string; preserveAspectRatio: string | null; attrs: Record<string, string>; children: Element[] }

/** `a:b;c:d` -> the declarations whose property is a paint property and whose value cannot reach outside the document */
function paintDeclarations(css: string): Array<[string, string]> {
	const out: Array<[string, string]> = [];
	for (const part of css.replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
		const i = part.indexOf(':'); if (i < 1) continue;
		const prop = part.slice(0, i).trim().toLowerCase(), val = part.slice(i + 1).replace(/!important/i, '').trim();
		if (!(PAINT_PROPS as readonly string[]).includes(prop) || !val || val.length > 200 || /url\(\s*['"]?(?!#)|expression|javascript:|@import|[{}<>\\]/i.test(val)) continue;
		out.push([prop, val]);
	}
	return out;
}

/** the file's own <style> rules (class / id / tag selectors) are moved onto the elements as inline style, so the drawing keeps its colours without a document-wide <style> that could touch the site */
function inlineStyleSheets(doc: Document): void {
	const root = doc.documentElement;
	for (const st of Array.from(doc.getElementsByTagName('style'))) {
		try {
			const text = (st.textContent ?? '').replace(/@import[^;]*;?/gi, '');
			const sheet = new CSSStyleSheet(); sheet.replaceSync(text);
			for (const rule of Array.from(sheet.cssRules)) {
				if (!(rule instanceof CSSStyleRule)) continue;
				const decls = paintDeclarations(rule.style.cssText);
				if (!decls.length) continue;
				for (const sel of rule.selectorText.split(',')) {
					let targets: Element[] = [];
					try { targets = sel.trim() === ':root' ? [root] : Array.from(doc.querySelectorAll(sel.trim())); } catch { continue; }
					for (const t of targets) { const have = paintDeclarations(t.getAttribute('style') ?? '').filter(([p]) => !decls.some(([q]) => q === p)); t.setAttribute('style', [...have, ...decls].map(([p, v]) => `${p}:${v}`).join(';')); }
				}
			}
		} catch { /* an unreadable style sheet: its rules are ignored, the attributes stay */ }
	}
}

/**
 * the custom SVG as served by the BE (already sanitised there); parsed again defensively: no scripts, no handlers, no external references reach the DOM.
 * The drawing keeps its own paint semantics (attributes, inline style, the file's own style rules); `sha` namespaces the file's ids so several copies / other page ids never collide.
 */
export function parseCustomSvg(text: string, sha = ''): ParsedSvgIcon | null {
	try {
		const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
		const root = doc.documentElement;
		if (!root || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
		doc.querySelectorAll('script,foreignObject,iframe,object,embed,image,use').forEach(n => n.remove());
		inlineStyleSheets(doc);
		doc.querySelectorAll('style').forEach(n => n.remove());
		doc.querySelectorAll('*').forEach(n => Array.from(n.attributes).forEach(a => { if (/^on/i.test(a.name) || /^(xlink:)?href$/i.test(a.name) || /url\(\s*['"]?(?!#)/i.test(a.value)) n.removeAttribute(a.name); }));
		// ids (gradients, clip paths, masks ...) get a per-file prefix; every `url(#id)` reference follows
		const prefix = 'wsai' + (sha ? sha.slice(0, 8) : 'x') + '-';
		const ids = new Map<string, string>();
		doc.querySelectorAll('[id]').forEach(n => { const old = n.getAttribute('id')!; ids.set(old, prefix + old); n.setAttribute('id', prefix + old); });
		if (ids.size) doc.querySelectorAll('*').forEach(n => Array.from(n.attributes).forEach(a => { if (a.name !== 'id' && a.value.includes('url(')) n.setAttribute(a.name, a.value.replace(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g, (m, id) => ids.has(id) ? `url(#${ids.get(id)})` : m)); }));
		const vb = root.getAttribute('viewBox') || (root.getAttribute('width') && root.getAttribute('height') ? `0 0 ${parseFloat(root.getAttribute('width')!)} ${parseFloat(root.getAttribute('height')!)}` : '0 0 24 24');
		const attrs: Record<string, string> = {};
		for (const a of PAINT_PROPS) { const v = root.getAttribute(a); if (v !== null) attrs[a] = v; }
		for (const [k, v] of paintDeclarations(root.getAttribute('style') ?? '')) attrs[k] = v; // style beats the presentation attribute, as in a browser
		const children = Array.from(root.children);
		return children.length ? { viewBox: vb, preserveAspectRatio: root.getAttribute('preserveAspectRatio'), attrs, children } : null;
	} catch { return null; }
}

interface Saved { attrs: Map<string, string | null>; html: string }

/**
 * Replaces the AI mark at runtime ONLY while a custom `icon.ai` is published. With the default nothing is touched at all: the templates' own <symbol> markup stays byte-for-byte
 * what ships today (stroke-width 1.8 / 2, linecap, viewBox ...).
 * Where it applies: every <symbol> whose id is AI-named (`i-ai`, `ws-trust-ai`, `rp-i-ai`...) AND whose geometry is the official mark (so a look-alike or functional symbol is never touched),
 * plus every inline <svg> that draws the official geometry directly (templates, TS-built notification icons). Later-rendered copies are caught by a MutationObserver; rollback restores each
 * element's saved original attributes and markup.
 * Paint policy (Round 5): the file's own fill / stroke semantics are kept exactly (root attributes, root style, the file's <style> rules, per-shape attributes); a property the file does not
 * declare gets the SVG initial value, never the host's outline paint; `currentColor` follows the colour the site gives the icon.
 */
@Injectable({ providedIn: 'root' })
export class AiIconRuntime {
	private readonly identity = inject(SiteIdentityService);
	private readonly doc = inject(DOCUMENT);
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly injector = inject(Injector);
	private readonly appRef = inject(ApplicationRef);
	private readonly saved = new Map<Element, Saved>();
	private observer: MutationObserver | null = null;
	private active: ParsedSvgIcon | null = null;
	private activeSha = '';
	private scheduled = false;
	private seq = 0;

	start(): void {
		if (!this.browser) return;
		effect(() => {
			const it = this.identity.item(KEY);
			const url = it ? this.identity.absoluteUrl(it.url) : null;
			void this.sync(it?.sha256 ?? '', url);
		}, { injector: this.injector });
	}

	/** (exposed for specs and the admin preview) make the document show `svgText` as the AI icon, or restore the default when null */
	applyText(svgText: string | null, sha = ''): boolean {
		if (svgText === null) { this.deactivate(); return true; }
		const parsed = parseCustomSvg(svgText, sha);
		if (!parsed) return false;
		this.active = parsed; this.activeSha = sha;
		// a newer custom version over an older one (no rollback in between): redraw what is already replaced, then pick up the rest
		for (const el of this.saved.keys()) if (el.isConnected) this.render(el, parsed);
		this.scan(this.doc.documentElement);
		this.observe();
		return true;
	}

	private async sync(sha: string, url: string | null): Promise<void> {
		const my = ++this.seq;
		if (!url) { this.deactivate(); return; }
		if (this.active && this.activeSha === sha) return;
		let text = this.readCached(sha);
		if (text === null) {
			try {
				const res = await fetch(url, { cache: 'force-cache', credentials: 'omit' });
				if (!res.ok) throw new Error('HTTP ' + res.status);
				text = await res.text();
			} catch { if (my === this.seq) { this.identity.reportBroken(url); } return; }
			if (my !== this.seq) return;
		}
		// the server-rendered DOM is hydrated first: rewriting the AI <symbol>s before hydration finished made Angular throw NG0500 (expected <circle> but found <rect>) for a visitor whose custom icon was already cached
		try { await Promise.race([this.appRef.whenStable(), new Promise(r => setTimeout(r, 6000))]); } catch { /* apply anyway */ }
		if (my !== this.seq) return;
		if (!this.applyText(text, sha)) { this.identity.reportBroken(url); return; }
		this.writeCached(sha, text);
	}

	private deactivate(): void {
		this.active = null; this.activeSha = '';
		this.observer?.disconnect(); this.observer = null;
		for (const [el, s] of this.saved) {
			if (el.isConnected) this.restore(el, s);
		}
		this.saved.clear();
	}

	private observe(): void {
		if (this.observer || typeof MutationObserver === 'undefined') return;
		this.observer = new MutationObserver(() => {
			if (this.scheduled) return;
			this.scheduled = true;
			queueMicrotask(() => { this.scheduled = false; if (this.active) this.scan(this.doc.body ?? this.doc.documentElement); });
		});
		this.observer.observe(this.doc.documentElement, { childList: true, subtree: true });
	}

	private scan(root: Element): void {
		const icon = this.active; if (!icon) return;
		const want = officialAiSignature();
		this.prune();
		const targets: Element[] = [];
		root.querySelectorAll('symbol[id]').forEach(s => { if (AI_ID_RULE.test(s.id) && !this.saved.has(s) && geometrySignature(s) === want) targets.push(s); });
		root.querySelectorAll('svg').forEach(s => { if (!this.saved.has(s) && s.children.length >= 8 && geometrySignature(s) === want) targets.push(s); });
		for (const t of targets) this.replace(t, icon);
	}

	private replace(el: Element, icon: ParsedSvgIcon): void {
		const keep = new Map<string, string | null>();
		for (const a of ['viewBox', 'preserveAspectRatio']) keep.set(a, el.getAttribute(a));
		this.saved.set(el, { attrs: keep, html: el.innerHTML });
		this.render(el, icon);
	}
	private render(el: Element, icon: ParsedSvgIcon): void {
		el.setAttribute('viewBox', icon.viewBox);
		if (icon.preserveAspectRatio) el.setAttribute('preserveAspectRatio', icon.preserveAspectRatio); else el.removeAttribute('preserveAspectRatio');
		while (el.firstChild) el.removeChild(el.firstChild);
		// The uploaded file keeps its own meaning of fill and stroke. Everything the host <svg> around the <use> says about fill / stroke / stroke-width / linecap ... would be INHERITED into the
		// drawing (the site's outline icons are `fill:none; stroke:currentColor; stroke-width:1.8`), so the drawing sits in a <g> that first resets every inherited paint property to the SVG
		// initial value and then applies what the file's root declared. Nothing is forced: no colour, no stroke, no fill that the file did not ask for. `color` is left inheriting, so
		// `currentColor` in the file follows the colour the site gives the icon (the AI purple), exactly like the default mark.
		const g = el.ownerDocument.createElementNS(SVGNS, 'g');
		for (const [k, v] of Object.entries(paintGroupAttrs(icon))) g.setAttribute(k, v);
		el.appendChild(g);
		for (const c of icon.children) g.appendChild(this.doc.importNode(c, true));
	}
	private restore(el: Element, s: Saved): void {
		for (const [k, v] of s.attrs) { if (v === null) el.removeAttribute(k); else el.setAttribute(k, v); }
		el.innerHTML = s.html;
	}
	private prune(): void { for (const el of this.saved.keys()) if (!el.isConnected) this.saved.delete(el); }

	private readCached(sha: string): string | null {
		if (!sha) return null;
		try { return this.doc.defaultView?.localStorage.getItem(SVG_CACHE_PREFIX + sha) ?? null; } catch { return null; }
	}
	private writeCached(sha: string, text: string): void {
		if (!sha || text.length > 70_000) return;
		try {
			const ls = this.doc.defaultView?.localStorage; if (!ls) return;
			for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k && k.startsWith(SVG_CACHE_PREFIX) && k !== SVG_CACHE_PREFIX + sha) ls.removeItem(k); }
			ls.setItem(SVG_CACHE_PREFIX + sha, text);
		} catch { /* ignore */ }
	}
}
