import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CSS_BOUND_ICONS, ICON_ALIASES, IconSymbolsRuntime, WS_ICON_ATTR, cssVarOf } from './identity-icon-symbols';
import { SiteIdentityService } from './site-identity.service';
import { EMPTY_MANIFEST, IdentityManifest } from './site-identity.models';

// Round 7 adapters: inline / TypeScript-built <svg data-ws-icon>, aliases, CSS variables, lazy per-id fetching, restore byte-identity.
const BELL_INLINE = '<svg class="w-7 h-7 host" data-ws-icon="i-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
const SIDEBAR = '<svg aria-hidden="true" data-ws-icon="i-bell" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-4 h-4"><path stroke-linecap="round" d="M15 17h5"/></svg>';
const SPA = '<svg><symbol id="spa-i-bell2" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8"/></symbol></svg>';
const parsed = (h: string): string => { const d = document.createElement('div'); d.innerHTML = h; return d.innerHTML; };
const FILE_STROKE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3"><rect x="4" y="4" width="24" height="24"/></svg>';
const FILE = (n: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><rect x="${n}" y="4" width="24" height="24"/></svg>`;

describe('icon adapters (inline svg, alias, CSS variable, lazy fetch)', () => {
	let rt: IconSymbolsRuntime; let host: HTMLElement; let snap: string;
	beforeEach(() => {
		TestBed.resetTestingModule(); rt = TestBed.inject(IconSymbolsRuntime);
		host = document.createElement('div'); host.innerHTML = BELL_INLINE + SIDEBAR + SPA; document.body.appendChild(host); snap = host.innerHTML;
	});
	afterEach(() => { for (const id of ['i-bell', 'spa-i-bell2', 'x-css']) rt.clear(id); delete (CSS_BOUND_ICONS as Record<string, readonly string[]>)['x-css']; host.remove(); });

	it('DEFAULT: an svg that carries data-ws-icon is untouched until a file is published (DOM byte-identical)', () => { expect(host.innerHTML).toBe(snap); expect(WS_ICON_ATTR).toBe('data-ws-icon'); });

	it('custom: the drawing and viewBox are swapped, the place keeps its own classes, size attributes, colour and stroke settings', () => {
		rt.applyText('i-bell', FILE(4), 's1');
		for (const svg of host.querySelectorAll('svg[data-ws-icon]')) {
			expect(svg.getAttribute('viewBox')).toBe('0 0 32 32'); expect(svg.querySelector('rect')).not.toBeNull(); expect(svg.querySelector('path')).toBeNull();
		}
		const a = host.querySelector('svg.host')!; expect(a.getAttribute('class')).toBe('w-7 h-7 host'); expect(a.getAttribute('stroke')).toBe('currentColor'); expect(a.getAttribute('stroke-width')).toBe('1.8');
		expect(host.querySelector('svg.w-4')!.getAttribute('stroke-width')).toBe('1.5');
	});

	it('RESTORE: clear() brings every inline copy back byte-identical (attributes and children)', () => {
		rt.applyText('i-bell', FILE(4), 's1'); expect(host.innerHTML).not.toBe(snap); rt.clear('i-bell'); expect(host.innerHTML).toBe(snap);
	});

	it('an svg added later (route change, innerHTML of a notification row) is swapped by the observer, and restored too', async () => {
		rt.applyText('i-bell', FILE(4), 's1');
		const row = document.createElement('div'); row.innerHTML = '<span>' + BELL_INLINE + '</span>'; host.appendChild(row);
		await new Promise(r => setTimeout(r, 0));
		expect(row.querySelector('rect')).not.toBeNull();
		rt.clear('i-bell'); expect(row.innerHTML).toBe(parsed('<span>' + BELL_INLINE + '</span>'));
	});

	it('an svg that gets data-ws-icon AFTER it was inserted (Angular bound attribute) is swapped; removing the attribute restores it', async () => {
		rt.applyText('i-bell', FILE(4), 's1');
		const late = document.createElement('div'); late.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M15 17h5"/></svg>'; host.appendChild(late); await new Promise(r => setTimeout(r, 0));
		const svg = late.querySelector('svg')!; expect(svg.querySelector('rect')).toBeNull();
		svg.setAttribute('data-ws-icon', 'i-bell'); await new Promise(r => setTimeout(r, 0));
		expect(svg.querySelector('rect')).not.toBeNull(); expect(svg.getAttribute('viewBox')).toBe('0 0 32 32');
	});

	it('a newer version redraws what is already swapped; an unrelated id is never touched', () => {
		rt.applyText('i-bell', FILE(4), 's1'); rt.applyText('i-bell', FILE(8), 's2');
		expect(host.querySelector('svg.host rect')!.getAttribute('x')).toBe('8');
		rt.applyText('i-other', FILE(1), 's3'); expect(host.querySelectorAll('rect').length).toBe(3); rt.clear('i-other');
	});

	it('ALIAS: a second symbol id that is the same element follows its target until it has its own file', () => {
		expect(ICON_ALIASES['spa-i-bell2']).toBe('i-bell');
		const sym = host.querySelector('symbol')!;
		rt.applyText('i-bell', FILE(4), 's1'); expect(sym.querySelector('rect')).not.toBeNull(); expect(sym.getAttribute('viewBox')).toBe('0 0 32 32');
		rt.applyText('spa-i-bell2', FILE(9), 'own'); expect(sym.querySelector('rect')!.getAttribute('x')).toBe('9');
		rt.clear('spa-i-bell2'); expect(sym.querySelector('rect')!.getAttribute('x')).toBe('4');
		rt.clear('i-bell'); expect(host.innerHTML).toBe(snap);
	});

	it('CSS variables: a CSS-bound key is published ONCE PER COLOUR (the file\'s currentColor replaced by that exact colour, 12px square, the file\'s own paint) and removed on restore; other keys never set them', () => {
		(CSS_BOUND_ICONS as Record<string, readonly string[]>)['x-css'] = ['a8b2d1', '475569'];
		rt.applyText('x-css', FILE_STROKE, 'c1');
		const dark = document.documentElement.style.getPropertyValue(cssVarOf('x-css', 'A8B2D1')), light = document.documentElement.style.getPropertyValue(cssVarOf('x-css', '475569'));
		expect(dark).toContain('data:image/svg+xml,'); expect(light).toContain('data:image/svg+xml,');
		const d = decodeURIComponent(dark), l = decodeURIComponent(light);
		expect(d).toContain('width="12"'); expect(d).toContain('height="12"'); expect(d).toContain('viewBox="0 0 32 32"'); expect(d).toContain('stroke="#a8b2d1"'); expect(d).not.toMatch(/currentColor/i); expect(d).toContain('<rect');
		expect(l).toContain('stroke="#475569"'); expect(l).not.toContain('a8b2d1');
		expect(document.documentElement.style.getPropertyValue(cssVarOf('x-css', 'ffffff'))).toBe('');
		rt.applyText('i-bell', FILE(2), 'c2'); expect(document.documentElement.style.getPropertyValue(cssVarOf('i-bell', 'a8b2d1'))).toBe('');
		rt.clear('x-css'); expect(document.documentElement.style.getPropertyValue(cssVarOf('x-css', 'a8b2d1'))).toBe(''); expect(document.documentElement.style.getPropertyValue(cssVarOf('x-css', '475569'))).toBe('');
	});
});

describe('lazy fetching and no flash', () => {
	const manifest = (ids: string[]): IdentityManifest => ({ ...EMPTY_MANIFEST, version: 3, items: Object.fromEntries(ids.map(id => ['icon.fn.' + id, { url: '/f/' + id, sha256: 'sha-' + id, mime: 'image/svg+xml', width: 32, height: 32, version: 1 }])) } as IdentityManifest);
	it('only the icons PRESENT in the document are fetched (a page uses a few of the ~340); a late element triggers its own fetch', async () => {
		const m = signal(manifest(['i-bell', 'i-wallet', 'i-never-on-page']));
		const fetched: string[] = [];
		vi.stubGlobal('fetch', vi.fn(async (u: string) => { fetched.push(u); return new Response(FILE(5), { status: 200 }); }));
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ providers: [{ provide: SiteIdentityService, useValue: { manifest: m, item: (k: string) => m().items[k], absoluteUrl: (u: string) => u, reportBroken: vi.fn() } }] });
		const rt = TestBed.inject(IconSymbolsRuntime);
		const host = document.createElement('div'); host.innerHTML = BELL_INLINE; document.body.appendChild(host);
		localStorage.clear();
		rt.start();
		await TestBed.inject(ApplicationRef).whenStable(); await new Promise(r => setTimeout(r, 20));
		expect(fetched).toEqual(['/f/i-bell']);
		expect(host.querySelector('svg rect')).not.toBeNull();
		const late = document.createElement('div'); late.innerHTML = '<svg data-ws-icon="i-wallet" viewBox="0 0 24 24"><path d="M0 0"/></svg>'; host.appendChild(late);
		await new Promise(r => setTimeout(r, 20));
		expect(fetched).toEqual(['/f/i-bell', '/f/i-wallet']); expect(late.querySelector('rect')).not.toBeNull();
		// the manifest drops i-bell: restored byte-identical at once
		m.set(manifest(['i-wallet'])); await new Promise(r => setTimeout(r, 10));
		expect(host.querySelector('svg.host')!.outerHTML).toBe(parsed(BELL_INLINE));
		host.remove(); rt.clear('i-wallet'); vi.unstubAllGlobals(); localStorage.clear();
	});
});
