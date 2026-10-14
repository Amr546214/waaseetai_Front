import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { of } from 'rxjs';
import { SaQuality } from './sa-quality';
import { AdminAnalyticsService, AnalyticsOverview } from '../../../../../core/services/admin-analytics.service';
import { AdminAiService } from '../../../../../core/services/admin-ai.service';

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
  const ai = { getSentimentSummary: () => of({ result: null, failed: true }) };
  TestBed.configureTestingModule({ providers: [{ provide: AdminAnalyticsService, useValue: { getOverview } }, { provide: AdminAiService, useValue: ai }] });
  const f = TestBed.createComponent(SaQuality);
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

describe('SaQuality', () => {
  afterEach(() => vi.restoreAllMocks());

  it('period filter refetches with a different window', () => {
    const { f, getOverview } = setup(base());
    const first = (getOverview.mock.calls[0] as any[])[0];
    getOverview.mockClear();
    f.componentInstance.setPeriod('30');
    expect((getOverview.mock.calls[0] as any[])[0].from).not.toBe(first.from);
    f.componentInstance.setPeriod('all');
    expect((getOverview.mock.calls[1] as any[])[0]).toEqual({});
  });

  it('empty data shows honest empty states and no invented figures', () => {
    const { f } = setup(base());
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="sq-trend-empty"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="sq-reviews-empty"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="sq-moderation-note"]')).toBeTruthy();
    expect(el.textContent).not.toContain('92.4%');
    expect((el.querySelector('[data-testid="sq-csv"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('CSV exports the real recent reviews; print is wired', async () => {
    const d = base();
    d.reviews.count = 1; d.reviews.average = 5;
    d.reviews.recent = [{ id: 'r1', rating: 5, comment: 'ممتاز', createdAt: '2026-09-01T00:00:00Z', providerName: 'م', clientName: 'ع' }];
    const { f } = setup(d);
    const box = captureDownload();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    (f.nativeElement.querySelector('[data-testid="sq-csv"]') as HTMLButtonElement).click();
    expect(await readBlob(box.blob!)).toContain('ممتاز');
    (f.nativeElement.querySelector('[data-testid="sq-print"]') as HTMLButtonElement).click();
    expect(print).toHaveBeenCalled();
  });
});
