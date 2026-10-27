import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDENTITY_CACHE_KEY, SiteIdentityService } from './site-identity.service';
import { IdentityTokensRuntime, TOKENS_STYLE_ID } from './identity-tokens';
import { parseManifest, safeTokensCss } from './site-identity.models';

const CSS = ':root{--radius:24px}\n:root:not(.theme-light):not(.light-theme){--pg:#0b1020;--teal:#14b8a6}\n.theme-light.theme-light,.light-theme.light-theme{--pg:#f0f4ff;--teal:#0d9488}';
const SHA = 'a'.repeat(64);
const man = (tokensCss?: unknown) => ({ success: true, data: { version: 5, items: { 'tokens.layout': { url: '/public/site-identity/assets/tokens.layout/' + SHA, sha256: SHA, mime: 'application/json', width: null, height: null, version: 1, value: { '--radius': '24px' } } }, ...(tokensCss === undefined ? {} : { tokensCss }) } });
const styleEl = () => document.getElementById(TOKENS_STYLE_ID);

describe('safeTokensCss: the one string that becomes a <style> is re-validated in the browser', () => {
	it('accepts exactly the server shape (1-3 known rules of --name:value declarations)', () => {
		expect(safeTokensCss(CSS)).toBe(CSS);
		expect(safeTokensCss(':root{--font-family:\'Cairo\',system-ui,sans-serif}')).not.toBe('');
		expect(safeTokensCss(':root{--card-shadow:0 2px 10px rgba(15,23,42,.08),0 1px 3px rgba(15,23,42,.05)}')).not.toBe('');
		expect(safeTokensCss(':root{--grad:linear-gradient(135deg,#2bd4c7 0%,#2b7fff 100%)}')).not.toBe('');
	});
	it('rejects everything else: other selectors, url(), @import, braces/semicolon tricks, comments, </style>, non-strings, empty, huge', () => {
		for (const bad of [
			'body{--a:1}', ':root{--a:1}\nhtml{display:none}', ':root{--a:url(http://x)}', '@import "x";:root{--a:1}', ':root{--a:1;}}body{x:y}', ':root{--a:1;background:red}',
			':root{--a:1/* c */}', ':root{--a:1}</style><script>alert(1)</script>', ':root{--a:expression(1)}', ':root{color:red}', ':root{--a:\\41}', '', '   ', ':root{}',
			':root{--a:1}'.repeat(4), ':root{--a:' + 'x'.repeat(300) + '}',
		]) expect(safeTokensCss(bad), bad.slice(0, 40)).toBe('');
		for (const nonString of [null, undefined, 5, {}, [CSS]]) expect(safeTokensCss(nonString)).toBe('');
		expect(safeTokensCss('a'.repeat(30_000))).toBe('');
	});
	it('parseManifest keeps `value` of token items and a safe tokensCss; a hostile tokensCss is dropped (manifest otherwise fine)', () => {
		const ok = parseManifest(man(CSS))!;
		expect(ok.tokensCss).toBe(CSS); expect(ok.items['tokens.layout'].value).toEqual({ '--radius': '24px' });
		const bad = parseManifest(man('body{display:none}'))!;
		expect(bad.tokensCss).toBe(''); expect(bad.version).toBe(5);
		expect(parseManifest(man())!.tokensCss).toBe('');
	});
});

describe('IdentityTokensRuntime: <style id="ws-identity-tokens"> only when overrides exist', () => {
	beforeEach(() => { styleEl()?.remove(); localStorage.removeItem(IDENTITY_CACHE_KEY); });
	afterEach(() => { styleEl()?.remove(); vi.unstubAllGlobals(); });
	const setup = () => { TestBed.resetTestingModule(); return { svc: TestBed.inject(SiteIdentityService), rt: TestBed.inject(IdentityTokensRuntime) }; };

	it('NO overrides: no element at all (the default look is byte-identical to what ships)', () => {
		const { rt } = setup(); rt.start();
		expect(styleEl()).toBeNull();
		expect(document.head.querySelectorAll('style#' + TOKENS_STYLE_ID).length).toBe(0);
	});
	it('overrides published: ONE style element, as the LAST child of <head>, its text = the validated CSS', () => {
		const { svc, rt } = setup(); rt.start();
		svc.apply(parseManifest(man(CSS))!, false); TestBed.flushEffects();
		expect(document.querySelectorAll('#' + TOKENS_STYLE_ID).length).toBe(1);
		expect(styleEl()!.textContent).toBe(CSS);
		expect(document.head.lastElementChild).toBe(styleEl());
		const lateSheet = document.createElement('style'); lateSheet.textContent = '.x{}'; document.head.appendChild(lateSheet);
		svc.apply(parseManifest({ ...man(CSS), data: { ...man(CSS).data, version: 6, tokensCss: CSS.replace('24px', '20px') } })!, false); TestBed.flushEffects();
		expect(document.head.lastElementChild).toBe(styleEl()); expect(styleEl()!.textContent).toContain('20px');
		lateSheet.remove();
	});
	it('rollback (manifest without overrides) removes the element; a failed refresh keeps the last good CSS', async () => {
		const { svc, rt } = setup(); rt.start();
		svc.apply(parseManifest(man(CSS))!, false); TestBed.flushEffects(); expect(styleEl()).not.toBeNull();
		vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
		expect(await svc.refresh(true)).toBe(false); TestBed.flushEffects();
		expect(styleEl()!.textContent).toBe(CSS);
		svc.apply(parseManifest({ success: true, data: { version: 7, items: {} } })!, false); TestBed.flushEffects();
		expect(styleEl()).toBeNull();
	});
	it('a returning visitor: the remembered manifest (with its CSS) is applied at start, before any network', () => {
		localStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify(parseManifest(man(CSS))));
		const { rt } = setup(); rt.start();
		expect(styleEl()!.textContent).toBe(CSS);
	});
	it('an element that index.html already injected is taken over (not duplicated)', () => {
		const pre = document.createElement('style'); pre.id = TOKENS_STYLE_ID; pre.textContent = ':root{--radius:1px}'; document.head.appendChild(pre);
		const { svc, rt } = setup(); rt.start();
		svc.apply(parseManifest(man(CSS))!, false); TestBed.flushEffects();
		expect(document.querySelectorAll('#' + TOKENS_STYLE_ID).length).toBe(1); expect(styleEl()!.textContent).toBe(CSS);
	});
});
