import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

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
    levelNumber: 1,
    commissionPercent: 12.75,
    monthlyCommissions: [{ month: '2026-01', approved: 200, pending: 0 }],
    recentCommissions: [
      { type: 'REFERRAL', amount: 200, currency: 'USD', status: 'PAID', createdAt: '2026-01-10T00:00:00.000Z', referredUserName: 'خالد المطيري' },
    ],
    ...overrides,
  };
}

describe('SaBrokerDetail', () => {
  let component: SaBrokerDetail;
  let harness: RouterTestingHarness;
  let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let patchSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

  async function setup(getImpl: (...args: any[]) => any) {
    getSpy = vi.fn(getImpl);
    patchSpy = vi.fn(() => of({ success: true, data: { id: 'broker-1', status: 'SUSPENDED' } }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'brokers/:id', component: SaBrokerDetail }]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), patch: (...args: any[]) => patchSpy(...args) } },
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

  it('shows the broker real level/rate and no invented tiers, payments or average comparison', async () => {
    await setup(() => of({ success: true, data: makeBrokerDetail() }));
    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('12.75%');
    expect(text).not.toContain('متوسط الوسطاء');
    expect(text).not.toContain('ممتاز');
    expect(text).not.toContain('إرسال للسحب يدوياً');
  });

  it('suspending needs a reason, then PATCHes /admin/brokers/:id/status and updates the badge', async () => {
    await setup(() => of({ success: true, data: makeBrokerDetail() }));
    component.openStatusDialog('SUSPENDED');
    component.confirmStatusChange();
    expect(patchSpy).not.toHaveBeenCalled();
    component.statusReason.set('نشاط مخالف للسياسة');
    component.confirmStatusChange();
    expect(patchSpy.mock.calls[0][0]).toContain('/admin/brokers/broker-1/status');
    expect(patchSpy.mock.calls[0][1]).toEqual({ status: 'SUSPENDED', reason: 'نشاط مخالف للسياسة' });
    expect(component.selected()?.status).toBe('SUSPENDED');
  });

  it('suspend without / with a too-short reason: message under the reason box, focus there, nothing sent', async () => {
    await setup(() => of({ success: true, data: makeBrokerDetail() }));
    component.openStatusDialog('SUSPENDED'); harness.detectChanges();
    component.confirmStatusChange(); await settleForm();
    const el = harness.routeNativeElement as HTMLElement;
    const ta = el.querySelector('#bk-status-reason');
    expectFieldProblem(ta, 'اكتب سبب الإيقاف');
    expectFocused(ta);
    component.statusReason.set('abc'); harness.detectChanges();
    component.confirmStatusChange(); await settleForm();
    expectFieldProblem(ta, 'قصير');
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it('suspend: 400 naming reason under the box; 429 / 500 / 403 / 409 generic alert; reason kept; double click sends one request', async () => {
    await setup(() => of({ success: true, data: makeBrokerDetail() }));
    component.openStatusDialog('SUSPENDED'); component.statusReason.set('نشاط مخالف للسياسة'); harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    patchSpy.mockReturnValueOnce(throwError(() => httpFail(400, { errors: [{ field: 'reason', message: 'السبب غير مقبول' }] })));
    component.confirmStatusChange(); await settleForm(); harness.detectChanges();
    expectFieldProblem(el.querySelector('#bk-status-reason'), 'غير مقبول');
    for (const st of [429, 500, 403, 409, 0]) {
      patchSpy.mockReturnValueOnce(throwError(() => httpFail(st, { message: 'x' })));
      component.confirmStatusChange(); await settleForm(); harness.detectChanges();
      expect(component.statusError(), String(st)).toBeTruthy();
      expectNoFieldProblem(el);
      expect(el.querySelector('[data-testid="bk-status-error"]')?.getAttribute('role')).toBe('alert');
    }
    expect(component.statusReason()).toBe('نشاط مخالف للسياسة');
    patchSpy.mockClear();
    patchSpy.mockReturnValue(new Subject());
    component.confirmStatusChange(); component.confirmStatusChange();
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });
});
