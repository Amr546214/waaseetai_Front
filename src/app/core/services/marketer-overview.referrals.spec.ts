import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MarketerOverviewService, toReferralListData } from './marketer-overview.service';

// The REAL backend shape (marketer-overview.controller.getReferrals): data = array, pagination alongside it.
const BACKEND = {
  success: true,
  data: [
    { referralId: 'r1', displayName: 'Ali Test', status: 'PENDING', joinedAt: '2026-10-05T10:00:00.000Z', totalCommissionEarned: 0 },
    { referralId: 'r2', displayName: 'Sara Test', status: 'CONVERTED', joinedAt: '2026-10-04T10:00:00.000Z', totalCommissionEarned: 120 },
    { referralId: 'r3', displayName: 'Omar Test', status: 'QUALIFIED', joinedAt: '2026-10-03T10:00:00.000Z', totalCommissionEarned: 0 },
  ],
  pagination: { page: 1, limit: 10, total: 3, totalPages: 1 },
};

describe('marketer referrals: backend response -> list data', () => {
  it('maps the real backend shape and keeps PENDING / QUALIFIED / CONVERTED rows', () => {
    const data = toReferralListData(BACKEND, 1, 10);
    expect(data.total).toBe(3);
    expect(data.page).toBe(1);
    expect(data.items.map(i => i.status)).toEqual(['PENDING', 'CONVERTED', 'QUALIFIED']);
    expect(data.items[0]).toEqual({ referralId: 'r1', referredUserDisplayName: 'Ali Test', status: 'PENDING', joinedAt: '2026-10-05T10:00:00.000Z', commissionEarned: 0 });
    expect(data.items[1].commissionEarned).toBe(120);
  });

  it('a single PENDING referral (the reported case) is listed with total 1', () => {
    const data = toReferralListData({ success: true, data: [BACKEND.data[0]], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }, 1, 10);
    expect(data.items.length).toBe(1);
    expect(data.items[0].status).toBe('PENDING');
    expect(data.items[0].referredUserDisplayName).toBe('Ali Test');
    expect(data.total).toBe(1);
  });

  it('an empty list stays empty (total 0)', () => {
    const data = toReferralListData({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } }, 1, 10);
    expect(data.items).toEqual([]);
    expect(data.total).toBe(0);
  });

  it('still understands the older { items, page, limit, total } shape', () => {
    const data = toReferralListData({ success: true, data: { items: [{ referredUserDisplayName: 'Old Shape', status: 'PENDING', joinedAt: 'x', commissionEarned: null }], page: 2, limit: 5, total: 11 } }, 2, 5);
    expect(data.items[0].referredUserDisplayName).toBe('Old Shape');
    expect(data.total).toBe(11);
    expect(data.page).toBe(2);
  });

  it('getReferrals() requests page/limit and returns the mapped data', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(MarketerOverviewService);
    const http = TestBed.inject(HttpTestingController);
    let got: any;
    service.getReferrals(1, 10).subscribe(r => (got = r));
    const req = http.expectOne(r => r.url.endsWith('/marketer-overview/referrals') && r.params.keys().length === 0 ? true : r.url.includes('/referrals?page=1&limit=10'));
    req.flush(BACKEND);
    expect(got.success).toBe(true);
    expect(got.data.items.length).toBe(3);
    expect(got.data.items[0].referredUserDisplayName).toBe('Ali Test');
    expect(got.data.total).toBe(3);
    http.verify();
  });
});
