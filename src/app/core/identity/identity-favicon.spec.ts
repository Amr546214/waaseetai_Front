import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FaviconRuntime } from './identity-favicon';

describe('FaviconRuntime', () => {
	let link: HTMLLinkElement; let rt: FaviconRuntime; let snap: string;
	beforeEach(() => {
		TestBed.resetTestingModule(); rt = TestBed.inject(FaviconRuntime);
		link = document.createElement('link'); link.setAttribute('rel', 'icon'); link.setAttribute('type', 'image/png'); link.setAttribute('href', 'assets/brand/waseet-mark.png');
		document.head.appendChild(link); snap = link.outerHTML;
	});
	afterEach(() => link.remove());

	it('default: the index.html link is untouched', () => { rt.apply(null, ''); expect(link.outerHTML).toBe(snap); });
	it('custom: same <link>, new href and the real mime; rollback restores href and type exactly', () => {
		rt.apply('https://x/api/public/site-identity/assets/favicon.tab/abc', 'image/svg+xml');
		expect(link.getAttribute('href')).toContain('favicon.tab/abc'); expect(link.getAttribute('type')).toBe('image/svg+xml');
		expect(document.querySelectorAll('link[rel~="icon"]').length).toBe(1);
		rt.apply(null, '');
		expect(link.outerHTML).toBe(snap);
	});
});
