/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IconSymbolsRuntime, ICON_FN_PREFIX, iconFnKey, symbolIdOf } from './identity-icon-symbols';

const APP = join(__dirname, '../..');
const sym = (rel: string, id: string) => new RegExp(`<symbol\\s+id="${id}"[\\s\\S]*?</symbol>`).exec(readFileSync(join(APP, rel), 'utf8'))![0];
// the REAL shipped definitions of the notifications icon (two geometry variants live in different templates today)
const NAV_BELL = sym('sheards/navbar/navbar.html', 'i-bell');
const LAYOUT_BELL = sym('layouts/dashboard-layout/dashboard-layout.html', 'i-bell');
const WALLET = sym('pages/dashboard/provider-overview/finance/wallet/wallet.html', 'i-wallet');
const USE = '<svg class="t" aria-hidden="true"><use href="#i-bell"></use></svg>';
const CUSTOM = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="6"/><script>alert(1)</script></svg>';
const FILL_ONLY = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ff0000"><circle cx="12" cy="12" r="8"/></svg>';

describe('IconSymbolsRuntime (function icons icon.fn.<symbolId>)', () => {
	let rt: IconSymbolsRuntime; let host: HTMLElement; let snap: string;
	beforeEach(() => {
		TestBed.resetTestingModule(); rt = TestBed.inject(IconSymbolsRuntime);
		host = document.createElement('div');
		host.innerHTML = `<svg style="display:none"><defs>${NAV_BELL}${LAYOUT_BELL}${WALLET}</defs></svg>${USE}`;
		document.body.appendChild(host); snap = host.innerHTML;
	});
	afterEach(() => { rt.clear('i-bell'); host.remove(); });

	it('key helpers: the family prefix, valid ids only', () => {
		expect(ICON_FN_PREFIX).toBe('icon.fn.'); expect(iconFnKey('i-bell')).toBe('icon.fn.i-bell');
		expect(symbolIdOf('icon.fn.i-bell')).toBe('i-bell'); expect(symbolIdOf('icon.ai')).toBeNull(); expect(symbolIdOf('icon.fn.Bad_Id')).toBeNull(); expect(symbolIdOf('logo.mark')).toBeNull();
	});

	it('the notifications icon is a <symbol id="i-bell"> drawn through <use href="#i-bell"> (the real shipped templates)', () => {
		expect(host.querySelectorAll('symbol#i-bell').length).toBe(2);
		expect(host.querySelector('svg.t use')!.getAttribute('href')).toBe('#i-bell');
		const bell = readFileSync(join(APP, 'sheards/notification-bell/notification-bell.html'), 'utf8');
		expect(bell).toContain('<use href="#i-bell">');
	});

	it('DEFAULT: nothing is touched (the DOM is byte-identical, both geometry variants and every symbol attribute)', () => {
		expect(rt.activeIds()).toEqual([]);
		expect(host.innerHTML).toBe(snap);
	});

	it('custom: replaces EVERY <symbol id="i-bell"> (all variants), leaves other ids alone, scripts never reach the DOM', () => {
		expect(rt.applyText('i-bell', CUSTOM, 'sha1')).toBe(true);
		for (const s of host.querySelectorAll('symbol#i-bell')) { expect(s.getAttribute('viewBox')).toBe('0 0 32 32'); expect(s.querySelector('rect')).not.toBeNull(); expect(s.querySelector('path')).toBeNull(); }
		expect(host.querySelector('symbol#i-wallet path')).not.toBeNull();
		expect(host.querySelector('script')).toBeNull();
		// paint fidelity (same rule as the AI icon): the drawing sits in a <g> that resets the host's inherited outline paint
		expect(host.querySelector('symbol#i-bell > g')!.getAttribute('stroke')).toBe('none');
	});

	it('a fill-only file keeps its own fill and gets NO invented stroke', () => {
		rt.applyText('i-bell', FILL_ONLY, 'sha2');
		const g = host.querySelector('symbol#i-bell > g')!;
		expect(g.getAttribute('fill')).toBe('#ff0000'); expect(g.getAttribute('stroke')).toBe('none');
	});

	it('RESTORE: clear() puts the default back byte-identical', () => {
		rt.applyText('i-bell', CUSTOM, 'sha1');
		expect(host.innerHTML).not.toBe(snap);
		rt.clear('i-bell');
		expect(host.innerHTML).toBe(snap);
	});

	it('a copy rendered AFTER the custom icon is active (route change) is replaced too, and restored too', async () => {
		rt.applyText('i-bell', CUSTOM, 'sha1');
		const late = document.createElement('div'); late.innerHTML = `<svg style="display:none"><defs>${NAV_BELL}</defs></svg>`; host.appendChild(late);
		const ref = document.createElement('div'); ref.innerHTML = `<svg style="display:none"><defs>${NAV_BELL}</defs></svg>`;
		await new Promise(r => setTimeout(r, 0));
		expect(late.querySelector('rect')).not.toBeNull();
		rt.clear('i-bell');
		expect(late.innerHTML).toBe(ref.innerHTML);
	});

	it('a newer version over an older one (no restore in between) redraws what is already replaced', () => {
		rt.applyText('i-bell', CUSTOM, 'v1'); rt.applyText('i-bell', FILL_ONLY, 'v2');
		for (const s of host.querySelectorAll('symbol#i-bell')) { expect(s.querySelector('circle')).not.toBeNull(); expect(s.querySelector('rect')).toBeNull(); }
		rt.clear('i-bell'); expect(host.innerHTML).toBe(snap);
	});

	it('a file that is not a usable svg is refused and nothing changes', () => {
		expect(rt.applyText('i-bell', '<html><body>no</body></html>', 'x')).toBe(false);
		expect(rt.applyText('i-bell', '<svg><circle></svg', 'x')).toBe(false);
		expect(host.innerHTML).toBe(snap);
	});

	it('it is wired at app start with the other identity runtimes and waits for hydration before rewriting', () => {
		const prov = readFileSync(join(__dirname, 'identity.providers.ts'), 'utf8');
		expect(prov).toContain('IconSymbolsRuntime');
		const src = readFileSync(join(__dirname, 'identity-icon-symbols.ts'), 'utf8');
		expect(src.indexOf('whenStable')).toBeGreaterThan(-1);
		expect(src.indexOf('whenStable')).toBeLessThan(src.indexOf('if (this.hydrated) for (const el'));
		expect(src).toContain('this.hydrated = true; this.renderAll()');
	});
});
