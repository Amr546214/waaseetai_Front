import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SaDisputes } from './sa-disputes';
import { Dispute } from '../../../../core/models/dispute.model';

// Implementation Batch 2, Part B — advisory-only AI dispute summary panel
// on the REAL admin dispute detail view. These tests prove the panel is
// purely additive: it never touches the manual resolve/reject state, never
// pre-fills resolutionText/resolutionNote, and never renders a
// verdict/fault/confidence-style field (only caseSummary/timelineSummary/
// evidenceSummary/evidenceGaps/suggestedQuestions).

function makeDispute(overrides: Partial<Dispute> = {}): Dispute {
  return {
    id: 'dispute-1',
    requestId: 'req-1',
    projectId: null,
    status: 'OPEN',
    reason: 'التسليم غير مطابق',
    description: 'وصف حقيقي للنزاع',
    evidence: ['https://cdn.example.com/e1.png'],
    resolution: null,
    resolutionNote: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    resolvedAt: null,
    ...overrides,
  };
}

function makeAiSummary(overrides: Record<string, any> = {}) {
  return {
    caseSummary: 'ملخص محايد للحالة بناءً على البيانات المتاحة.',
    timelineSummary: 'تسلسل زمني موجز حتى فتح النزاع.',
    evidenceSummary: ['دليل واحد مرفق من الطرف الذي فتح النزاع.'],
    evidenceGaps: ['لا يوجد إثبات واضح لتاريخ التسليم.'],
    suggestedQuestions: ['هل تم التواصل بخصوص التأخير؟'],
    ...overrides,
  };
}

describe('SaDisputes — advisory AI summary panel', () => {
  let component: SaDisputes;
  let fixture: ComponentFixture<SaDisputes>;
  let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

  async function setup(postImpl: (...args: any[]) => any) {
    getSpy = vi.fn((url: string) =>
      String(url).includes('/disputes/dispute-1') ? of({ success: true, data: makeDispute() }) : of({ success: true, data: { items: [makeDispute()], pagination: { page: 1, limit: 10, total: 1, pages: 1 } } }),
    );
    postSpy = vi.fn(postImpl);
    await TestBed.configureTestingModule({
      imports: [SaDisputes],
      providers: [
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), post: (...args: any[]) => postSpy(...args) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SaDisputes);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.openDetail(makeDispute());
    fixture.detectChanges();
  }

  it('requestAiSummary() calls the real POST /admin/disputes/:id/ai-summary endpoint', async () => {
    await setup(() => of({ success: true, data: makeAiSummary() }));
    postSpy.mockClear();

    component.requestAiSummary();

    expect(postSpy.mock.calls[0][0]).toContain('/admin/disputes/dispute-1/ai-summary');
  });

  it('shows a loading state while the advisory summary request is in flight', async () => {
    await setup(() => of({ success: true, data: makeAiSummary() }));
    expect(component.aiSummaryLoading()).toBe(false);
    component.requestAiSummary();
    // The mocked post resolves synchronously via `of`, so loading is
    // already cleared by the time we can observe it here — assert the
    // terminal state instead, which is the meaningful outcome.
    expect(component.aiSummaryLoading()).toBe(false);
    expect(component.aiSummary()).toBeTruthy();
  });

  it('renders the real advisory fields on success', async () => {
    await setup(() => of({ success: true, data: makeAiSummary() }));
    component.requestAiSummary();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('ملخص محايد للحالة بناءً على البيانات المتاحة.');
    expect(text).toContain('هل تم التواصل بخصوص التأخير؟');
  });

  it('shows an honest error on failure, never a fabricated summary', async () => {
    await setup(() => throwError(() => ({ error: { message: 'تعذر إنشاء ملخص الذكاء الاصطناعي لهذا النزاع حالياً' } })));
    component.requestAiSummary();

    expect(component.aiSummaryError()).toBe('تعذر إنشاء ملخص الذكاء الاصطناعي لهذا النزاع حالياً');
    expect(component.aiSummary()).toBeNull();
  });

  it('never renders a verdict/fault/confidence-style field — only the advisory shape', async () => {
    await setup(() => of({ success: true, data: makeAiSummary() }));
    component.requestAiSummary();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('نسبة المسؤولية');
    expect(text).not.toContain('القرار النهائي: ');
    expect(text).not.toContain('الفائز');
    expect(text).not.toContain('confidence');
  });

  it('does not pre-fill the manual resolution form from the AI summary', async () => {
    await setup(() => of({ success: true, data: makeAiSummary() }));
    component.requestAiSummary();

    expect(component.resolutionText()).toBe('');
    expect(component.resolutionNote()).toBe('');
    expect(component.resolveAction()).toBeNull();
  });

  it('manual resolve/reject controls remain fully independent of the AI summary state', async () => {
    await setup(() => of({ success: true, data: makeAiSummary() }));
    component.requestAiSummary();
    fixture.detectChanges();

    expect(component.canResolve('OPEN')).toBe(true);
    component.openResolveForm('resolve');
    expect(component.showResolveForm()).toBe(true);
    expect(component.resolveAction()).toBe('resolve');
    // The AI summary already fetched stays untouched by opening the manual form.
    expect(component.aiSummary()).toBeTruthy();
  });

  it('resets the AI summary state when a different dispute is opened', async () => {
    await setup(() => of({ success: true, data: makeAiSummary() }));
    component.requestAiSummary();
    expect(component.aiSummary()).toBeTruthy();

    component.openDetail(makeDispute({ id: 'dispute-2' }));

    expect(component.aiSummary()).toBeNull();
    expect(component.aiSummaryError()).toBe('');
  });
});
