import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ProjectModificationsComponent } from './project-modifications.component';
import { AuthStore } from '../../../../core/store/auth.store';
import { AMENDMENT_CONTRACT_CLOSED_NOTE } from '../../../../core/constants/amendment-effect';

// A pending amendment of a CLOSED contract (e.g. closed by a dispute settlement): effect NONE, a clear reason, and every action disabled with that reason.
const REASON = 'أُغلق العقد، ولم يعد التعديل قابلًا للتطبيق';
const AM = (o: Record<string, unknown> = {}) => ({
  id: 'amend-1', projectId: 'project-1', projectTitle: 'مشروع', contractId: 'contract-abcdef123', contractRef: 'CT-ABCDEF', providerId: 'provider-1', providerName: 'نورة',
  requestedByRole: 'PROVIDER', type: 'BUDGET', title: 'زيادة الميزانية', description: null, budgetDelta: 5, durationDeltaDays: null, status: 'PENDING_OTHER_PARTY',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', respondedAt: null, conversationId: 'conv-1',
  effect: 'NONE', effectNote: REASON, actionable: false, actionBlockedReason: REASON, contractStatus: 'COMPLETED',
  needsClientPayment: true, fundingAuthorized: false, contractPrice: 20, contractDurationDays: 14, ...o
});

describe('ProjectModificationsComponent: amendments of a closed contract', () => {
  let fixture: ComponentFixture<ProjectModificationsComponent>;
  let post: ReturnType<typeof vi.fn>;
  const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null;

  async function setup(list: any[]) {
    post = vi.fn(() => of({ success: true, data: {} }));
    await TestBed.configureTestingModule({
      imports: [ProjectModificationsComponent],
      providers: [provideRouter([]), { provide: HttpClient, useValue: { get: vi.fn(() => of({ success: true, data: list })), post } }, { provide: AuthStore, useValue: { currentUser: () => null } }]
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectModificationsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  }
  afterEach(() => TestBed.resetTestingModule());

  it('the shared note equals the server wording', () => { expect(AMENDMENT_CONTRACT_CLOSED_NOTE).toBe(REASON); });

  it('a provider request on a closed contract: approve / reject are disabled with the reason, nothing can be posted', async () => {
    await setup([AM()]);
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(q('am-closed-reason')?.textContent).toContain(REASON);
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button.dp-appr-btn, button.dp-rej-btn')) as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every(b => b.disabled)).toBe(true);
    expect(buttons[0].getAttribute('title')).toBe(REASON);
    expect(text).toContain('العقد مُغلق');
    fixture.componentInstance.askDecision(fixture.componentInstance.amendments()[0] as any, 'approve');
    expect(fixture.componentInstance.pendingDecision()).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('a client request on a closed contract: authorize payment and cancel are disabled with the reason', async () => {
    await setup([AM({ id: 'amend-2', requestedByRole: 'CLIENT' })]);
    expect(q('am-authorize')?.disabled).toBe(true);
    expect(q('am-authorize')?.getAttribute('title')).toBe(REASON);
    expect(q('am-cancel')?.disabled).toBe(true);
    fixture.componentInstance.cancelRequest(fixture.componentInstance.amendments()[0] as any);
    fixture.componentInstance.startAuthorize(fixture.componentInstance.amendments()[0] as any);
    expect(fixture.componentInstance.otpFor()).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('an older API (no `actionable`) never blocks: the actions stay enabled', async () => {
    await setup([AM({ actionable: undefined, actionBlockedReason: undefined, effect: 'PENDING', effectNote: undefined })]);
    expect(q('am-closed-reason')).toBeNull();
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button.dp-appr-btn, button.dp-rej-btn')) as HTMLButtonElement[];
    expect(buttons.some(b => !b.disabled)).toBe(true);
  });
});
