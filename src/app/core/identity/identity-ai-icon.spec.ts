/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiIconRuntime, geometrySignature, officialAiSignature, paintGroupAttrs, parseCustomSvg } from './identity-ai-icon';
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
		// the drawing sits in a <g> that resets the host's inherited paint to the SVG initial values (a file without declarations is NOT drawn with the host's outline)
		expect(nav.querySelector(':scope > g')!.getAttribute('stroke')).toBe('none');
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

	// Round 5: the file's own fill / stroke semantics are kept exactly; the host's outline paint never leaks in
	const star = (rootAttrs: string, shape = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${rootAttrs}><path ${shape} d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z"/></svg>`;
	const gOf = (id = 'i-ai') => host.querySelector(`symbol#${id} > g`)!;
	const INIT = { fill: '#000', stroke: 'none', 'stroke-width': '1', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter' };
	it('PAINT variant none: no declarations -> SVG initial paint (black fill, no stroke), NOT the host outline (fill none / stroke currentColor / 1.8)', () => {
		expect(rt.applyText(star(''), 'v0')).toBe(true);
		for (const [k, v] of Object.entries(INIT)) expect(gOf().getAttribute(k)).toBe(v);
		expect(gOf('ws-trust-ai').getAttribute('stroke')).toBe('none');
		expect(host.querySelector('#inl > g')!.getAttribute('fill')).toBe('#000');
	});
	it('PAINT variant fill only: the fill is kept and NO stroke is invented (stroke / stroke-width / linecap come from the SVG initial values, not from the host)', () => {
		rt.applyText(star('fill="#ff0080"'), 'v1');
		expect(gOf().getAttribute('fill')).toBe('#ff0080'); expect(gOf().getAttribute('stroke')).toBe('none'); expect(gOf().getAttribute('stroke-linecap')).toBe('butt');
	});
	it('PAINT variant stroke only (outline icon): fill none + stroke + width kept; an outline file stays an outline', () => {
		rt.applyText(star('fill="none" stroke="#7a00ff" stroke-width="1.5" stroke-linecap="round"'), 'v2');
		expect(gOf().getAttribute('fill')).toBe('none'); expect(gOf().getAttribute('stroke')).toBe('#7a00ff'); expect(gOf().getAttribute('stroke-width')).toBe('1.5'); expect(gOf().getAttribute('stroke-linecap')).toBe('round');
	});
	it('PAINT variant fill + stroke: both kept exactly', () => {
		rt.applyText(star('fill="#ff0080" stroke="#7a00ff" stroke-width="3"'), 'v3');
		expect(gOf().getAttribute('fill')).toBe('#ff0080'); expect(gOf().getAttribute('stroke')).toBe('#7a00ff'); expect(gOf().getAttribute('stroke-width')).toBe('3');
		expect(host.querySelector('#inl > g')!.getAttribute('stroke-width')).toBe('3');
	});
	it('PAINT variant currentColor: kept as the keyword (it resolves to the colour the site gives the icon); `color` itself is never reset', () => {
		rt.applyText(star('fill="none" stroke="currentColor" stroke-width="2"'), 'v4');
		expect(gOf().getAttribute('stroke')).toBe('currentColor'); expect(gOf().hasAttribute('color')).toBe(false);
		rt.applyText(star('fill="currentColor"'), 'v5');
		expect(gOf().getAttribute('fill')).toBe('currentColor'); expect(gOf().getAttribute('stroke')).toBe('none');
	});
	it('PAINT: root style="..." is honoured over the attribute, the file\'s own <style> rules are inlined onto the shapes (and never left as a document-wide <style>)', () => {
		rt.applyText('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red" style="fill:#0a0;stroke:#00f"><style>.a{fill:#f0f;stroke-width:4} #b{opacity:0.5}</style><path class="a" d="M0 0h5v5z"/><path id="b" d="M6 6h5v5z"/></svg>', 'v6');
		expect(gOf().getAttribute('fill')).toBe('#0a0'); expect(gOf().getAttribute('stroke')).toBe('#00f');
		const [a, b] = Array.from(host.querySelectorAll('symbol#i-ai path'));
		expect(a.getAttribute('style')).toContain('fill:#f0f'); expect(a.getAttribute('style')).toContain('stroke-width:4'); expect(b.getAttribute('style')).toContain('opacity:0.5');
		expect(host.querySelector('symbol#i-ai style')).toBeNull(); expect(document.querySelector('svg style')).toBeNull();
	});
	it('PAINT: ids (gradients/clip paths) are namespaced per file and their url(#...) references follow; foreign ids/urls untouched; external url() dropped', () => {
		const p = parseCustomSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><rect width="5" height="5" fill="url(#g)"/><rect width="5" height="5" fill="url(#other)"/><rect width="5" height="5" fill="url(http://x.test/a)"/></svg>', 'abcdef0123456789')!;
		const html = p.children.map(c => c.outerHTML).join('');
		expect(html).toContain('id="wsaiabcdef01-g"'); expect(html).toContain('url(#wsaiabcdef01-g)'); expect(html).toContain('url(#other)'); expect(html).not.toContain('x.test');
	});
	it('PAINT: paintGroupAttrs = SVG initial values + the root declarations (a declaration wins, an undeclared inherited property is reset)', () => {
		const p = parseCustomSvg(star('stroke="#123"'))!;
		const a = paintGroupAttrs(p);
		expect(a['stroke']).toBe('#123'); expect(a['fill']).toBe('#000'); expect(a['stroke-width']).toBe('1'); expect(a['stroke-linejoin']).toBe('miter');
	});
	it('PAINT: shape-level paint is kept as uploaded and rollback restores byte-identical', () => {
		rt.applyText(star('', 'fill="#00aa55" stroke="none"'), 'p3');
		const path = host.querySelector('symbol#i-ai path')!;
		expect(path.getAttribute('fill')).toBe('#00aa55'); expect(path.getAttribute('stroke')).toBe('none');
		rt.applyText(null); expect(host.innerHTML).toBe(snap);
	});
	it('ws-trust-ai (website) is driven by the same icon.ai and its trust texts / structure around it are untouched', () => {
		const trustUse = document.createElement('div'); trustUse.innerHTML = '<p class="t">مدفوعات بالضمان</p><svg class="ws-ic"><use href="#ws-trust-ai"></use></svg>'; host.appendChild(trustUse);
		const before = trustUse.innerHTML;
		rt.applyText(star('fill="#ff0080"'), 'v7');
		expect(host.querySelector('symbol#ws-trust-ai > g')!.getAttribute('fill')).toBe('#ff0080');
		expect(trustUse.innerHTML).toBe(before);
	});
});
