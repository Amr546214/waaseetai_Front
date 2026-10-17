import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
  const flag = (f: any) => f.nativeElement.querySelector('.flag').textContent.trim();
  const dial = (f: any) => f.nativeElement.querySelector('.dial-code').textContent.trim();

  it('pasting "+201025073026" while Saudi Arabia is selected switches to Egypt (🇪🇬 +20) and keeps the local number 1025073026', () => {
    const f = make();
    expect([flag(f), dial(f)]).toEqual(['🇸🇦', '+966']);
    type(f, '+201025073026');
    expect([flag(f), dial(f)]).toEqual(['🇪🇬', '+20']);
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
    expect([flag(f), dial(f)]).toEqual(['🇪🇬', '+20']);
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
