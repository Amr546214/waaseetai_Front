import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';

import { SaDisputeDetail } from './sa-dispute-detail';
import { SaDisputes } from '../sa-disputes';
import { DisputeApiService } from '../../../../../core/services/dispute-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { AdminOpsApiService } from '../../../../../core/services/admin-ops-api.service';

const dispute: any = {
  id: 'd1', requestId: 'r1', projectId: null, status: 'OPEN', reason: 'سبب', description: 'وصف',
  evidence: ['https://cdn.example.com/a/proof.pdf'], createdAt: '2026-01-01T10:00:00.000Z', resolvedAt: null,
  openedBy: { id: 'u1', firstName: 'علي', lastName: 'أحمد' }, againstUser: { id: 'u2', firstName: 'نور', lastName: 'سعد' },
  request: { id: 'r1', title: 'تصميم شعار' }, assignedTo: { id: 's1', name: 'سارة' },
  escrow: { status: 'HELD', amount: 500, releasedAmount: 100, fundedAt: null }, heldEscrowAmount: 400,
  notes: [{ id: 'n1', body: 'ملاحظة أولى', createdAt: '2026-01-02T10:00:00.000Z', admin: { id: 's1', name: 'سارة' } }],
  timeline: [{ id: 't1', eventType: 'ASSIGN', title: 'إسناد النزاع', summary: 'إلى سارة', occurredAt: '2026-01-02T09:00:00.000Z', admin: { id: 's1', name: 'سارة' } }],
};

function setup(over: any = {}) {
  const ok = () => of({ success: true, data: dispute });
  const api = {
    getAdminDispute: vi.fn(() => of({ success: true, data: { ...dispute, ...over } })),
    assignAdminDispute: vi.fn(ok), addAdminDisputeNote: vi.fn(ok), setAdminDisputeStatus: vi.fn(ok), resolveAdminDispute: vi.fn(ok),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DisputeApiService, useValue: api },
      { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [{ id: 's2', name: 'خالد', email: 'k@x', accountType: 'ADMIN' }] }) } },
      { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 'd1' })), snapshot: { paramMap: convertToParamMap({ id: 'd1' }) } } },
    ],
  });
  const f = TestBed.createComponent(SaDisputeDetail);
  f.detectChanges();
  return { f, c: f.componentInstance, api, el: f.nativeElement as HTMLElement };
}

describe('SaDisputeDetail — staff operations', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('assign calls the API with the chosen staff id and reloads', () => {
    const { c, api } = setup();
    c.selectedAssigneeId.set('s2');
    c.assign();
    expect(api.assignAdminDispute).toHaveBeenCalledWith('d1', 's2');
    expect(api.getAdminDispute).toHaveBeenCalledTimes(2);
    expect(TestBed.inject(UiNotificationService).toasts().map(t => ({ kind: t.kind, message: t.message }))).toContainEqual({ kind: 'success', message: 'تم إسناد النزاع' });
  });

  it('adds an internal note and shows the labelled notes list', () => {
    const { c, f, api, el } = setup();
    expect(el.textContent).toContain('ملاحظات داخلية — لا تظهر للطرفين');
    expect(el.textContent).toContain('ملاحظة أولى');
    c.noteDraft.set(' ملاحظة ثانية ');
    c.addNote();
    expect(api.addAdminDisputeNote).toHaveBeenCalledWith('d1', 'ملاحظة ثانية');
    expect(c.noteDraft()).toBe('');
    f.detectChanges();
  });

  it('status button calls PATCH; hidden for closed disputes', () => {
    const { c, api, el } = setup();
    c.setStatus('UNDER_REVIEW');
    expect(api.setAdminDisputeStatus).toHaveBeenCalledWith('d1', 'UNDER_REVIEW');
    expect(el.textContent).toContain('بدء المراجعة');
    TestBed.resetTestingModule();
    const closed = setup({ status: 'RESOLVED' });
    expect(closed.el.textContent).not.toContain('بدء المراجعة');
    expect(closed.el.textContent).not.toContain('إعادة للمفتوح');
  });

  it('resolve needs the confirmation step before calling the API', () => {
    const { c, f, api } = setup();
    c.openResolveForm('resolve');
    c.resolutionText.set('MUTUAL_CLOSE');
    c.submitResolve();
    expect(api.resolveAdminDispute).not.toHaveBeenCalled();
    c.requestResolveConfirm();
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('هذا القرار يُسجَّل ويُبلَّغ به الطرفان ولا ينفّذ أي تحويل مالي تلقائياً');
    c.submitResolve();
    expect(api.resolveAdminDispute).toHaveBeenCalledWith('d1', { action: 'resolve', resolution: 'MUTUAL_CLOSE' });
    expect(api.getAdminDispute).toHaveBeenCalledTimes(2);
  });

  it('renders the API timeline, real escrow, evidence link and disabled escalation reason', () => {
    const { el } = setup();
    expect(el.textContent).toContain('إسناد النزاع');
    expect(el.textContent).not.toContain('غير مؤرَّخ');
    expect(el.textContent).toContain('محتجز');
    expect(el.textContent).toContain('500.00');
    expect(el.textContent).toContain('تصميم شعار');
    expect((el.querySelector('a.dp-ev-link') as HTMLAnchorElement).textContent).toContain('proof.pdf');
    expect(el.textContent).toContain('يحتاج قرار منتج/جدول بيانات غير متوفر');
  });
});

describe('SaDisputes list', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('uses pagination.totalPages, counts and shows parties/assignee/title', () => {
    const api = { getAdminDisputes: vi.fn(() => of({ success: true, data: { items: [dispute], counts: { OPEN: 3, RESOLVED: 2 }, pagination: { page: 1, limit: 10, total: 25, pages: 3, totalPages: 3 } } })) };
    TestBed.configureTestingModule({ imports: [SaDisputes], providers: [provideRouter([]), { provide: DisputeApiService, useValue: api }] });
    const f = TestBed.createComponent(SaDisputes);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('صفحة 1 من 3');
    expect(el.textContent).toContain('تصميم شعار');
    expect(el.textContent).toContain('علي أحمد');
    expect(el.textContent).toContain('سارة');
    expect(f.componentInstance.countFor('all')).toBe(5);
    expect(f.componentInstance.countFor('OPEN')).toBe(3);
    f.componentInstance.nextPage();
    expect(api.getAdminDisputes).toHaveBeenLastCalledWith({ status: undefined, page: 2, limit: 10 });
  });
});
