import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PhoneInputComponent, type PhoneValue } from './phone-input.component';

@Component({ standalone: true, imports: [PhoneInputComponent, ReactiveFormsModule], template: `<app-phone-input [formControl]="ctrl" />` })
class Host { ctrl = new FormControl<PhoneValue | null>(null); }

describe('PhoneInputComponent: the country and the local number always belong together', () => {
  const make = (initial?: PhoneValue) => {
    const f = TestBed.createComponent(Host);
    if (initial) f.componentInstance.ctrl.setValue(initial);
    f.detectChanges();
    return f;
  };
  const type = (f: any, text: string) => {
    const input = f.nativeElement.querySelector('input.phone-number-input') as HTMLInputElement;
    input.value = text; input.dispatchEvent(new Event('input')); f.detectChanges();
  };
  const digits = (v: string | undefined) => String(v ?? '').replace(/\D/g, '');
  const flag = (f: any) => (f.nativeElement.querySelector('.country-selector-btn img.flag-img') as HTMLImageElement).getAttribute('src');
  const dial = (f: any) => f.nativeElement.querySelector('.dial-code').textContent.trim();

  it('pasting "+201025073026" while Saudi Arabia is selected switches to Egypt (EG flag +20) and keeps the local number 1025073026', () => {
    const f = make();
    expect([flag(f), dial(f)]).toEqual(['assets/flags/SA.svg', '+966']);
    type(f, '+201025073026');
    expect([flag(f), dial(f)]).toEqual(['assets/flags/EG.svg', '+20']);
    const v = f.componentInstance.ctrl.value!;
    expect([v.countryCode, v.dialCode, digits(v.number)]).toEqual(['EG', '+20', '1025073026']);
    expect(f.componentInstance.ctrl.valid).toBe(true);
  });

  it('pasting "201025073026" (no +) does the same', () => {
    const f = make();
    type(f, '201025073026');
    expect(dial(f)).toBe('+20');
    expect(digits(f.componentInstance.ctrl.value!.number)).toBe('1025073026');
  });

  it('pasting "966501234567" with Egypt selected switches to Saudi Arabia and keeps 501234567', () => {
    const f = make({ countryCode: 'EG', dialCode: '+20', number: '', e164Number: '' });
    type(f, '+966501234567');
    expect(dial(f)).toBe('+966');
    expect(digits(f.componentInstance.ctrl.value!.number)).toBe('501234567');
  });

  it('typing a normal local Saudi number (leading zero or not) never changes the country', () => {
    const f = make();
    type(f, '0501234567');
    expect(dial(f)).toBe('+966');
    expect(digits(f.componentInstance.ctrl.value!.number)).toBe('501234567');
  });

  it('an Egyptian local number typed with Saudi Arabia selected is INVALID (the country is not switched silently)', () => {
    const f = make();
    type(f, '1025073026');
    expect(dial(f)).toBe('+966');
    expect(f.componentInstance.ctrl.errors).toEqual({ invalidPhone: true });
  });

  it('a saved pair (Egypt, 1025073026) is shown with its flag and the local number only', () => {
    const f = make({ countryCode: 'EG', dialCode: '+20', number: '1025073026', e164Number: '' });
    expect([flag(f), dial(f)]).toEqual(['assets/flags/EG.svg', '+20']);
    expect((f.nativeElement.querySelector('input.phone-number-input') as HTMLInputElement).value).toBe('1025073026');
  });
});

describe('PhoneInputComponent forwards its form state to the real number box', () => {
  @Component({
    standalone: true, imports: [PhoneInputComponent, ReactiveFormsModule],
    template: `<app-phone-input [formControl]="ctrl" aria-required="true" [attr.aria-invalid]="bad ? 'true' : null"
      [attr.aria-describedby]="bad ? 'ph-err' : null" [attr.aria-errormessage]="bad ? 'ph-err' : null" /><div id="ph-err">خطأ</div>`,
  })
  class H { ctrl = new FormControl<PhoneValue | null>(null); badS = signal(false); get bad() { return this.badS(); } }

  it('aria-required, aria-invalid, aria-describedby and aria-errormessage land on the <input type=tel>', () => {
    const f = TestBed.createComponent(H);
    f.detectChanges();
    const inner = f.nativeElement.querySelector('input.phone-number-input') as HTMLInputElement;
    expect(inner.getAttribute('aria-required')).toBe('true');
    expect(inner.hasAttribute('aria-invalid')).toBe(false);
    f.componentInstance.badS.set(true); f.detectChanges();
    expect(inner.getAttribute('aria-invalid')).toBe('true');
    expect(inner.getAttribute('aria-describedby')).toBe('ph-err');
    expect(inner.getAttribute('aria-errormessage')).toBe('ph-err');
    f.componentInstance.badS.set(false); f.detectChanges();
    expect(inner.hasAttribute('aria-invalid')).toBe(false);
    expect(inner.hasAttribute('aria-errormessage')).toBe(false);
  });
});

describe('PhoneInputComponent: the label reaches the real number box', () => {
  @Component({
    standalone: true, imports: [PhoneInputComponent, ReactiveFormsModule],
    template: `<label for="mobile" id="l1">رقم</label><app-phone-input id="host1" inputId="mobile" [formControl]="a" />
      <label for="other" id="l2">آخر</label><app-phone-input inputId="other" [formControl]="b" />
      <app-phone-input [formControl]="c" /><app-phone-input [formControl]="d" />`,
  })
  class H { a = new FormControl<PhoneValue | null>(null); b = new FormControl<PhoneValue | null>(null); c = new FormControl<PhoneValue | null>(null); d = new FormControl<PhoneValue | null>(null); }

  it('inputId lands on the inner <input type=tel>; clicking the label activates it; every id is unique (auto ids when none is given)', () => {
    const f = TestBed.createComponent(H);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const inputs = Array.from(f.nativeElement.querySelectorAll('input.phone-number-input')) as HTMLInputElement[];
    expect(inputs.map(i => i.id).slice(0, 2)).toEqual(['mobile', 'other']);
    const ids = inputs.map(i => i.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(f.nativeElement.querySelector('#host1')).not.toBe(inputs[0]);
    // the label is associated with the real number box (a click on it activates that box; focus-on-click is checked in the browser, see the Playwright check)
    expect((f.nativeElement.querySelector('#l1') as HTMLLabelElement).control).toBe(inputs[0]);
    expect((f.nativeElement.querySelector('#l2') as HTMLLabelElement).control).toBe(inputs[1]);
    let clicked = 0; inputs[0].addEventListener('click', () => clicked++);
    (f.nativeElement.querySelector('#l1') as HTMLLabelElement).click();
    expect(clicked).toBe(1);
    f.nativeElement.remove();
  });
});

describe('PhoneInputComponent: the numeric dial code is always visible text, independent of the flag', () => {
  const make = (initial?: PhoneValue) => {
    const f = TestBed.createComponent(Host);
    if (initial) f.componentInstance.ctrl.setValue(initial);
    f.detectChanges();
    return f;
  };
  const open = (f: any) => { (f.nativeElement.querySelector('.country-selector-btn') as HTMLElement).click(); f.detectChanges(); };

  it('closed state: the dial code is its own LTR text node outside the flag, and the trigger label names the country and the code', () => {
    const f = make({ countryCode: 'EG', dialCode: '+20', number: '', e164Number: '' });
    const dial = f.nativeElement.querySelector('.country-selector-btn .dial-code') as HTMLElement;
    expect(dial.textContent!.trim()).toBe('+20');
    expect(dial.getAttribute('dir')).toBe('ltr');
    expect(dial.closest('.flag')).toBeNull();
    expect(dial.parentElement!.querySelector('.flag')!.textContent!.trim()).toBe('');
    const btn = f.nativeElement.querySelector('.country-selector-btn') as HTMLElement;
    expect(btn.getAttribute('aria-label')).toContain('+20');
    expect(btn.getAttribute('aria-haspopup')).toBe('listbox');
  });

  it('flag is a bundled SVG <img> with fixed size (no emoji, no letters): trigger and every list row; a missing file shows a globe, never letters', () => {
    const f = make({ countryCode: 'EG', dialCode: '+20', number: '', e164Number: '' });
    const img = f.nativeElement.querySelector('.country-selector-btn img.flag-img') as HTMLImageElement;
    expect([img.getAttribute('src'), img.getAttribute('width'), img.getAttribute('height'), img.getAttribute('alt'), img.getAttribute('loading')]).toEqual(['assets/flags/EG.svg', '24', '16', '', 'lazy']);
    expect(f.nativeElement.querySelector('.country-selector-btn .flag').textContent.trim()).toBe('');
    open(f);
    const imgs = Array.from(f.nativeElement.querySelectorAll('.dropdown-item img.flag-img')) as HTMLImageElement[];
    expect(imgs.length).toBe(f.nativeElement.querySelectorAll('.dropdown-item').length);
    expect(imgs.some(i => i.getAttribute('src') === 'assets/flags/SA.svg')).toBe(true);
    img.dispatchEvent(new Event('error')); f.detectChanges();
    expect(f.nativeElement.querySelector('.country-selector-btn svg.flag-globe')).not.toBeNull();
    expect(f.nativeElement.querySelector('.country-selector-btn .flag').textContent.trim()).toBe('');
  });

  it('every list row shows the dial code as LTR text and an aria-label with the code; search by code and by name still work', () => {
    const f = make();
    open(f);
    const rows = Array.from(f.nativeElement.querySelectorAll('.dropdown-item')) as HTMLElement[];
    expect(rows.length).toBeGreaterThan(100);
    expect(rows.every(r => /^\+\d+$/.test(r.querySelector('.dial-badge')!.textContent!.trim()) && r.querySelector('.dial-badge')!.getAttribute('dir') === 'ltr')).toBe(true);
    expect(rows.every(r => /\+\d+$/.test(r.getAttribute('aria-label')!))).toBe(true);
    const cmp = f.debugElement.query(By.directive(PhoneInputComponent)).componentInstance;
    cmp.searchTerm = '+20';
    expect(cmp.filteredCountries.some((c: any) => c.code === 'EG')).toBe(true);
    cmp.searchTerm = 'EG'; expect(cmp.filteredCountries.some((c: any) => c.code === 'EG')).toBe(true);
  });

  it('composition is unchanged: picking Egypt from the list and typing 1025073026 gives +201025073026, with the dial code shown', () => {
    const f = make();
    open(f);
    const eg = (Array.from(f.nativeElement.querySelectorAll('.dropdown-item')) as HTMLElement[]).find(r => r.getAttribute('aria-label')!.endsWith('+20'))!;
    eg.click(); f.detectChanges();
    const input = f.nativeElement.querySelector('input.phone-number-input') as HTMLInputElement;
    input.value = '1025073026'; input.dispatchEvent(new Event('input')); f.detectChanges();
    const v = f.componentInstance.ctrl.value!;
    expect([v.countryCode, v.dialCode, v.e164Number]).toEqual(['EG', '+20', '+201025073026']);
    expect(f.nativeElement.querySelector('.country-selector-btn .dial-code').textContent.trim()).toBe('+20');
  });

  it('keyboard: Enter on the trigger opens the list, Enter on a row selects it', () => {
    const f = make();
    const btn = f.nativeElement.querySelector('.country-selector-btn') as HTMLElement;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); f.detectChanges();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const row = (Array.from(f.nativeElement.querySelectorAll('.dropdown-item')) as HTMLElement[]).find(r => r.getAttribute('aria-label')!.endsWith('+971'))!;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); f.detectChanges();
    expect(f.nativeElement.querySelector('.country-selector-btn .dial-code').textContent.trim()).toBe('+971');
  });
});

// D3: a STORED number (string) opens with its own country; a number whose country is unclear keeps its dial code and digits; never a silent Saudi default.
@Component({ standalone: true, imports: [PhoneInputComponent, ReactiveFormsModule], template: `<app-phone-input [formControl]="ctrl" [defaultCountry]="def" />` })
class StoredHost { ctrl = new FormControl<PhoneValue | string | null>(null); def: any = 'SA'; }

describe('PhoneInputComponent: showing a stored number', () => {
  const open = (stored: string | null, def: any = 'SA') => {
    const f = TestBed.createComponent(StoredHost);
    f.componentInstance.def = def;
    f.componentInstance.ctrl.setValue(stored);
    f.detectChanges();
    return f;
  };
  const q = (f: any, sel: string) => f.nativeElement.querySelector(sel) as HTMLElement;
  const val = (f: any) => (q(f, 'input.phone-number-input') as HTMLInputElement).value;

  it('+201025073026 opens as Egypt (SVG flag, +20) with the local number 1025073026, not Saudi/empty', () => {
    const f = open('+201025073026');
    expect(q(f, '.dial-code').textContent!.trim()).toBe('+20');
    expect(q(f, '.country-selector-btn img.flag-img').getAttribute('src')).toBe('assets/flags/EG.svg');
    expect(val(f).replace(/\s/g, '')).toBe('1025073026');
    expect(f.componentInstance.ctrl.value).toBe('+201025073026'); // reading never rewrites the stored value
  });

  it('a stored number with spaces and no plus is read the same way', () => {
    expect(q(open('+20 102 507 3026'), '.dial-code').textContent!.trim()).toBe('+20');
    expect(q(open('201025073026'), '.dial-code').textContent!.trim()).toBe('+20');
  });

  it('an ambiguous number keeps its dial code and digits visible, shows the globe (no guessed flag) and is not rewritten', () => {
    const f = open('+1999999');
    expect(q(f, '.dial-code').textContent!.trim()).toBe('+1');
    expect(q(f, '.country-selector-btn img.flag-img')).toBeNull();
    expect(q(f, '.country-selector-btn .flag-globe')).not.toBeNull();
    expect(val(f).replace(/\s/g, '')).toBe('999999');
    expect(f.componentInstance.ctrl.value).toBe('+1999999');
  });

  it('a stored legacy number with no country at all stays visible as typed (no Saudi code in front of it)', () => {
    const f = open('0123456');
    expect(val(f).replace(/\s/g, '')).toBe('0123456');
    expect(q(f, '.dial-code').textContent!.trim()).not.toBe('+966');
  });

  it('picking a country on an ambiguous number resolves it and emits the full E.164 value', () => {
    const f = open('+1999999');
    q(f, '.country-selector-btn').click(); f.detectChanges();
    const us = (Array.from(f.nativeElement.querySelectorAll('.dropdown-item')) as HTMLElement[]).find(r => r.getAttribute('aria-label')!.startsWith('الولايات المتحدة'))!;
    us.click(); f.detectChanges();
    const v = f.componentInstance.ctrl.value as PhoneValue;
    expect([v.dialCode, v.number.replace(/\D/g, '')]).toEqual(['+1', '999999']);
    expect(q(f, '.country-selector-btn img.flag-img')).not.toBeNull();
  });

  it('an empty value uses the given defaultCountry (the account country), Saudi only when nothing else is known', () => {
    expect(q(open(null, 'AE'), '.dial-code').textContent!.trim()).toBe('+971');
    expect(q(open(null), '.dial-code').textContent!.trim()).toBe('+966');
  });
});

describe('Phone country dropdown keyboard navigation', () => {
  function open(search = '') {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.country-selector-btn').click();
    fixture.detectChanges();
    const component = fixture.debugElement.query(By.directive(PhoneInputComponent)).componentInstance as PhoneInputComponent;
    const input = fixture.nativeElement.querySelector('.dropdown-search-in') as HTMLInputElement;
    input.value = search;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return { fixture, component, input };
  }
  function key(target: HTMLElement, value: string) {
    const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  it('focuses search, then selects Egypt with ArrowDown and Enter after searching Eg', () => {
    const { fixture, component, input } = open('Eg');
    expect(document.activeElement).toBe(input);
    key(input, 'ArrowDown');
    const option = fixture.nativeElement.querySelector('.dropdown-item') as HTMLElement;
    expect(document.activeElement).toBe(option);
    key(option, 'Enter');
    fixture.detectChanges();
    expect(component.selectedCountry.code).toBe('EG');
    expect(fixture.nativeElement.querySelector('.country-dropdown-panel')).toBeNull();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.phone-number-input'));
  });
  it('moves between options and returns to search with ArrowUp', () => {
    const { fixture, input } = open();
    const options = fixture.nativeElement.querySelectorAll('.dropdown-item');
    key(input, 'ArrowDown');
    key(options[0], 'ArrowDown');
    expect(document.activeElement).toBe(options[1]);
    key(options[1], 'ArrowUp');
    expect(document.activeElement).toBe(options[0]);
    key(options[0], 'ArrowUp');
    expect(document.activeElement).toBe(input);
  });
  it('closes with Escape and returns focus to the trigger', () => {
    const { fixture, input } = open();
    key(input, 'Escape');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.country-dropdown-panel')).toBeNull();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.country-selector-btn'));
  });
  it('prevents form submission and handles arrows when the search has no results', () => {
    const { fixture, component, input } = open('no-such-country');
    key(input, 'ArrowDown');
    key(input, 'ArrowUp');
    key(input, 'Enter');
    fixture.detectChanges();
    expect(component.isOpen).toBe(true);
    expect(component.selectedCountry.code).toBe('SA');
    expect(document.activeElement).toBe(input);
  });
});
