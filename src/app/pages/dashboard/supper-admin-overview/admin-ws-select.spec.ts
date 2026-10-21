/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SaSystemSettings } from './sa-system-settings/sa-system-settings';

describe('admin dropdowns use the site ws-select', () => {
	it('no admin template has a native <select> any more', () => {
		const offenders: string[] = [];
		const walk = (d: string) => readdirSync(d).forEach(f => { const q = join(d, f); statSync(q).isDirectory() ? walk(q) : (q.endsWith('.html') && readFileSync(q, 'utf8').includes('<select') && offenders.push(q)); });
		walk(__dirname);
		// «التحكم بالموقع» is a shadow-DOM panel imported as it is: its native selects take the PANEL's own token colours (the platform ws-select cannot reach into it)
		expect(offenders.filter(f => !f.includes('/site-control/'))).toEqual([]);
	});

	function mount<T>(cmp: new () => T) {
		TestBed.configureTestingModule({ imports: [cmp as never], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
		const f = TestBed.createComponent(cmp);
		f.detectChanges();
		return { f, c: f.componentInstance as any, el: f.nativeElement as HTMLElement };
	}
	const open = (f: any, el: HTMLElement, i: number) => { (el.querySelectorAll('ws-select button')[i] as HTMLButtonElement).click(); f.detectChanges(); };
	const pick = async (f: any, el: HTMLElement, n: number) => { (el.querySelectorAll('[data-testid=ws-select-option]')[n] as HTMLElement).click(); f.detectChanges(); await f.whenStable(); f.detectChanges(); };
	afterEach(() => TestBed.resetTestingModule());

	// sa-team no longer has filters (honest unavailable state, see shared/sa-unavailable); its ws-select test was removed with the mock.

	it('sa-system-settings: the section selects (security, finance, localization) are ws-select and are disabled with a visible reason (not stored settings)', async () => {
		const { f, c, el } = mount(SaSystemSettings);
		const go = async (k: string) => { c.activeSection.set(k); f.detectChanges(); await f.whenStable(); f.detectChanges(); };
		await go('security'); expect(el.querySelector('select')).toBeNull(); expect(el.querySelectorAll('ws-select').length).toBe(1);
		expect(el.querySelector('.ss-note')?.textContent).toContain('غير مفعّل');
		expect((el.querySelectorAll('ws-select button')[0] as HTMLButtonElement).disabled).toBe(true);
		await go('finance'); expect(el.querySelectorAll('ws-select').length).toBe(2);
		for (const b of Array.from(el.querySelectorAll('ws-select button'))) expect((b as HTMLButtonElement).disabled).toBe(true);
		await go('localization'); expect(el.querySelectorAll('ws-select').length).toBe(3);
		for (const b of Array.from(el.querySelectorAll('ws-select button'))) expect((b as HTMLButtonElement).disabled).toBe(true);
	});
});
