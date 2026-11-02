/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SaSystemSettings } from './sa-system-settings/sa-system-settings';
import { SystemSettingsStore } from '../../../core/services/system-settings.store';

describe('admin dropdowns use the site ws-select', () => {
	it('no admin template has a native <select> any more', () => {
		const offenders: string[] = [];
		const walk = (d: string) => readdirSync(d).forEach(f => { const q = join(d, f); statSync(q).isDirectory() ? walk(q) : (q.endsWith('.html') && readFileSync(q, 'utf8').includes('<select') && offenders.push(q)); });
		walk(__dirname);
		// ONE narrow, documented exception: the imported «التحكم بالموقع» panel is a set of shadow-DOM pages whose native <select>s take the PANEL's own token colours (the platform
		// ws-select directive cannot reach into a shadow root). Exactly these five templates (the icon library no longer has any: Round 6), nothing else: a new native select anywhere else - or a sixth one inside the panel - fails.
		const PANEL_NATIVE_SELECTS = ['color-tokens/color-tokens.html', 'live-preview/live-preview.html', 'style-guide/style-guide.html', 'templates/templates.html', 'typography/typography.html'].map(f => `/site-control/${f}`);
		const outside = offenders.filter(f => !f.includes('/site-control/'));
		const inPanel = offenders.filter(f => f.includes('/site-control/')).map(f => f.slice(f.indexOf('/site-control/'))).sort();
		expect(outside).toEqual([]);
		expect(inPanel).toEqual([...PANEL_NATIVE_SELECTS].sort());
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

	it('sa-system-settings: the one enum setting (base currency) is a ws-select, never a native select', async () => {
		const { f, c, el } = mount(SaSystemSettings);
		TestBed.inject(SystemSettingsStore).items.set([{ key: 'baseCurrency', tab: 'finance', label: 'العملة الأساسية', description: 'd', status: 'enforced', unit: null, allowed: ['USD', 'SAR'], pages: ['P-AD-020'], canWrite: true, effect: 'immediate', reason: null, value: 'USD', version: 0, source: 'default' }]);
		c.setTab('finance'); f.detectChanges(); await f.whenStable(); f.detectChanges();
		expect(el.querySelector('select')).toBeNull(); expect(el.querySelectorAll('ws-select').length).toBe(1);
	});
});
