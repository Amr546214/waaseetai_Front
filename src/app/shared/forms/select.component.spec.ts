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

	it('the list is a top-layer popover positioned from the trigger (so a following card can never cover or clip it)', async () => {
		const { f, trigger, panel } = await mount();
		trigger().click(); f.detectChanges();
		const ul = panel() as HTMLElement;
		expect(ul.getAttribute('popover')).toBe('manual');
		expect(ul.style.left).not.toBe('');
		expect(ul.style.width).not.toBe('');
		expect(ul.style.top !== '' || ul.style.bottom !== '').toBe(true);
	});
});

describe('ws-select forwards its form state to the real combobox button', () => {
	@Component({
		standalone: true,
		imports: [FormsModule, WsSelectComponent],
		template: `<form><ws-select id="s" [options]="['a','b']" [(ngModel)]="val" name="c" aria-required="true"
			[attr.aria-invalid]="bad() ? 'true' : null" [attr.aria-describedby]="bad() ? 'e1' : null" [attr.aria-errormessage]="bad() ? 'e1' : null" /><div id="e1">خطأ</div></form>`,
	})
	class H { val = ''; bad = signal(false); }

	it('aria-required / aria-invalid / aria-describedby / aria-errormessage reach the button, not just the host', async () => {
		const f = TestBed.configureTestingModule({ imports: [H] }).createComponent(H);
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		const btn = (f.nativeElement as HTMLElement).querySelector('button.ws-sel-trigger') as HTMLButtonElement;
		expect(btn.getAttribute('aria-required')).toBe('true');
		expect(btn.hasAttribute('aria-invalid')).toBe(false);
		f.componentInstance.bad.set(true); f.detectChanges();
		expect(btn.getAttribute('aria-invalid')).toBe('true');
		expect(btn.getAttribute('aria-describedby')).toBe('e1');
		expect(btn.getAttribute('aria-errormessage')).toBe('e1');
		f.componentInstance.bad.set(false); f.detectChanges();
		expect(btn.hasAttribute('aria-invalid')).toBe(false);
		expect(btn.hasAttribute('aria-describedby')).toBe(false);
		// keyboard behaviour is unchanged
		btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); f.detectChanges();
		expect(btn.getAttribute('aria-expanded')).toBe('true');
	});

	it('an ng-invalid + touched ws-select with no explicit attribute is still announced invalid on the button', async () => {
		@Component({ standalone: true, imports: [FormsModule, WsSelectComponent], template: `<span>{{ tick() }}</span><form><ws-select [options]="['a']" [(ngModel)]="v" name="c" required /></form>` })
		class R { v = ''; tick = signal(0); }
		const f = TestBed.configureTestingModule({ imports: [R] }).createComponent(R);
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const btn = el.querySelector('button.ws-sel-trigger') as HTMLButtonElement;
		expect(btn.getAttribute('aria-required')).toBe('true');
		expect(btn.hasAttribute('aria-invalid')).toBe(false);
		btn.dispatchEvent(new Event('blur')); f.componentInstance.tick.set(1); f.detectChanges(); await f.whenStable(); f.detectChanges(); f.detectChanges();
		expect(btn.getAttribute('aria-invalid')).toBe('true');
	});
});
