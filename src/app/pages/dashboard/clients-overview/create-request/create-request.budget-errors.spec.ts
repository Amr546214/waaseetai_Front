import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CreateRequest } from './create-request';
import { FormA11ySyncService } from '../../../../shared/forms/form-a11y-sync.service';

// K-4: every budget error sits on the field that breaks the rule, with its own message + aria-describedby;
// no field is ever marked invalid without a message.
describe('create-request step 4: budget errors bound to the right field', () => {
  let fixture: ComponentFixture<CreateRequest>;
  let c: CreateRequest;
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); TestBed.inject(FormA11ySyncService).sync(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector<HTMLElement>(s);
  const flush = () => new Promise<void>(r => setTimeout(() => setTimeout(r, 0), 0));
  const press = async () => { (q('[data-testid="wizard-next"]') as HTMLButtonElement).click(); await flush(); render(); };
  const type = (id: string, v: string) => { const i = q('#' + id) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input')); render(); };
  /** message text of a field, or null when it has no aria-describedby message */
  const msgOf = (id: string) => {
    const d = q('#' + id)!.getAttribute('aria-describedby');
    const m = d ? q('#' + d.split(' ').pop()) : null;
    return m ? m.textContent!.trim() : null;
  };
  const invalid = (id: string) => q('#' + id)!.getAttribute('aria-invalid') === 'true';
  /** invariant: invalid <=> has a message */
  const consistent = () => {
    for (const id of ['f-budget-from', 'f-budget-to', 'f-budget-fixed', 'f-budget-hourly']) {
      if (!q('#' + id)) continue;
      expect(invalid(id), id + ' invalid').toBe(msgOf(id) !== null);
    }
  };
  const FROM = 'أدخل الحد الأدنى للميزانية بالدولار';
  const TO = 'أدخل الحد الأعلى للميزانية بالدولار';
  const ORDER = 'الحد الأعلى يجب أن يكون أكبر من أو يساوي الحد الأدنى';

  beforeEach(async () => {
    localStorage.clear(); sessionStorage.clear();
    await TestBed.configureTestingModule({ imports: [CreateRequest], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    fixture = TestBed.createComponent(CreateRequest);
    c = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    c.currentStep.set(4); c.budgetType.set('range'); fixture.detectChanges();
  });
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); localStorage.clear(); });

  it('from=0, to=10: message only on from, to is NOT marked', async () => {
    type('f-budget-from', '0'); type('f-budget-to', '10');
    await press();
    expect(msgOf('f-budget-from')).toBe(FROM);
    expect(invalid('f-budget-to')).toBe(false);
    expect(msgOf('f-budget-to')).toBeNull();
    consistent();
  });

  it('empty both press, then from=0 and to=10: stale marks never leave `to` invalid without message', async () => {
    await press();
    type('f-budget-to', '10'); type('f-budget-from', '0');
    await press();
    expect(msgOf('f-budget-from')).toBe(FROM);
    expect(invalid('f-budget-to')).toBe(false);
    consistent();
  });

  it('only from filled: message on to; only to filled: message on from', async () => {
    type('f-budget-from', '500');
    await press();
    expect(msgOf('f-budget-to')).toBe(TO);
    expect(invalid('f-budget-from')).toBe(false);
    consistent();
    type('f-budget-from', ''); type('f-budget-to', '500');
    await press();
    expect(msgOf('f-budget-from')).toBe(FROM);
    expect(invalid('f-budget-to')).toBe(false);
    consistent();
  });

  it('min > max: message on `to` (the field that must change), from untouched', async () => {
    type('f-budget-from', '500'); type('f-budget-to', '300');
    await press();
    expect(msgOf('f-budget-to')).toBe(ORDER);
    expect(invalid('f-budget-from')).toBe(false);
    consistent();
  });

  it('negative values are rejected on their own field', async () => {
    type('f-budget-from', '-5'); type('f-budget-to', '10');
    await press();
    expect(msgOf('f-budget-from')).toBe(FROM);
    expect(invalid('f-budget-to')).toBe(false);
    type('f-budget-from', '5'); type('f-budget-to', '-10');
    await press();
    expect(c.currentStep()).toBe(4);
    expect(msgOf('f-budget-to')).toBe(TO);
    expect(invalid('f-budget-from')).toBe(false);
    consistent();
  });

  it('NaN / non-finite model values are not positive', async () => {
    c.budgetMin.set(NaN); c.budgetMax.set(Infinity); render();
    await press();
    expect(msgOf('f-budget-from')).toBe(FROM);
    expect(msgOf('f-budget-to')).toBe(TO);
    c.budgetMin.set(10); c.budgetMax.set(NaN); render();
    await press();
    expect(msgOf('f-budget-to')).toBe(TO);
    consistent();
  });

  it('correcting one field clears only its error; the other keeps its own', async () => {
    await press();
    expect(msgOf('f-budget-from')).toBe(FROM);
    expect(msgOf('f-budget-to')).toBe(TO);
    type('f-budget-to', '900');
    expect(invalid('f-budget-to')).toBe(false);
    expect(msgOf('f-budget-from')).toBe(FROM);
    type('f-budget-from', '100');
    expect(invalid('f-budget-from')).toBe(false);
    await press();
    expect(c.currentStep()).toBe(5);
  });

  it('fixing `to` after an order error clears it', async () => {
    type('f-budget-from', '500'); type('f-budget-to', '300');
    await press();
    expect(msgOf('f-budget-to')).toBe(ORDER);
    type('f-budget-to', '800');
    expect(invalid('f-budget-to')).toBe(false);
    consistent();
    await press();
    expect(c.currentStep()).toBe(5);
  });

  it('fixed and hourly: <= 0 / empty marks only that field with a message', async () => {
    c.budgetType.set('fixed'); render();
    type('f-budget-fixed', '0'); await press();
    expect(msgOf('f-budget-fixed')).toBe('أدخل الميزانية بالدولار');
    consistent();
    c.budgetType.set('hourly'); render();
    type('f-budget-hourly', '-3'); await press();
    expect(msgOf('f-budget-hourly')).toBe('أدخل سعر الساعة بالدولار');
    consistent();
  });
});
