import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from './select.component';

@Component({
	standalone: true,
	imports: [FormsModule, WsSelectComponent],
	template: `<form><ws-select [options]="opts" placeholder="اختر التصنيف" [(ngModel)]="val" name="c" required /></form><button id="outside">x</button>`,
})
class Host { opts = ['أ', { value: 'b', label: 'ب' }, { value: 'c', label: 'ج', disabled: true }, 'د']; val = signal(''); }

describe('ws-select (site-styled replacement for the native select)', () => {
	async function mount() {
		const f = TestBed.configureTestingModule({ imports: [Host] }).createComponent(Host);
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const trigger = () => el.querySelector('[data-testid=ws-select-trigger]') as HTMLButtonElement;
		const panel = () => el.querySelector('[data-testid=ws-select-panel]');
		const opts = () => Array.from(el.querySelectorAll('[data-testid=ws-select-option]')) as HTMLElement[];
		const key = (k: string) => { trigger().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); f.detectChanges(); };
		return { f, el, trigger, panel, opts, key, host: f.componentInstance };
	}

	it('renders no native select, shows the placeholder, and opens a themed listbox inside the component on click', async () => {
		const { f, el, trigger, panel, opts } = await mount();
		expect(el.querySelector('select')).toBeNull();
		expect(trigger().textContent).toContain('اختر التصنيف');
		expect(panel()).toBeNull();
		trigger().click(); f.detectChanges();
		expect(panel()?.getAttribute('role')).toBe('listbox');
		expect(opts().map(o => o.textContent?.trim())).toEqual(['أ', 'ب', 'ج', 'د']);
		expect(trigger().getAttribute('aria-expanded')).toBe('true');
	});

	it('choosing an option sets the model value (the option value, not the label), shows the label and closes', async () => {
		const { f, trigger, panel, opts, host } = await mount();
		trigger().click(); f.detectChanges();
		opts()[1].click(); f.detectChanges(); await f.whenStable(); f.detectChanges();
		expect(host.val()).toBe('b');
		expect(trigger().textContent).toContain('ب');
		expect(panel()).toBeNull();
		trigger().click(); f.detectChanges();
		expect(opts()[1].getAttribute('aria-selected')).toBe('true');
		expect(opts()[1].className).toContain('is-selected');
	});

	it('a disabled option cannot be chosen', async () => {
		const { f, trigger, opts, host } = await mount();
		trigger().click(); f.detectChanges();
		opts()[2].click(); f.detectChanges();
		expect(host.val()).toBe('');
	});

	it('Escape and a click outside close the list', async () => {
		const { f, el, trigger, panel, key } = await mount();
		trigger().click(); f.detectChanges(); key('Escape');
		expect(panel()).toBeNull();
		trigger().click(); f.detectChanges();
		(el.querySelector('#outside') as HTMLElement).click(); f.detectChanges();
		expect(panel()).toBeNull();
	});

	it('keyboard: Enter/ArrowDown opens, arrows skip disabled options, Enter picks', async () => {
		const { f, trigger, panel, key, host } = await mount();
		key('Enter'); expect(panel()).not.toBeNull();
		key('ArrowDown'); key('ArrowDown'); // أ -> ب -> (ج disabled) -> د
		key('Enter'); await f.whenStable(); f.detectChanges();
		expect(host.val()).toBe('د');
		expect(panel()).toBeNull();
		key('ArrowDown'); expect(panel()).not.toBeNull();
		key('Home'); key(' '); await f.whenStable(); f.detectChanges();
		expect(host.val()).toBe('أ');
		expect(trigger().textContent).toContain('أ');
	});

	it('required validation still works through ngModel (empty = invalid, picked = valid)', async () => {
		const { f, el, trigger, opts } = await mount();
		const form = () => el.querySelector('form')!.className;
		expect(form()).toContain('ng-invalid');
		trigger().click(); f.detectChanges(); opts()[0].click(); f.detectChanges(); await f.whenStable(); f.detectChanges();
		expect(form()).toContain('ng-valid');
	});
});
