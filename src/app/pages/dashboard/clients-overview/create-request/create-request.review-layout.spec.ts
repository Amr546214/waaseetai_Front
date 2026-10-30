import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CreateRequest } from './create-request';

describe('create request: the original wizard keeps the redesigned review', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

  async function mount(step = 6) {
    await TestBed.configureTestingModule({
      imports: [CreateRequest],
      providers: [provideRouter([]), { provide: HttpClient, useValue: {
        get: () => of({ success: false }), post: () => of({ success: false }),
      } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(CreateRequest);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.currentStep.set(step);
    component.title.set('تطوير متجر إلكتروني');
    component.description.set('وصف المشروع كاملًا دون اختصار في ملخص المراجعة.');
    component.outputs.set('الكود المصدري والتوثيق');
    fixture.detectChanges();
    return { fixture, component, el: fixture.nativeElement as HTMLElement };
  }

  it('keeps the sectioned review and PDF export at step 6', async () => {
    const { el } = await mount();
    expect(el.querySelector('#request-review-document')).not.toBeNull();
    expect(el.querySelector('[data-testid="export-review-pdf"]')?.textContent).toContain('تصدير PDF');
    expect(el.querySelector('[data-testid="review-description"]')?.textContent).toContain('دون اختصار');
    expect(el.querySelector('.review-outputs')?.textContent).toContain('الكود المصدري');
    expect(el.querySelector('app-step6-review .summary-grid')).toBeNull();
  });

  it('starts with the original specialty step and six-step progress indicator', async () => {
    const { el } = await mount(1);
    expect(el.querySelector('app-step1-specialty')).not.toBeNull();
    expect(el.querySelectorAll('.step-item').length).toBe(6);
    expect(el.querySelector('[data-testid="choose-quick"]')).toBeNull();
    expect(el.querySelector('[data-testid="request-editor"]')).toBeNull();
  });

  it('returns to the original budget step when editing its review section', async () => {
    const { fixture, component, el } = await mount();
    (el.querySelector('button[aria-label="تعديل الميزانية"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(4);
    expect(el.querySelector('app-step4-budget')).not.toBeNull();
  });

  it('returns to the original attachments step when editing review files', async () => {
    const { fixture, component, el } = await mount();
    (el.querySelector('button[aria-label="تعديل الملفات"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(5);
    expect(el.querySelector('app-step5-files')).not.toBeNull();
  });

  it('returns to attachments with the review back button', async () => {
    const { fixture, component, el } = await mount();
    (el.querySelector('.step6-back-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(5);
  });
});
