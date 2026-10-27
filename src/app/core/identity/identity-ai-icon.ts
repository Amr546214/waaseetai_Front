import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ApplicationRef, Injectable, Injector, PLATFORM_ID, effect, inject } from '@angular/core';
import { AI_ICON_INNER } from '../constants/ai-icon';
import { SiteIdentityService } from './site-identity.service';

const SVGNS = 'http://www.w3.org/2000/svg';
const AI_ID_RULE = /(^|-)ai$/; // the same rule ai-icon.static.spec.ts uses for "an AI-named symbol"
const KEY = 'icon.ai';
const SVG_CACHE_PREFIX = 'ws-site-identity-svg-';
const PAINT_ATTRS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'fill-rule', 'clip-rule', 'opacity', 'color'] as const;

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

export interface ParsedSvgIcon { viewBox: string; attrs: Record<string, string>; children: Element[] }
/** the custom SVG as served by the BE (already sanitised there); parsed again defensively: no scripts, no handlers, no external references reach the DOM */
export function parseCustomSvg(text: string): ParsedSvgIcon | null {
	try {
		const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
		const root = doc.documentElement;
		if (!root || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
		doc.querySelectorAll('script,foreignObject,iframe,object,embed,style,image,use').forEach(n => n.remove());
		doc.querySelectorAll('*').forEach(n => Array.from(n.attributes).forEach(a => { if (/^on/i.test(a.name) || /^(xlink:)?href$/i.test(a.name) || /url\(\s*['"]?(?!#)/i.test(a.value)) n.removeAttribute(a.name); }));
		const vb = root.getAttribute('viewBox') || (root.getAttribute('width') && root.getAttribute('height') ? `0 0 ${parseFloat(root.getAttribute('width')!)} ${parseFloat(root.getAttribute('height')!)}` : '0 0 24 24');
		const attrs: Record<string, string> = {};
		for (const a of PAINT_ATTRS) { const v = root.getAttribute(a); if (v !== null) attrs[a] = v; }
		const children = Array.from(root.children);
		return children.length ? { viewBox: vb, attrs, children } : null;
	} catch { return null; }
}

interface Saved { attrs: Map<string, string | null>; html: string }

/**
 * Replaces the AI mark at runtime ONLY while a custom `icon.ai` is published. With the default nothing is touched at all: the templates' own <symbol> markup stays byte-for-byte
 * what ships today (stroke-width 1.8 / 2, linecap, viewBox ...).
 * Where it applies: every <symbol> whose id is AI-named (`i-ai`, `ws-trust-ai`, `rp-i-ai`...) AND whose geometry is the official mark (so a look-alike or functional symbol is never touched),
 * plus every inline <svg> that draws the official geometry directly (templates, TS-built notification icons). Later-rendered copies are caught by a MutationObserver; rollback restores each
 * element's saved original attributes and markup.
 * Colour policy: a custom icon that sets its own fill/stroke on the root keeps them; otherwise it inherits the caller's `currentColor` styling exactly like the default.
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
		const parsed = parseCustomSvg(svgText);
		if (!parsed) return false;
		this.active = parsed; this.activeSha = sha;
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
		for (const a of ['viewBox', ...PAINT_ATTRS]) keep.set(a, el.getAttribute(a));
		this.saved.set(el, { attrs: keep, html: el.innerHTML });
		el.setAttribute('viewBox', icon.viewBox);
		while (el.firstChild) el.removeChild(el.firstChild);
		// Paint the uploaded file declared on its root (fill, stroke, stroke-width, opacity...) goes on a <g> INSIDE the symbol: a presentation attribute on the <symbol> itself loses against the
		// page's `fill:none; stroke:currentColor` on the outer <svg> (it never reached the shapes), a <g> inside always wins over inheritance. Whatever the file does NOT declare keeps inheriting the
		// caller's currentColor outline (the platform AI purple), exactly like the default mark.
		const painted = Object.keys(icon.attrs).length > 0;
		const host: Element = painted ? el.ownerDocument.createElementNS(SVGNS, 'g') : el;
		if (painted) { for (const [k, v] of Object.entries(icon.attrs)) host.setAttribute(k, v); el.appendChild(host); }
		for (const c of icon.children) host.appendChild(this.doc.importNode(c, true));
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
