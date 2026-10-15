import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProjectDetails } from './project-details';

vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

// Client workspace of a project CLOSED BY A DISPUTE SETTLEMENT: the header says so (not "completed"), the unreleased stages read "أُغلقت بالتسوية" with no approve /
// revise actions, progress is only the genuinely approved share (no fake 100%), and the pending amendment of the closed contract cannot be cancelled.
const REASON = 'أُغلق العقد، ولم يعد التعديل قابلًا للتطبيق';
const stage = (o: Record<string, unknown>) => ({ id: 's', stageNumber: 1, title: 'مرحلة', description: '', amount: 10, percentage: 50, days: 7, status: 'pending', roundsCount: 0, threads: [], amountHeld: false, ...o });
const CLOSED = { displayStatus: 'CLOSED_BY_SETTLEMENT', displayStatusLabel: 'أُغلقت بالتسوية' };
const DATA = {
  id: 'contract-1', projectId: 'proj-1', role: 'client', conversationId: 'conv-1', title: 'مشروع', clientName: 'نورة', contractRef: 'CT-1', price: 20, durationDays: 14, daysLeft: 0,
  progress: 0, escrowTotal: 20, escrowHeld: 0, escrowReleased: 10, status: 'COMPLETED', statusLabel: 'مكتمل', contractStatus: 'COMPLETED', escrowStatus: 'RELEASED', escrowFunded: true,
  adminSettled: { disputeId: 'd1', outcome: 'SPLIT', label: 'أُغلق بتسوية نزاع' }, disputeStatus: null, disputeFreeze: { frozen: false },
  stages: [stage({ id: 's1', status: 'submitted', roundsCount: 1, ...CLOSED }), stage({ id: 's2', stageNumber: 2, ...CLOSED })],
  deliveries: [], edits: [], messages: [], files: [], employee: null,
  aiInsights: { confidence: null, earlyDays: null, matchPercentage: null, riskLevel: 'غير محسوبة', riskLevelKey: 'unknown', healthRating: 'بانتظار بيانات كافية', bullets: [] }
};
const AM = (o: Record<string, unknown> = {}) => ({ id: 'a1', projectId: 'proj-1', requestedByRole: 'CLIENT', type: 'BUDGET', title: 'زيادة', description: null, budgetDelta: 200, durationDeltaDays: null, status: 'PENDING_OTHER_PARTY', effect: 'NONE', effectNote: REASON, actionable: false, actionBlockedReason: REASON, ...o });

describe('client project details: project closed by a dispute settlement', () => {
  async function setup(list: any[] = []) {
    const post = vi.fn(() => of({ success: true, data: {} }));
    const get = vi.fn((url: string) => String(url).includes('/amendments') ? of({ success: true, data: list }) : of({ success: true, data: DATA }));
    await TestBed.configureTestingModule({ imports: [ProjectDetails], providers: [provideRouter([]), { provide: HttpClient, useValue: { get, post } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) }, params: of({ id: 'proj-1' }) } }] }).compileComponents();
    const f = TestBed.createComponent(ProjectDetails); f.detectChanges(); await f.whenStable(); f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    return { f, c: f.componentInstance, el, post, q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
  }
  afterEach(() => TestBed.resetTestingModule());

  it('the header badge says «أُغلق بتسوية نزاع», never «مكتمل»', async () => {
    const s = await setup();
    expect(s.q('pd-status-badge')?.textContent).toContain('أُغلق بتسوية نزاع');
    expect(s.q('pd-status-badge')?.textContent).not.toContain('مكتمل');
    expect(s.c.headerStatusLabel(DATA)).toBe('أُغلق بتسوية نزاع');
    expect(s.c.headerStatusLabel({ statusLabel: 'مشروع نشط' })).toBe('مشروع نشط');
    expect(s.c.deadlineRating(DATA)).toBe('أُغلق بتسوية نزاع');
  });

  it('unreleased stages read «أُغلقت بالتسوية»: no «بانتظار قرارك», no approve / revise buttons, no «released» money wording', async () => {
    const s = await setup();
    const text = s.el.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('أُغلقت بالتسوية');
    expect(text).not.toContain('بانتظار قرارك');
    expect(s.el.querySelector('[data-testid="pd-approve-miles"]')).toBeNull();
    expect(s.c.statusHint(DATA.stages[0])).toBe('أُغلقت بالتسوية');
    expect(s.c.stageMoneyLabel(DATA.stages[0])).toBe('قيمة المرحلة 10 $ (تعاقدية سابقة، وليست مبلغًا ينتظر الإفراج)');
    expect(s.c.approvedCount(DATA)).toBe(0);
  });

  it('no fake 100%: the progress shown is the server value (only approved stages) — 0% here', async () => {
    const s = await setup();
    expect(DATA.progress).toBe(0);
    expect(s.el.textContent).toContain('0 من 2 مراحل مكتملة');
    expect(s.el.querySelector('.lc-ring')?.getAttribute('style') ?? '').not.toContain('100');
  });

  it('a pending amendment of the closed contract: the reason is shown and «إلغاء الطلب» is disabled; nothing is posted', async () => {
    const s = await setup([AM()]);
    s.c.openAmendments(); s.f.detectChanges();
    expect(s.q('amend-closed-reason')?.textContent).toContain(REASON);
    const cancel = s.q('amend-cancel') as HTMLButtonElement;
    expect(cancel.disabled).toBe(true); expect(cancel.getAttribute('title')).toBe(REASON);
    cancel.click();
    expect(s.post).not.toHaveBeenCalled();
    expect(s.c.amendmentBlockedReason(AM({ actionable: undefined, actionBlockedReason: undefined }))).toBeNull(); // an older API never blocks
  });
});
