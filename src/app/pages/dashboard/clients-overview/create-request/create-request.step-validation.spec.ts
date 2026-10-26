import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CreateRequest } from './create-request';

// D-CM2: «التالي» / «نشر الطلب» stay clickable; pressing them (or Enter) names what is missing under the right field.
describe('create-request: red validation on every step', () => {
  let fixture: ComponentFixture<CreateRequest>;
  let c: CreateRequest;
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector<HTMLElement>(s);
  const next = () => q('[data-testid="wizard-next"]') as HTMLButtonElement;
  const flush = () => new Promise<void>(r => setTimeout(() => setTimeout(r, 0), 0));
  const press = async () => { next().click(); await flush(); render(); };
  const type = (id: string, v: string) => { const i = q('#' + id) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input')); render(); };
  const errors = () => Array.from(el().querySelectorAll('[data-testid="field-error"]')).map(e => e.textContent!.trim());

  beforeEach(async () => {
    localStorage.clear(); sessionStorage.clear();
    await TestBed.configureTestingModule({ imports: [CreateRequest], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    fixture = TestBed.createComponent(CreateRequest);
    c = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    c.specialties.set([
      { id: 'dev', name: 'برمجة', count: '+1', icon: 'M0 0', color: '', subs: [] },
      { id: 'other', name: 'أخرى', count: '', icon: 'M0 0', color: '', subs: [] },
    ] as any);
  });
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); localStorage.clear(); });

  it('step 1: Next is enabled; empty click marks the specialty grid', async () => {
    c.currentStep.set(1); fixture.detectChanges();
    expect(next().disabled).toBe(false);
    await press();
    const grid = q('#f-specialty-grid')!;
    expect(grid.getAttribute('aria-invalid')).toBe('true');
    expect(grid.classList.contains('ws-invalid')).toBe(true);
    const msg = q('#' + grid.getAttribute('aria-describedby'));
    expect(msg?.getAttribute('role')).toBe('alert');
    expect(msg?.textContent).toContain('اختر تخصصًا');
    expect(c.currentStep()).toBe(1);
    c.selectSpec('dev'); render();
    expect(grid.getAttribute('aria-invalid')).toBeNull();
    expect(errors().length).toBe(0);
  });

  it('step 1: "other" needs 5 chars, error on the text field, cleared by typing', async () => {
    c.currentStep.set(1); fixture.detectChanges();
    c.selectSpec('other'); render();
    await press();
    const f = q('#f-other-spec')!;
    expect(f.getAttribute('aria-invalid')).toBe('true');
    expect(errors()).toEqual(['اكتب اسم التخصص بخمسة أحرف على الأقل']);
    type('f-other-spec', 'برمجة');
    expect(f.getAttribute('aria-invalid')).toBeNull();
    expect(errors().length).toBe(0);
  });

  it('step 2: nothing required, Next just moves on', async () => {
    c.currentStep.set(2); fixture.detectChanges();
    await press();
    expect(c.currentStep()).toBe(3);
  });

  it('step 3: three required fields each get their own message; the first is focused; fixing one keeps the others', async () => {
    c.currentStep.set(3); fixture.detectChanges();
    await press();
    expect(c.currentStep()).toBe(3);
    for (const id of ['f-title', 'f-desc', 'f-deadline']) {
      const f = q('#' + id)!;
      expect(f.getAttribute('aria-invalid'), id).toBe('true');
      expect(q('#' + f.getAttribute('aria-describedby')!.split(' ').pop())?.getAttribute('role')).toBe('alert');
    }
    expect(document.activeElement).toBe(q('#f-title'));
    type('f-title', 'عنوان مناسب');
    expect(q('#f-title')!.getAttribute('aria-invalid')).toBeNull();
    expect(q('#f-desc')!.getAttribute('aria-invalid')).toBe('true');
    expect(q('#f-deadline')!.getAttribute('aria-invalid')).toBe('true');
    expect(errors().length).toBe(2);
  });

  it('step 3: delivery days out of 1..365 is its own message', async () => {
    c.currentStep.set(3); c.title.set('عنوان صالح'); c.description.set('وصف كاف للطلب'); fixture.detectChanges();
    c.deliveryDays.set(400); render();
    await press();
    expect(errors()).toEqual(['أيام التسليم عدد صحيح من 1 إلى 365']);
  });

  it('step 3: Enter in a required input behaves like Next', async () => {
    c.currentStep.set(3); fixture.detectChanges();
    q('#f-title')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush(); render();
    expect(q('#f-title')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('step 4: only the active budget type is required (conditional rules kept)', async () => {
    c.currentStep.set(4); c.budgetType.set('fixed'); fixture.detectChanges();
    await press();
    expect(errors()).toEqual(['أدخل الميزانية (USD)']);
    expect(q('#f-budget-fixed')!.getAttribute('aria-invalid')).toBe('true');
    c.budgetType.set('range'); render();
    await press();
    expect(q('#f-budget-from')!.getAttribute('aria-invalid')).toBe('true');
    expect(q('#f-budget-to')!.getAttribute('aria-invalid')).toBe('true');
    expect(errors().length).toBe(2);
    type('f-budget-from', '500'); type('f-budget-to', '300');
    await press();
    expect(errors()).toEqual(['الحد الأعلى يجب أن يكون أكبر من أو يساوي الحد الأدنى']);
    c.budgetType.set('hourly'); render();
    await press();
    expect(q('#f-budget-hourly')!.getAttribute('aria-invalid')).toBe('true');
    expect(errors().length).toBe(1);
  });

  it('step 4: milestones stay conditional (off = no milestone error), on = rows named', async () => {
    c.currentStep.set(4); c.budgetType.set('fixed'); c.budgetFixed.set(1000); fixture.detectChanges();
    await press();
    expect(c.currentStep()).toBe(5);
    c.currentStep.set(4); c.splitMilestones.set(true); c.milestones.set([{ name: '', pct: null }, { name: 'ب', pct: 40 }]); fixture.detectChanges(); render();
    await press();
    expect(c.currentStep()).toBe(4);
    expect(q('#ms-name-0')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('step 5: nothing required', async () => {
    c.currentStep.set(5); fixture.detectChanges();
    await press();
    expect(c.currentStep()).toBe(6);
  });

  it('step 6: publish stays enabled; unchecked acknowledgements are named, each under its own row', async () => {
    c.currentStep.set(6); fixture.detectChanges();
    const btn = q('[data-testid="wizard-publish"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    btn.click(); await flush(); render();
    for (const k of ['data', 'terms', 'privacy', 'publish']) expect(q('#ack-' + k)!.getAttribute('aria-invalid'), k).toBe('true');
    expect(document.activeElement).toBe(q('#ack-data'));
    q('#ack-terms')!.click(); render();
    expect(q('#ack-terms')!.getAttribute('aria-invalid')).toBeNull();
    expect(q('#ack-data')!.getAttribute('aria-invalid')).toBe('true');
    expect(errors().length).toBe(3);
    expect(q('app-step6-review .modal-overlay')).toBeNull();
  });

  it('server 400 errors[] land on the right fields and step', async () => {
    fixture.autoDetectChanges(true);
    c.currentStep.set(4); c.budgetType.set('fixed'); fixture.detectChanges();
    (c as any).handlePublishError({ status: 400, error: { message: 'x', errors: [{ path: 'minBudget', message: 'أدخل ميزانية الطلب' }] } });
    await new Promise(r => setTimeout(r, 80)); render();
    expect(q('#f-budget-fixed')!.getAttribute('aria-invalid')).toBe('true');
    (c as any).handlePublishError({ status: 400, error: { message: 'x', errors: [{ path: 'title', message: 'عنوان الطلب يجب أن يكون 3 أحرف على الأقل' }] } });
    await new Promise(r => setTimeout(r, 80)); render();
    expect(c.currentStep()).toBe(3);
    expect(q('#f-title')!.getAttribute('aria-invalid')).toBe('true');
    expect(q('#f-desc')!.getAttribute('aria-invalid')).toBeNull();
  });

  it('server errors on two steps: the earliest step opens first even when the server lists the later one first', async () => {
    fixture.autoDetectChanges(true);
    c.currentStep.set(6); fixture.detectChanges();
    (c as any).handlePublishError({ status: 400, error: { message: 'x', errors: [{ path: 'minBudget', message: 'أدخل ميزانية الطلب' }, { path: 'title', message: 'عنوان الطلب يجب أن يكون 3 أحرف على الأقل' }] } });
    await new Promise(r => setTimeout(r, 80)); render();
    expect(c.currentStep()).toBe(3);
    expect(q('#f-title')!.getAttribute('aria-invalid')).toBe('true');
  });
});
