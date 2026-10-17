import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SaProjects } from './sa-projects';
import { SaProjectDetail } from './sa-project-detail/sa-project-detail';
import { AdminOpsApiService, AdminProjectDetail, AdminProjectListData } from '../../../../core/services/admin-ops-api.service';

const party = (id: string, name: string) => ({ id, name, email: `${id}@x.test` });

function listData(overrides: Partial<AdminProjectListData> = {}): AdminProjectListData {
  return {
    items: [
      {
        id: 'p-1234567890', title: 'مشروع حقيقي أول', status: 'IN_PROGRESS', createdAt: '2026-01-01T00:00:00Z', deliveryDays: 14,
        client: party('c1', 'ليلى حسن'), provider: party('v1', 'عمر ياسين'),
        contract: { id: 'ct-1', price: 1200, status: 'ACTIVE' },
        escrow: { status: 'HELD', amount: 1200, releasedAmount: 0, heldAmount: 1200, fundedAt: null, platformCommissionAmount: 0, providerNetReleasedAmount: 0, feePolicyVersion: 2 },
        progress: { totalStages: 2, approvedStages: 1, percent: 50 },
      },
    ],
    counts: { IN_PROGRESS: 7, COMPLETED: 3, DISPUTED: 2, OPEN: 1 },
    kpis: { escrowHeldCount: 4, escrowHeldTotal: 8800, currency: 'USD' },
    pagination: { page: 1, limit: 20, total: 13, pages: 1, totalPages: 1 },
    ...overrides,
  };
}

function detailData(overrides: Partial<AdminProjectDetail> = {}): AdminProjectDetail {
  return {
    id: 'p-1', title: 'تفاصيل حقيقية', description: 'وصف', status: 'IN_PROGRESS', createdAt: '2026-01-01T00:00:00Z', deliveryDays: 10, specialty: 'تصميم',
    client: party('c1', 'ليلى حسن'), provider: party('v1', 'عمر ياسين'),
    contract: { id: 'ct-1', price: 500, status: 'ACTIVE', durationDays: 10, signedAt: null, clientSignedAt: '2026-01-02T00:00:00Z', providerSignedAt: null },
    escrow: { status: 'HELD', amount: 500, releasedAmount: 100, heldAmount: 400, fundedAt: null, platformCommissionAmount: 12, providerNetReleasedAmount: 88, feePolicyVersion: 2 },
    stages: [{
      id: 's1', stepOrder: 1, title: 'مرحلة التحليل', amount: 100, percentage: 20, days: 3, status: 'APPROVED', startedAt: null, approvedAt: '2026-01-05T00:00:00Z',
      deliveries: [{ id: 'd1', status: 'APPROVED', note: 'ملاحظة التسليم', files: ['https://cdn.test/a.pdf'], reviewNote: null, submittedAt: '2026-01-04T00:00:00Z', reviewedAt: null }],
    }],
    amendments: [], progress: { totalStages: 1, approvedStages: 1, percent: 100 },
    disputes: [{ id: 'dsp-1', status: 'OPEN', reason: 'سبب النزاع', createdAt: '2026-01-06T00:00:00Z', resolvedAt: null }],
    openDisputes: 1, currency: 'USD',
    ...overrides,
  };
}

describe('SaProjects (real data)', () => {
  let api: { listProjects: ReturnType<typeof vi.fn>; getProject: ReturnType<typeof vi.fn> };

  async function setup(listImpl: () => any, getImpl: () => any = () => of({ success: true, data: detailData() })) {
    api = { listProjects: vi.fn(listImpl), getProject: vi.fn(getImpl) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'projects', component: SaProjects },
          { path: 'projects/:id', component: SaProjectDetail },
        ]),
        { provide: AdminOpsApiService, useValue: api },
      ],
    });
    return RouterTestingHarness.create();
  }

  it('renders API rows and counts from the API', async () => {
    const harness = await setup(() => of({ success: true, data: listData() }));
    await harness.navigateByUrl('/projects', SaProjects);
    harness.detectChanges();
    const text: string = harness.routeNativeElement!.textContent ?? '';
    expect(text).toContain('مشروع حقيقي أول');
    expect(text).toContain('ليلى حسن');
    expect(text).toContain('8,800');
    const kpis = Array.from(harness.routeNativeElement!.querySelectorAll('.pj-kpi-val')).map((e) => e.textContent!.trim());
    expect(kpis[0]).toBe('7');
    expect(kpis[1]).toBe('3');
    expect(kpis[2]).toBe('2');
    expect(api.listProjects).toHaveBeenCalledWith({ status: undefined, q: undefined, page: 1, limit: 20 });
  });

  it('sends the status filter to the server', async () => {
    const harness = await setup(() => of({ success: true, data: listData() }));
    const cmp = await harness.navigateByUrl('/projects', SaProjects);
    cmp.setFilter('COMPLETED');
    expect(api.listProjects).toHaveBeenLastCalledWith({ status: 'COMPLETED', q: undefined, page: 1, limit: 20 });
    expect(cmp.count('IN_PROGRESS')).toBe(7);
  });

  it('shows the empty state', async () => {
    const harness = await setup(() => of({ success: true, data: listData({ items: [], counts: {} }) }));
    await harness.navigateByUrl('/projects', SaProjects);
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('لا توجد مشاريع مطابقة');
  });

  it('shows an error and retries', async () => {
    let fail = true;
    const harness = await setup(() => (fail ? throwError(() => ({ status: 500 })) : of({ success: true, data: listData() })));
    const cmp = await harness.navigateByUrl('/projects', SaProjects);
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('تعذّر تحميل المشاريع');
    fail = false;
    cmp.load();
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('مشروع حقيقي أول');
  });

  it('detail renders real stages, escrow and the disabled finance control without calling any API', async () => {
    const harness = await setup(() => of({ success: true, data: listData() }));
    await harness.navigateByUrl('/projects/p-1', SaProjectDetail);
    harness.detectChanges();
    const el: HTMLElement = harness.routeNativeElement!;
    expect(api.getProject).toHaveBeenCalledWith('p-1');
    expect(el.textContent).toContain('مرحلة التحليل');
    expect(el.textContent).toContain('ملاحظة التسليم');
    expect(el.textContent).toContain('عمولة المنصة');
    expect(el.querySelector('a[href="/disputes/dsp-1"], a[href$="/disputes/dsp-1"]')).toBeTruthy();
    const btn = el.querySelector('.pj-md-actions button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(el.querySelector('[data-testid="finance-disabled-reason"]')!.textContent).toContain('غير مفعّل');
    api.listProjects.mockClear(); api.getProject.mockClear();
    btn.click();
    expect(api.listProjects).not.toHaveBeenCalled();
    expect(api.getProject).not.toHaveBeenCalled();
  });

  it('detail hides fee rows unless feePolicyVersion is 2', async () => {
    const d = detailData();
    d.escrow!.feePolicyVersion = 1;
    const harness = await setup(() => of({ success: true, data: listData() }), () => of({ success: true, data: d }));
    await harness.navigateByUrl('/projects/p-1', SaProjectDetail);
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).not.toContain('عمولة المنصة');
  });

  it('detail shows not-found on 404 and error with retry otherwise', async () => {
    let status = 404;
    const harness = await setup(() => of({ success: true, data: listData() }), () => throwError(() => ({ status })));
    const cmp = await harness.navigateByUrl('/projects/zzz', SaProjectDetail);
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('لم يتم العثور على المشروع');
    status = 500;
    cmp.load();
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('إعادة المحاولة');
  });

  it('a project closed by a dispute settlement shows «أُغلق بتسوية نزاع» (list and detail, stages «أُغلقت بالتسوية»), never «مكتمل»', async () => {
    const row = { ...listData().items[0], status: 'COMPLETED', statusLabel: 'أُغلق بتسوية نزاع', adminSettled: { disputeId: 'd1', outcome: 'SPLIT', label: 'أُغلق بتسوية نزاع' } };
    const harness = await setup(() => of({ success: true, data: listData({ items: [row as any] }) }),
      () => of({ success: true, data: detailData({ status: 'COMPLETED', statusLabel: 'أُغلق بتسوية نزاع', adminSettled: { disputeId: 'd1', outcome: 'SPLIT', label: 'أُغلق بتسوية نزاع' },
        stages: [{ id: 's1', stepOrder: 1, title: 'مرحلة', amount: 100, percentage: 100, days: 3, status: 'SUBMITTED', displayStatus: 'CLOSED_BY_SETTLEMENT', displayStatusLabel: 'أُغلقت بالتسوية', startedAt: null, approvedAt: null, deliveries: [] }] }) }));
    await harness.navigateByUrl('/projects', SaProjects);
    harness.detectChanges();
    const badge = harness.routeNativeElement!.querySelector('.pj-status')!.textContent!.trim();
    expect(badge).toBe('أُغلق بتسوية نزاع');
    await harness.navigateByUrl('/projects/p-1', SaProjectDetail);
    harness.detectChanges();
    const text: string = harness.routeNativeElement!.textContent ?? '';
    expect(text).toContain('أُغلق بتسوية نزاع');
    expect(text).toContain('أُغلقت بالتسوية');
  });
});
