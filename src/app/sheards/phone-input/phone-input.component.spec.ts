import { Component } from '@angular/core';
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
