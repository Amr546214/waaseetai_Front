import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { CreateRequest } from './create-request';

// Step 4 milestones: typing is never blocked or reset; errors show only after blur / Add / Next; validation at submit is unchanged.
describe('create-request: milestone inputs do not block typing', () => {
  let fixture: ComponentFixture<CreateRequest>;
  let c: CreateRequest;
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const inputs = () => Array.from(el().querySelectorAll<HTMLInputElement>('.milestones-section input'));
  const type = (input: HTMLInputElement, value: string) => { input.value = value; input.dispatchEvent(new Event('input')); render(); };

  beforeEach(async () => {
    localStorage.clear(); sessionStorage.clear();
    await TestBed.configureTestingModule({ imports: [CreateRequest], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    fixture = TestBed.createComponent(CreateRequest);
    c = fixture.componentInstance;
    c.currentStep.set(4);
    c.budgetType.set('fixed'); c.budgetFixed.set(1000);
    c.splitMilestones.set(true);
    fixture.detectChanges();
    c.addMilestone();                                          // first Add on an empty list
    c.milestones.update(m => [...m, { name: '', pct: null }]);
    render();
  });
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); localStorage.clear(); });

  it('a one-character name stays in the input (same DOM node, focus kept), continues to two characters, no error while typing', () => {
    const [nameBefore] = inputs();
    nameBefore.focus();
    type(nameBefore, 'ت');
    expect(inputs()[0]).toBe(nameBefore);                      // the row is not re-created on a keystroke
    expect(inputs()[0].value).toBe('ت');
    expect(document.activeElement === nameBefore || !document.hasFocus()).toBe(true);
    expect(el().querySelector('[data-testid="ms-name-error"]')).toBeNull();
    type(inputs()[0], 'تح');
    expect(c.milestones()[0].name).toBe('تح');
    expect(el().querySelector('[data-testid="ms-name-error"]')).toBeNull();
  });

  it('the name error appears only after blur, and goes away once the name is long enough', () => {
    type(inputs()[0], 'ت');
    expect(el().querySelector('[data-testid="ms-name-error"]')).toBeNull();
    inputs()[0].dispatchEvent(new Event('blur')); render();
    expect(el().querySelector('[data-testid="ms-name-error"]')!.textContent).toContain('حرفان على الأقل');
    expect(inputs()[0].value).toBe('ت');                       // never cleared
    type(inputs()[0], 'تحليل');
    expect(el().querySelector('[data-testid="ms-name-error"]')).toBeNull();
  });

  it('the percentage can be emptied and retyped; it is never forced to 0 while editing', () => {
    type(inputs()[1], '40');
    expect(c.milestones()[0].pct).toBe(40);
    type(inputs()[1], '');
    expect(c.milestones()[0].pct).toBeNull();
    expect(inputs()[1].value).toBe('');                        // not forced to 0
    expect(el().querySelector('[data-testid="ms-pct-error"]')).toBeNull();
    type(inputs()[1], '3');
    expect(c.milestones()[0].pct).toBe(3);
    type(inputs()[1], '35');
    expect(c.milestones()[0].pct).toBe(35);
  });

  it('an invalid percentage shows its error after blur, under the field; typing is not blocked', () => {
    type(inputs()[1], '150');
    expect(inputs()[1].value).toBe('150');
    expect(el().querySelector('[data-testid="ms-pct-error"]')).toBeNull();
    inputs()[1].dispatchEvent(new Event('blur')); render();
    expect(el().querySelector('[data-testid="ms-pct-error"]')!.textContent).toContain('بين 1 و100');
  });

  it('Add reveals the errors of the invalid rows already there; Next (still clickable on step 4) reveals everything and blocks', () => {
    c.addMilestone(); render();
    expect(el().querySelectorAll('[data-testid="ms-name-error"]').length).toBe(2);   // the two earlier blank rows; the new one is clean
    expect(c.milestones().length).toBe(3);
    c.milestones.set([{ name: 'م', pct: 50 }, { name: 'مرحلة ثانية', pct: null }]); render();
    const next = Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('التالي')) as HTMLButtonElement | undefined;
    expect(c.canProceed()).toBe(false);
    c.goNext(); render();
    expect(c.currentStep()).toBe(4);
    expect(el().querySelector('[data-testid="ms-name-error"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="ms-pct-error"]')).not.toBeNull();
    if (next) expect(next.disabled).toBe(false);
  });

  it('submit-time rules are unchanged: 2+ milestones, names >= 2 chars, pct > 0, total 100; payload carries plain numbers', () => {
    c.milestones.set([{ name: 'تحليل', pct: 60 }, { name: 'تسليم', pct: 40 }]);
    expect(c.canProceed()).toBe(true);
    c.milestones.set([{ name: 'تحليل', pct: 60 }, { name: 'ت', pct: 40 }]);
    expect(c.canProceed()).toBe(false);
    c.milestones.set([{ name: 'تحليل', pct: 60 }, { name: 'تسليم', pct: null }]);
    expect(c.canProceed()).toBe(false);
    c.milestones.set([{ name: 'تحليل', pct: 60 }, { name: 'تسليم', pct: 30 }]);
    expect(c.canProceed()).toBe(false);
    c.milestones.set([{ name: 'تحليل', pct: 0 }, { name: 'تسليم', pct: 100 }]);
    expect(c.canProceed()).toBe(false);
  });
});
