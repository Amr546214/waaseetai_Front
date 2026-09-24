import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';

import { ProjectModificationsComponent } from './project-modifications.component';
import { AuthStore } from '../../../../core/store/auth.store';

// Shape matches ProjectAmendmentService#listAmendments's real return value
// exactly (waseetai-backend/src/services/project-amendment.service.ts) —
// no field here is invented beyond what the real backend already sends.
function amendmentFixture(overrides: Partial<any> = {}) {
  return {
    id: 'amend-1',
    projectId: 'project-1',
    projectTitle: 'تطوير منصة إدارة مشاريع وخدمات رقمية',
    contractId: 'contract-abcdef123',
    contractRef: 'CT-ABCDEF',
    providerId: 'provider-1',
    providerName: 'نورة السالم',
    requestedByRole: 'PROVIDER',
    type: 'DURATION',
    title: 'تمديد مدة التسليم',
    description: 'بسبب توسيع نطاق ربط بوابات الدفع',
    budgetDelta: null,
    durationDeltaDays: 7,
    status: 'PENDING_OTHER_PARTY',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    respondedAt: null,
    conversationId: 'conv-1',
    ...overrides
  };
}

describe('ProjectModificationsComponent', () => {
  let component: ProjectModificationsComponent;
  let fixture: ComponentFixture<ProjectModificationsComponent>;
  let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let router: Router;
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  async function setup(getImpl: () => any, postImpl: () => any = () => of({ success: true, data: {} })) {
    getSpy = vi.fn(getImpl);
    postSpy = vi.fn(postImpl);
    await TestBed.configureTestingModule({
      imports: [ProjectModificationsComponent],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), post: (...args: any[]) => postSpy(...args) } },
        { provide: AuthStore, useValue: { currentUser: () => null } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectModificationsComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('calls the real amendments endpoint directly on init (works on a direct/refreshed URL, no external state needed)', async () => {
    await setup(() => of({ success: true, data: [] }));
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(getSpy.mock.calls[0][0]).toContain('/client/projects/amendments');
  });

  it('shows a loading state before the response arrives', async () => {
    const subject = new Subject<any>();
    await setup(() => subject.asObservable());
    expect(component.isLoading()).toBe(true);
    expect(fixture.nativeElement.querySelector('.state-card:not(.error-state):not(.empty-state)')).toBeTruthy();
    subject.next({ success: true, data: [] });
    subject.complete();
    await fixture.whenStable();
  });

  it('shows a polished empty state for zero real amendments — never fake cards', async () => {
    await setup(() => of({ success: true, data: [] }));
    expect(component.amendments().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('لا توجد طلبات تعديل حالياً');
    expect(fixture.nativeElement.querySelector('.dp-card')).toBeNull();
  });

  it('shows an error state with retry on API failure', async () => {
    await setup(() => throwError(() => new Error('network down')));
    expect(component.hasError()).toBe(true);
    expect(fixture.nativeElement.querySelector('.retry-btn')).toBeTruthy();
  });

  it('retry re-fetches and recovers from an error', async () => {
    let call = 0;
    await setup(() => {
      call++;
      return call === 1 ? throwError(() => new Error('network down')) : of({ success: true, data: [amendmentFixture()] });
    });
    expect(component.hasError()).toBe(true);

    (fixture.nativeElement.querySelector('.retry-btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.hasError()).toBe(false);
    expect(component.amendments().length).toBe(1);
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('renders the real list using only real response fields', async () => {
    await setup(() => of({ success: true, data: [amendmentFixture()] }));
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('تطوير منصة إدارة مشاريع وخدمات رقمية');
    expect(text).toContain('نورة السالم');
    expect(text).toContain('CT-ABCDEF');
    expect(text).toContain('تمديد مدة التسليم');
  });

  it('counters are derived from the real returned list, not hardcoded', async () => {
    await setup(() => of({
      success: true,
      data: [
        amendmentFixture({ id: 'a1', requestedByRole: 'PROVIDER', status: 'PENDING_OTHER_PARTY' }),
        amendmentFixture({ id: 'a2', requestedByRole: 'CLIENT', status: 'PENDING_OTHER_PARTY' }),
        amendmentFixture({ id: 'a3', requestedByRole: 'CLIENT', status: 'APPROVED' })
      ]
    }));

    expect(component.tabs()).toEqual([
      { id: 'all', label: 'الكل', count: 3 },
      { id: 'open', label: 'نشطة', count: 2 },
      { id: 'closed', label: 'مُعتمدة', count: 1 }
    ]);
    const stats = component.stats();
    expect(stats.find(s => s.label === 'بانتظار رد المقدّم')?.value).toBe('1');
    expect(stats.find(s => s.label === 'بانتظار موافقتك')?.value).toBe('1');
    expect(stats.find(s => s.label === 'مُعتمدة')?.value).toBe('1');
  });

  it('filters use real status values only', async () => {
    await setup(() => of({
      success: true,
      data: [
        amendmentFixture({ id: 'a1', status: 'PENDING_OTHER_PARTY' }),
        amendmentFixture({ id: 'a2', status: 'APPROVED' })
      ]
    }));

    component.setFilter('open');
    fixture.detectChanges();
    expect(component.filteredAmendments().map(a => a.id)).toEqual(['a1']);

    component.setFilter('closed');
    fixture.detectChanges();
    expect(component.filteredAmendments().map(a => a.id)).toEqual(['a2']);
  });

  it('formats a positive budget delta as +N ريال, from the real numeric field', async () => {
    await setup(() => of({ success: true, data: [] }));
    expect(component.formatBudgetDelta(1500)).toBe('+1,500 ريال');
  });

  it('formats a negative budget delta as -N ريال', async () => {
    await setup(() => of({ success: true, data: [] }));
    expect(component.formatBudgetDelta(-500)).toBe('-500 ريال');
  });

  it('formats a null/zero budget delta as "بلا تغيير"', async () => {
    await setup(() => of({ success: true, data: [] }));
    expect(component.formatBudgetDelta(null)).toBe('بلا تغيير');
    expect(component.formatBudgetDelta(0)).toBe('بلا تغيير');
  });

  it('formats a positive duration delta as +N أيام, from the real numeric field', async () => {
    await setup(() => of({ success: true, data: [] }));
    expect(component.formatDurationDelta(5)).toBe('+5 أيام');
  });

  it('formats a negative duration delta as -N أيام', async () => {
    await setup(() => of({ success: true, data: [] }));
    expect(component.formatDurationDelta(-2)).toBe('-2 أيام');
  });

  it('builds a real workflow timeline from status + requestedByRole, with no AI evaluation step', async () => {
    await setup(() => of({ success: true, data: [] }));
    const providerRaised = amendmentFixture({ requestedByRole: 'PROVIDER', status: 'PENDING_OTHER_PARTY' }) as any;
    const steps = component.timelineSteps(providerRaised);
    expect(steps.map(s => s.label)).toEqual(['رفع المقدّم', 'بانتظار موافقتك', 'القرار النهائي']);
    expect(steps.some(s => s.label.includes('الذكاء'))).toBe(false);

    const clientRaised = amendmentFixture({ requestedByRole: 'CLIENT', status: 'APPROVED' }) as any;
    const decidedSteps = component.timelineSteps(clientRaised);
    expect(decidedSteps.map(s => s.label)).toEqual(['رفع الطلب', 'بانتظار رد المقدّم', 'معتمد']);
  });

  it('never renders a fake AI accuracy badge or percentage', async () => {
    await setup(() => of({ success: true, data: [amendmentFixture()] }));
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('دقة');
    expect(text).not.toMatch(/\d+\s*%/);
  });

  it('never renders a fake AI recommendation sentence', async () => {
    await setup(() => of({ success: true, data: [amendmentFixture()] }));
    expect(fixture.nativeElement.textContent).not.toContain('معقولة وسعرها ضمن سوق');
  });

  it('never renders the old hardcoded mock amendment cards', async () => {
    await setup(() => of({ success: true, data: [amendmentFixture()] }));
    const text = fixture.nativeElement.textContent as string;
    for (const fakeRef of ['CR-2026-021', 'CR-2026-018', 'CR-2026-012', 'CR-2026-005']) {
      expect(text).not.toContain(fakeRef);
    }
  });

  it('"متابعة النقاش" navigates to Messages with the exact real conversationId and a PROJECT context', async () => {
    await setup(() => of({ success: true, data: [amendmentFixture()] }));
    (fixture.nativeElement.querySelector('.dp-cta') as HTMLElement).click();
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/client-overview/messages'],
      expect.objectContaining({
        queryParams: { conversationId: 'conv-1' },
        state: { messageContext: { type: 'PROJECT', projectId: 'project-1', projectTitle: 'تطوير منصة إدارة مشاريع وخدمات رقمية' } }
      })
    );
  });

  it('a missing conversationId never opens an unrelated chat — shows an honest inline notice instead', async () => {
    await setup(() => of({ success: true, data: [amendmentFixture({ conversationId: null })] }));
    (fixture.nativeElement.querySelector('.dp-cta') as HTMLElement).click();
    fixture.detectChanges();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('لا توجد محادثة مرتبطة بهذا المشروع بعد');
  });

  it('a provider-created pending amendment shows موافقة/رفض actions', async () => {
    await setup(() => of({ success: true, data: [amendmentFixture({ requestedByRole: 'PROVIDER', status: 'PENDING_OTHER_PARTY' })] }));
    expect(fixture.nativeElement.querySelector('.dp-appr-btn')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.dp-rej-btn')).toBeTruthy();
  });

  it('a client-created pending amendment does NOT show approve/reject actions', async () => {
    await setup(() => of({ success: true, data: [amendmentFixture({ requestedByRole: 'CLIENT', status: 'PENDING_OTHER_PARTY' })] }));
    expect(fixture.nativeElement.querySelector('.dp-appr-btn')).toBeNull();
    expect(fixture.nativeElement.querySelector('.dp-rej-btn')).toBeNull();
  });

  it('an already-decided amendment does NOT show approve/reject actions regardless of role', async () => {
    await setup(() => of({ success: true, data: [amendmentFixture({ requestedByRole: 'PROVIDER', status: 'APPROVED' })] }));
    expect(fixture.nativeElement.querySelector('.dp-appr-btn')).toBeNull();
  });

  it('approve calls the real respond endpoint exactly once and reloads real data on success', async () => {
    let call = 0;
    await setup(
      () => {
        call++;
        return call === 1
          ? of({ success: true, data: [amendmentFixture({ requestedByRole: 'PROVIDER', status: 'PENDING_OTHER_PARTY' })] })
          : of({ success: true, data: [amendmentFixture({ requestedByRole: 'PROVIDER', status: 'APPROVED' })] });
      },
      () => of({ success: true, data: {} })
    );

    (fixture.nativeElement.querySelector('.dp-appr-btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0][0]).toContain('/client/projects/amendments/amend-1/respond');
    expect(postSpy.mock.calls[0][1]).toEqual({ decision: 'approve' });
    expect(getSpy).toHaveBeenCalledTimes(2); // initial load + reload after success
    expect(component.amendments()[0].status).toBe('APPROVED');
  });

  it('disables the approve/reject buttons while saving, preventing a second concurrent call', async () => {
    const subject = new Subject<any>();
    await setup(
      () => of({ success: true, data: [amendmentFixture({ requestedByRole: 'PROVIDER', status: 'PENDING_OTHER_PARTY' })] }),
      () => subject.asObservable()
    );

    const apprBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.dp-appr-btn');
    apprBtn.click();
    fixture.detectChanges();
    expect(apprBtn.disabled).toBe(true);

    component.respond(component.amendments()[0], 'approve');
    expect(postSpy).toHaveBeenCalledTimes(1);

    subject.next({ success: true, data: {} });
    subject.complete();
    await fixture.whenStable();
  });

  it('an approve failure shows an error and does NOT fake a status change', async () => {
    await setup(
      () => of({ success: true, data: [amendmentFixture({ requestedByRole: 'PROVIDER', status: 'PENDING_OTHER_PARTY' })] }),
      () => throwError(() => ({ error: { message: 'تعذر حفظ القرار' } }))
    );

    (fixture.nativeElement.querySelector('.dp-appr-btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('تعذر حفظ القرار');
    expect(component.amendments()[0].status).toBe('PENDING_OTHER_PARTY');
    expect(getSpy).toHaveBeenCalledTimes(1); // no reload attempted after a failure
  });
});
