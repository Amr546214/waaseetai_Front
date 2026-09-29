import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SaBrokerDetail } from './sa-broker-detail';
import { AdminBrokerDetail } from '../../../../../core/models/admin-broker.model';

// Routed brokers/:id page (formerly the in-list broker modal). Proves the
// page loads the real GET /admin/brokers/:id record and shows an honest
// error instead of fabricated commission data on failure.

function makeBrokerDetail(overrides: Partial<AdminBrokerDetail> = {}): AdminBrokerDetail {
  return {
    id: 'broker-1',
    name: 'سارة القحطاني',
    email: 's.qahtani@email.com',
    referralSlug: 'sara-q',
    level: 'مساعد',
    status: 'ACTIVE',
    joinedAt: '2026-01-01T09:00:00.000Z',
    totalReferrals: 42,
    convertedReferrals: 17,
    conversionRate: 40.5,
    paidCommission: 3200,
    pendingCommission: 450,
    channelCount: 2,
    channels: [{ platform: 'Instagram', handle: '@sara-q', url: 'https://instagram.com/sara-q' }],
    channelMetrics: [{ channel: 'Instagram', visitors: 900, clients: 17, conversionPercentage: 1.9 }],
    customLinks: [{ channelName: 'Instagram', utmSource: 'ig', customSlug: 'sara-promo', createdAt: '2026-01-05T00:00:00.000Z' }],
    recentCommissions: [
      { type: 'REFERRAL', amount: 200, currency: 'SAR', status: 'PAID', createdAt: '2026-01-10T00:00:00.000Z', referredUserName: 'خالد المطيري' },
    ],
    ...overrides,
  };
}

describe('SaBrokerDetail', () => {
  let component: SaBrokerDetail;
  let harness: RouterTestingHarness;
  let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

  async function setup(getImpl: (...args: any[]) => any) {
    getSpy = vi.fn(getImpl);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'brokers/:id', component: SaBrokerDetail }]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } },
      ],
    });
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl('/brokers/broker-1', SaBrokerDetail);
    harness.detectChanges();
  }

  it('loads a real broker detail from GET /admin/brokers/:id with real channel/commission data', async () => {
    await setup(() => of({ success: true, data: makeBrokerDetail() }));
    expect(getSpy.mock.calls[0][0]).toContain('/admin/brokers/broker-1');
    expect(component.selected()?.recentCommissions?.[0]?.referredUserName).toBe('خالد المطيري');
    expect(harness.routeNativeElement?.textContent).toContain('خالد المطيري');
  });

  it('shows an honest detail error state on failure instead of fabricated commission data', async () => {
    await setup(() => throwError(() => ({ error: { message: 'تعذر تحميل تفاصيل الوسيط' } })));
    expect(component.error()).toBe('تعذر تحميل تفاصيل الوسيط');
    expect(component.selected()).toBeNull();
  });

  it('shows a not-found state on 404', async () => {
    await setup(() => throwError(() => ({ status: 404 })));
    expect(component.notFound()).toBe(true);
  });
});
