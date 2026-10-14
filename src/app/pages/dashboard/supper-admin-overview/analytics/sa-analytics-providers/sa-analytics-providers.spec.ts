import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { of } from 'rxjs';
import { SaAnalyticsProviders } from './sa-analytics-providers';
import { AdminAnalyticsService, AnalyticsOverview } from '../../../../../core/services/admin-analytics.service';

const base = (): AnalyticsOverview => ({
  range: { from: null, to: null },
  users: { total: 0, byAccountType: [], newInRange: 0, newByMonth: [] },
  projects: { total: 0, byStatus: [] }, requests: { total: 0, byStatus: [] }, orders: { total: 0, byStatus: [] }, disputes: { total: 0, byStatus: [] }, referrals: { total: 0, byStatus: [] },
  reviews: { count: 0, average: null, negativeCount: 0, distribution: [], byMonth: [], recent: [], lowRated: [] },
  providers: { topRated: [], atRisk: [], totalProviderAccounts: 0 },
  specialties: [],
});

function setup(data: AnalyticsOverview) {
  const getOverview = vi.fn((_r?: any) => of({ data, failed: false }));
  TestBed.configureTestingModule({ providers: [{ provide: AdminAnalyticsService, useValue: { getOverview } }] });
  const f = TestBed.createComponent(SaAnalyticsProviders);
  f.detectChanges();
  return { f, getOverview };
}


function captureDownload() {
  const box: { blob?: Blob; name?: string } = {};
  (URL as any).createObjectURL = vi.fn((b: Blob) => { box.blob = b; return 'blob:x'; });
  (URL as any).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { box.name = this.download; });
  return box;
}

const readBlob = (b: Blob) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsText(b); });

describe('SaAnalyticsProviders', () => {
  afterEach(() => vi.restoreAllMocks());

  it('period change sends a new date window; "all" sends none', () => {
    const { f, getOverview } = setup(base());
    expect(getOverview.mock.calls[0][0]).toHaveProperty('from');
    getOverview.mockClear();
    f.componentInstance.setPeriod('كل الفترات');
    expect(getOverview.mock.calls[0][0]).toEqual({});
  });

  it('shows honest empty state with no providers and disables CSV', () => {
    const { f } = setup(base());
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="sap-empty"]')).toBeTruthy();
    expect((el.querySelector('[data-testid="sap-csv"]') as HTMLButtonElement).disabled).toBe(true);
    expect(el.textContent).not.toContain('شركة الرياض للتصميم');
  });

  it('exports the displayed real provider rows and prints', async () => {
    const d = base();
    d.providers.topRated = [{ providerId: 'p1', name: 'مزود حقيقي', accountType: 'PROVIDER_INDIVIDUAL', averageRating: 4.5, reviewCount: 2, completedProjects: 1 }];
    const { f } = setup(d);
    const box = captureDownload();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    (f.nativeElement.querySelector('[data-testid="sap-csv"]') as HTMLButtonElement).click();
    expect(await readBlob(box.blob!)).toContain('مزود حقيقي');
    (f.nativeElement.querySelector('[data-testid="sap-print"]') as HTMLButtonElement).click();
    expect(print).toHaveBeenCalled();
  });
});
