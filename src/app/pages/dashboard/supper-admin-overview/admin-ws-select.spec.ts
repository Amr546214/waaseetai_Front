/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SaTeam } from './sa-team/sa-team';
import { SaSystemSettings } from './sa-system-settings/sa-system-settings';

describe('admin dropdowns use the site ws-select', () => {
	it('no admin template has a native <select> any more', () => {
		const offenders: string[] = [];
		const walk = (d: string) => readdirSync(d).forEach(f => { const q = join(d, f); statSync(q).isDirectory() ? walk(q) : (q.endsWith('.html') && readFileSync(q, 'utf8').includes('<select') && offenders.push(q)); });
		walk(__dirname);
		expect(offenders).toEqual([]);
	});

	function mount<T>(cmp: new () => T) {
		TestBed.configureTestingModule({ imports: [cmp as never], providers: [provideRouter([])] });
		const f = TestBed.createComponent(cmp);
		f.detectChanges();
		return { f, c: f.componentInstance as any, el: f.nativeElement as HTMLElement };
	}
	const open = (f: any, el: HTMLElement, i: number) => { (el.querySelectorAll('ws-select button')[i] as HTMLButtonElement).click(); f.detectChanges(); };
	const pick = async (f: any, el: HTMLElement, n: number) => { (el.querySelectorAll('[data-testid=ws-select-option]')[n] as HTMLElement).click(); f.detectChanges(); await f.whenStable(); f.detectChanges(); };
	afterEach(() => TestBed.resetTestingModule());

	it('sa-team: the role/status filters keep their values ("all" = empty) and the invite role', async () => {
		const { f, c, el } = mount(SaTeam);
		expect(el.querySelector('select')).toBeNull();
		expect(c.roleFilter()).toBe('');
		open(f, el, 0);
		const labels = Array.from(el.querySelectorAll('[data-testid=ws-select-option]')).map(o => o.textContent?.trim());
		expect(labels).toEqual(['كل الأدوار', ...c.roles]);
		await pick(f, el, 2);
		expect(c.roleFilter()).toBe(c.roles[1]);
		open(f, el, 1); await pick(f, el, 1);
		expect(c.statusFilter()).toBe('نشط');
		open(f, el, 1); await pick(f, el, 0);
		expect(c.statusFilter()).toBe('');
	});

	it('sa-system-settings: the section selects (security, finance, localization) are ws-select and picking changes the signals', async () => {
		const { f, c, el } = mount(SaSystemSettings);
		const go = (k: string) => { c.activeSection.set(k); f.detectChanges(); };
		go('security'); expect(el.querySelector('select')).toBeNull(); expect(el.querySelectorAll('ws-select').length).toBe(1);
		open(f, el, 0); await pick(f, el, 2);
		expect(c.sessionDuration()).toBe('48');
		go('finance'); expect(el.querySelectorAll('ws-select').length).toBe(2);
		open(f, el, 1); await pick(f, el, 2);
		expect(c.paymentGateway()).toBe('Tamara');
		go('localization'); expect(el.querySelectorAll('ws-select').length).toBe(3);
		open(f, el, 1); await pick(f, el, 1);
		expect(c.dateFormat()).toBe('YYYY-MM-DD');
	});
});
