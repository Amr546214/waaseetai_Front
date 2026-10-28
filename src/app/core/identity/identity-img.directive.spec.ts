import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { IdentityImgDirective } from './identity-img.directive';
import { parseManifest } from './site-identity.models';
import { IDENTITY_CACHE_KEY, SiteIdentityService } from './site-identity.service';

const SHA = 'c'.repeat(64);
@Component({
	standalone: true, imports: [IdentityImgDirective],
	template: `<img [wsIdentityImg]="'logo.mark'" src="/images/waseet-mark.png" alt="x" height="34" style="height:34px;width:auto;object-fit:contain" class="a b"><img src="/images/waseet-mark.png" alt="x" height="34" style="height:34px;width:auto;object-fit:contain" class="a b">`,
})
class Host {}

describe('wsIdentityImg', () => {
	beforeEach(() => { localStorage.removeItem(IDENTITY_CACHE_KEY); TestBed.resetTestingModule(); });

	const strip = (h: string) => h.replace(/\s(ng-reflect|_ngcontent|_nghost|ng-version)[^\s>]*/g, '');
	function mount() { const f = TestBed.createComponent(Host); f.detectChanges(); const imgs = f.nativeElement.querySelectorAll('img') as NodeListOf<HTMLImageElement>; return { f, a: imgs[0], b: imgs[1] }; }

	it('GOLDEN: in the default state the migrated <img> is attribute-for-attribute the same element as the untouched one', () => {
		const { a, b } = mount();
		expect(strip(a.outerHTML)).toBe(strip(b.outerHTML));
		expect(a.getAttribute('src')).toBe('/images/waseet-mark.png');
		expect([...a.attributes].map(x => x.name).filter(n => !/^(ng-|_ng)/.test(n))).toEqual([...b.attributes].map(x => x.name).filter(n => !/^(ng-|_ng)/.test(n)));
	});

	it('swaps src only while a custom version is published, keeps every other attribute, and restores the original on rollback', () => {
		const { f, a, b } = mount();
		const id = TestBed.inject(SiteIdentityService);
		id.apply(parseManifest({ version: 1, items: { 'logo.mark': { url: `/public/site-identity/assets/logo.mark/${SHA}`, sha256: SHA, mime: 'image/png', width: 1, height: 1, version: 1 } } })!, false);
		f.detectChanges(); TestBed.tick?.();
		expect(a.getAttribute('src')).toContain(SHA);
		expect(a.getAttribute('height')).toBe('34'); expect(a.getAttribute('class')).toBe('a b'); expect(a.getAttribute('style')).toContain('object-fit: contain');
		expect(b.getAttribute('src')).toBe('/images/waseet-mark.png'); // an unmigrated look-alike is never touched
		id.apply(parseManifest({ version: 2, items: {} })!, false);
		f.detectChanges(); TestBed.tick?.();
		expect(a.getAttribute('src')).toBe('/images/waseet-mark.png');
		expect(strip(a.outerHTML)).toBe(strip(b.outerHTML));
	});

	it('a custom image that fails to load (404) falls back to the default at once: no broken image', () => {
		const { f, a } = mount();
		const id = TestBed.inject(SiteIdentityService);
		id.apply(parseManifest({ version: 1, items: { 'logo.mark': { url: `/public/site-identity/assets/logo.mark/${SHA}`, sha256: SHA, mime: 'image/png', width: null, height: null, version: 1 } } })!, false);
		f.detectChanges(); TestBed.tick?.();
		expect(a.getAttribute('src')).toContain(SHA);
		a.dispatchEvent(new Event('error'));
		f.detectChanges(); TestBed.tick?.();
		expect(a.getAttribute('src')).toBe('/images/waseet-mark.png');
	});
});
