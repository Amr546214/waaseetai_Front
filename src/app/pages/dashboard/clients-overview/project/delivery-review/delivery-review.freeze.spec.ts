import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { DeliveryReview } from './delivery-review';

// Dispute freeze on the client's review page: while a dispute on the project is open the backend refuses approvals (423).
// The page keeps the approve button VISIBLE but disabled with the reason, never sends the approval, and leaves the
// revision request, the chat and the evidence available.
const REASON = 'اعتماد المراحل وصرف الأموال موقوفان بسبب نزاع مفتوح على هذا المشروع إلى أن تحسمه الإدارة.';

function workspace(disputeFreeze: any) {
  return {
    success: true,
    data: {
      id: 'contract-1', projectId: 'proj-1', title: 'مشروع', clientName: 'نورة', contractRef: 'CT-1', conversationId: 'conv-1',
      disputeFreeze,
      stages: [{ id: 'stage-1', stageNumber: 1, title: 'المرحلة', amount: 100, status: 'submitted', threads: [{ id: 'd1', date: new Date().toISOString(), files: [] }] }],
    },
  };
}

async function setup(freeze: any, post: () => any = () => of({ success: true, data: {} })) {
  const postSpy = vi.fn<(...a: any[]) => any>(post);
  await TestBed.configureTestingModule({
    imports: [DeliveryReview],
    providers: [
      provideRouter([]),
      { provide: HttpClient, useValue: { get: () => of(workspace(freeze)), post: (...a: any[]) => postSpy(...a) } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1', stageId: 'stage-1' }) } } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(DeliveryReview);
  vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, postSpy, el: fixture.nativeElement as HTMLElement };
}

describe('DeliveryReview - dispute freeze', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('frozen: shows the Arabic reason, keeps the approve button visible but disabled, and never posts the approval', async () => {
    const { component, postSpy, el } = await setup({ frozen: true, activeDisputeCount: 1, disputeId: 'dp1', reason: REASON });
    expect(el.querySelector('[data-testid="dr-freeze-banner"]')?.textContent).toContain(REASON);
    const approve = el.querySelector('[data-testid="dr-approve"]') as HTMLButtonElement;
    expect(approve).toBeTruthy();
    expect(approve.disabled).toBe(true);
    expect(approve.getAttribute('title')).toBe(REASON);
    component.approveDelivery();
    expect(postSpy).not.toHaveBeenCalled();
    expect(component.error()).toBe(REASON);
  });

  it('frozen: the revision request and the conversation are still available', async () => {
    const { el, postSpy, component } = await setup({ frozen: true, activeDisputeCount: 2, disputeId: 'dp1', reason: REASON });
    const toggle = el.querySelector('[data-testid="dr-revision-toggle"]') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    expect(toggle.disabled).toBe(false);
    expect(el.textContent).toContain('فتح نقاش مع مقدم الخدمة');
    component.revisionNote = 'يرجى تعديل الألوان كما في الملاحظات';
    component.revisionOpen.set(true);
    component.requestRevision();
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect((postSpy.mock.calls[0] as any[])[1].decision).toBe('revision');
  });

  it('not frozen: no banner, approve enabled and posted as before', async () => {
    const { component, postSpy, el } = await setup({ frozen: false, activeDisputeCount: 0, disputeId: null, reason: null });
    expect(el.querySelector('[data-testid="dr-freeze-banner"]')).toBeNull();
    expect((el.querySelector('[data-testid="dr-approve"]') as HTMLButtonElement).disabled).toBe(false);
    component.approveDelivery();
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect((postSpy.mock.calls[0] as any[])[1].decision).toBe('approve');
  });

  it('an older backend without disputeFreeze behaves exactly as before', async () => {
    const { el } = await setup(undefined);
    expect(el.querySelector('[data-testid="dr-freeze-banner"]')).toBeNull();
    expect((el.querySelector('[data-testid="dr-approve"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('a 423 from the server (race: the dispute opened after the page loaded) shows the server reason and keeps the page usable', async () => {
    const { component, postSpy } = await setup({ frozen: false, activeDisputeCount: 0, disputeId: null, reason: null },
      () => throwError(() => ({ error: { message: REASON }, status: 423 })));
    component.approveDelivery();
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(component.error()).toBe(REASON);
    expect(component.saving()).toBe(false);
  });
});
