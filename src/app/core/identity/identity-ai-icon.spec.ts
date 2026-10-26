/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiIconRuntime, geometrySignature, officialAiSignature, parseCustomSvg } from './identity-ai-icon';
import { AI_ICON_INNER } from '../constants/ai-icon';

const APP = join(__dirname, '../..');
const sym = (rel: string, id = 'i-ai') => new RegExp(`<symbol\\s+id="${id}"[\\s\\S]*?</symbol>`).exec(readFileSync(join(APP, rel), 'utf8'))![0];
// the REAL shipped definitions (not copies): stroke-width 1.8 in the shells, 2 in client-overview
const NAV = sym('sheards/navbar/navbar.html');
const CLIENT = sym('pages/dashboard/clients-overview/client-overview/client-overview.component.html');
const WALLET = sym('pages/dashboard/provider-overview/finance/wallet/wallet.html', 'i-wallet');
const TRUST = sym('pages/website/home/home.component.html', 'ws-trust-ai');
const LOOKALIKE = '<symbol id="ws-ai-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/></symbol>';
const INLINE = `<svg id="inl" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${AI_ICON_INNER}</svg>`;
const CUSTOM = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="6"/><script>alert(1)</script></svg>';

describe('AiIconRuntime', () => {
	let rt: AiIconRuntime; let host: HTMLElement; let snap: string;
	beforeEach(() => {
		TestBed.resetTestingModule(); rt = TestBed.inject(AiIconRuntime);
		host = document.createElement('div');
		host.innerHTML = `<svg style="display:none"><defs>${NAV}${CLIENT}${WALLET}${TRUST}${LOOKALIKE}</defs></svg>${INLINE}<svg><use href="#i-ai"></use></svg>`;
		document.body.appendChild(host); snap = host.innerHTML;
	});
	afterEach(() => { rt.applyText(null); host.remove(); });

	it('the shipped definitions all draw the official geometry (signature check is what selects the targets)', () => {
		const want = officialAiSignature();
		for (const s of host.querySelectorAll('symbol#i-ai, symbol#ws-trust-ai')) expect(geometrySignature(s)).toBe(want);
		expect(geometrySignature(host.querySelector('symbol#i-wallet')!)).not.toBe(want);
		expect(geometrySignature(host.querySelector('symbol#ws-ai-spark')!)).not.toBe(want);
	});

	it('DEFAULT: nothing is touched (the DOM is byte-identical, including stroke-width 1.8 vs 2 and every symbol attribute)', () => {
		rt.applyText(null);
		expect(host.innerHTML).toBe(snap);
	});

	it('custom: replaces ONLY the AI-mark symbols and the inline official copy; functional / look-alike symbols stay; scripts never reach the DOM', () => {
		expect(rt.applyText(CUSTOM, 'sha')).toBe(true);
		const nav = host.querySelector('symbol#i-ai')!;
		expect(nav.getAttribute('viewBox')).toBe('0 0 32 32');
		expect(nav.querySelector('rect')).not.toBeNull();
		expect(nav.querySelector('circle')).toBeNull();
		expect(host.querySelector('symbol#ws-trust-ai rect')).not.toBeNull();
		expect(host.querySelector('#inl rect')).not.toBeNull();
		expect(host.querySelector('symbol#i-wallet')!.outerHTML).toBe(new DOMParser().parseFromString(`<svg>${WALLET}</svg>`, 'text/html').querySelector('symbol')!.outerHTML);
		expect(host.querySelector('symbol#ws-ai-spark path')).not.toBeNull();
		expect(host.querySelector('script')).toBeNull();
		// the symbol keeps the caller-side paint (currentColor stroke) unless the custom root overrides it
		expect(nav.getAttribute('stroke')).toBe('currentColor');
	});

	it('ROLLBACK: restores the default byte-identical (all attributes and children)', () => {
		rt.applyText(CUSTOM, 'sha');
		expect(host.innerHTML).not.toBe(snap);
		rt.applyText(null);
		expect(host.innerHTML).toBe(snap);
	});

	it('an AI copy rendered AFTER the custom icon is active (route change) is replaced too, and rolled back too', async () => {
		rt.applyText(CUSTOM, 'sha');
		const html = INLINE.replace('id="inl"', 'id="late"');
		const ref = document.createElement('div'); ref.innerHTML = html; // same parser path = same serialisation
		const late = document.createElement('div'); late.innerHTML = html; host.appendChild(late);
		await new Promise(r => setTimeout(r, 0));
		expect(late.querySelector('rect')).not.toBeNull();
		rt.applyText(null);
		expect(late.innerHTML).toBe(ref.innerHTML);
	});

	it('a custom SVG that is not valid XML / not an svg is refused and nothing changes', () => {
		expect(rt.applyText('<html><body>no</body></html>')).toBe(false);
		expect(rt.applyText('<svg><circle></svg')).toBe(false);
		expect(host.innerHTML).toBe(snap);
	});

	it('parseCustomSvg strips handlers, external hrefs and style/use/image', () => {
		const p = parseCustomSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0" onclick="x()"/><use href="http://evil/x.svg#a"/><image href="data:text/html,hi"/><style>@import url(http://evil)</style><rect fill="url(http://evil/a)" width="1" height="1"/></svg>')!;
		const html = p.children.map(c => c.outerHTML).join('');
		expect(html).not.toMatch(/onclick|evil|<use|<image|<style/);
	});
});
