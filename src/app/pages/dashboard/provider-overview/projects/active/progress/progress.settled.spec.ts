import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Progress } from './progress';

// Provider workspace of a project CLOSED BY A DISPUTE SETTLEMENT: the header and the unreleased stages say so, progress stays at the REAL approved share (no fake 100%),
// and the pending amendments of the closed contract have every action disabled with the reason.
const REASON = 'أُغلق العقد، ولم يعد التعديل قابلًا للتطبيق';
const stage = (o: Record<string, unknown>) => ({ id: 's', stageNumber: 1, title: 'مرحلة', description: '', amount: 10, percentage: 50, days: 7, isDone: false, isWait: false, status: 'pending', statusText: 'لم تبدأ', roundsCount: 0, threads: [], amountHeld: false, ...o });
const DATA = {
  projectId: 'project-9', conversationId: 'conv-9', title: 'مشروع', progress: 0, status: 'COMPLETED', statusLabel: 'أُغلق بتسوية نزاع',
  adminSettled: { disputeId: 'd1', outcome: 'SPLIT', label: 'أُغلق بتسوية نزاع' },
  stages: [stage({ id: 's1', status: 'submitted', statusText: 'بانتظار العميل', displayStatus: 'CLOSED_BY_SETTLEMENT', displayStatusLabel: 'أُغلقت بالتسوية' }), stage({ id: 's2', stageNumber: 2, displayStatus: 'CLOSED_BY_SETTLEMENT', displayStatusLabel: 'أُغلقت بالتسوية' })],
  edits: [], messages: [], files: [], deliveries: []
};
const AM = (o: Record<string, unknown> = {}) => ({ id: 'c1', projectId: 'project-9', projectTitle: 'مشروع', type: 'BUDGET', title: 'زيادة', description: 'سبب', budgetDelta: 5, durationDeltaDays: null, status: 'PENDING_OTHER_PARTY', requestedByRole: 'CLIENT', createdAt: '2026-01-01T00:00:00Z', respondedAt: null, conversationId: null, effect: 'NONE', effectNote: REASON, actionable: false, actionBlockedReason: REASON, needsClientPayment: false, ...o });

describe('provider progress: project closed by a dispute settlement', () => {
  async function setup(list: any[]) {
    const post = vi.fn(() => of({ success: true, data: {} }));
    const get = vi.fn((url: string) => String(url).includes('/amendments') ? of({ success: true, data: list }) : of({ success: true, data: DATA }));
    await TestBed.configureTestingModule({ imports: [Progress], providers: [provideRouter([]), { provide: HttpClient, useValue: { get, post } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'contract-1' }) } } }] }).compileComponents();
    const f = TestBed.createComponent(Progress); f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    return { f, c: f.componentInstance, post, el, qa: (id: string) => Array.from(el.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[] };
  }
  afterEach(() => TestBed.resetTestingModule());

  it('the header shows the settlement label (not "completed") and the unreleased stages read "أُغلقت بالتسوية"; no stage is marked done', async () => {
    const s = await setup([]);
    const text = s.el.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('أُغلق بتسوية نزاع');
    expect(text).toContain('أُغلقت بالتسوية');
    expect(text).not.toContain('بانتظار العميل');
    expect(text).not.toContain('المشروع مكتمل — قيّم العميل'); // no NEW rating offer for a settled project
    expect(s.c.canRateClient(DATA)).toBe(false);
    expect(s.c.stageText(DATA.stages[0])).toBe('أُغلقت بالتسوية');
    expect(s.c.stageText({ statusText: 'جارية' })).toBe('جارية');
    expect(s.c.projectData()!.progress).toBe(0); // no fake 100%: progress is the server's approved share
  });

  it('a pending amendment of the closed contract: reason shown, approve / reject disabled, nothing posted', async () => {
    const s = await setup([AM()]);
    s.c.openAmendments(); s.f.detectChanges();
    expect(s.qa('amend-closed-reason')[0].textContent).toContain(REASON);
    expect((s.qa('amend-respond-approve')[0] as HTMLButtonElement).disabled).toBe(true);
    expect((s.qa('amend-respond-reject')[0] as HTMLButtonElement).disabled).toBe(true);
    s.c.askAmendDecision(s.c.amendments()[0], 'approve');
    expect(s.c.pendingAmendDecision()).toBeNull();
    s.c.respondAmendment(s.c.amendments()[0], 'approve');
    expect(s.post).not.toHaveBeenCalled();
  });

  it('my own pending request on the closed contract cannot be cancelled (disabled with the reason)', async () => {
    const s = await setup([AM({ requestedByRole: 'PROVIDER' })]);
    s.c.openAmendments(); s.f.detectChanges();
    const cancel = s.qa('amend-cancel-own')[0] as HTMLButtonElement;
    expect(cancel.disabled).toBe(true); expect(cancel.getAttribute('title')).toBe(REASON);
    s.c.cancelOwnAmendment(s.c.amendments()[0]);
    expect(s.post).not.toHaveBeenCalled();
  });
});
