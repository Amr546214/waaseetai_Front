import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of } from 'rxjs';
import { SaAnalyticsHub } from './sa-analytics-hub';
import { expectFieldProblem, expectFocused, settleForm } from '../../../../shared/forms/form-spec-utils';
import { AdminAnalyticsService, AnalyticsOverview } from '../../../../core/services/admin-analytics.service';

const overview = (users = 5): AnalyticsOverview => ({
  range: { from: null, to: null },
  users: { total: users, byAccountType: [{ accountType: 'CLIENT_INDIVIDUAL', count: users, newInRange: 2 }], newInRange: 2, newByMonth: [{ month: '2026-09', count: 2 }] },
  projects: { total: 3, byStatus: [{ status: 'OPEN', count: 3 }] },
  requests: { total: 0, byStatus: [] }, orders: { total: 0, byStatus: [] }, disputes: { total: 0, byStatus: [] }, referrals: { total: 0, byStatus: [] },
  reviews: { count: 0, average: null, negativeCount: 0, distribution: [], byMonth: [], recent: [], lowRated: [] },
  providers: { topRated: [], atRisk: [], totalProviderAccounts: 0 },
  specialties: [],
});


function captureDownload() {
  const box: { blob?: Blob; name?: string } = {};
  (URL as any).createObjectURL = vi.fn((b: Blob) => { box.blob = b; return 'blob:x'; });
  (URL as any).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { box.name = this.download; });
  return box;
}

const readBlob = (b: Blob) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsText(b); });

describe('SaAnalyticsHub', () => {
  let getOverview: any;
  beforeEach(() => {
    getOverview = vi.fn((_r?: any) => of({ data: overview(), failed: false }));
    TestBed.configureTestingModule({ providers: [{ provide: AdminAnalyticsService, useValue: { getOverview } }] });
  });
  afterEach(() => vi.restoreAllMocks());

  const make = () => {
    const f = TestBed.createComponent(SaAnalyticsHub);
    f.detectChanges();
    return f;
  };

  it('requests real data with from/to and refetches when the period changes', () => {
    const f = make();
    const first = getOverview.mock.calls[0][0];
    expect(first.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    getOverview.mockClear();
    f.componentInstance.setPeriod('7d');
    expect(getOverview.mock.calls[0][0].from).not.toBe(first.from);
  });

  it('custom range is sent as query params', () => {
    const f = make();
    getOverview.mockClear();
    f.componentInstance.setCustomRange('2026-01-01', '2026-01-31');
    expect(getOverview.mock.calls[0][0]).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('an inverted custom range is explained under the end date (focus there) and nothing is requested', async () => {
    const f = make();
    getOverview.mockClear();
    f.componentInstance.setCustomRange('2026-02-01', '2026-01-01');
    await settleForm();
    const to = (f.nativeElement as HTMLElement).querySelector('#ah-to');
    expectFieldProblem(to, 'تاريخ النهاية');
    expectFocused(to);
    expect(getOverview).not.toHaveBeenCalled();
  });

  it('CSV export uses the displayed real data of the active section', async () => {
    const f = make();
    const box = captureDownload();
    f.componentInstance.setSection('users');
    f.componentInstance.exportCsv();
    const text = await readBlob(box.blob!);
    expect(text).toContain('نوع الحساب');
    expect(text).toContain('طالب خدمة (فرد),5,2');
    expect(box.name).toMatch(/^analytics-users-.*\.csv$/);
  });

  it('print button calls window.print', () => {
    const f = make();
    const spy = vi.spyOn(window, 'print').mockImplementation(() => {});
    (f.nativeElement.querySelector('[data-testid="ah-print"]') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalled();
  });

  it('shows honest unavailable notices instead of invented numbers', () => {
    const f = make();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('غير متاح');
    expect(text).not.toContain('16.2M');
  });

  it('shows an error state (no fallback numbers) when the request fails', () => {
    getOverview.mockReturnValue(of({ data: null, failed: true }));
    const f = make();
    expect(f.nativeElement.querySelector('[data-testid="ah-error"]')).toBeTruthy();
  });
});
