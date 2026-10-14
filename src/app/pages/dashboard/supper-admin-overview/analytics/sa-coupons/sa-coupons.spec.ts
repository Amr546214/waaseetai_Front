import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SaCoupons } from './sa-coupons';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { AdminCoupon, AdminCouponsService } from '../../../../../core/services/admin-coupons.service';

// Admin coupons page: real GET /admin/coupons (no mock list), detail with
// redemptions, deactivate needs a confirm dialog + reason, reactivate of
// expired/exhausted is disabled with a visible reason, special offers are a
// read-only tab.

const coupon = (o: Partial<AdminCoupon> = {}): AdminCoupon => ({
  id: 'c1', code: 'SAVE10', provider: { id: 'p1', name: 'سارة', email: 'p@x.com', accountType: 'PROVIDER_INDIVIDUAL' },
  discountType: 'percentage', discountValue: 10, minimumAmount: null, maxDiscount: null, maxUses: 10, usedCount: 2, maxUsesPerUser: 1,
  active: true, status: 'active', approvalStatus: 'APPROVED', rejectionReason: null, startAt: '2026-01-01T00:00:00Z', expiresAt: null,
  services: [{ id: 's1', title: 'تصميم شعار' }], excludedServiceIds: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...o,
});
const page = (items: AdminCoupon[]) => ({ success: true, data: { items, page: 1, pageSize: 10, total: items.length, totalPages: 1, summary: { totalRedemptions: 7, totalDiscountGiven: 123.5 } } });

function setup(listRes: any = of(page([coupon()]))) {
  const api = {
    list: vi.fn(() => listRes),
    get: vi.fn(() => of({ success: true, data: { ...coupon(), internalNote: null, redemptionCount: 1, redemptions: [{ id: 'r1', orderId: 'o1', orderNumber: 'W-1', orderStatus: 'PAID', customer: { id: 'u', name: 'علي' }, orderValue: 200, discountApplied: 20, netValue: 180, createdAt: '2026-02-01T00:00:00Z' }] } })),
    setActive: vi.fn(() => of({ success: true, data: coupon({ active: false, status: 'inactive' }) })),
    listSpecialOffers: vi.fn(() => of({ success: true, data: { items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 } })),
  };
  TestBed.configureTestingModule({ providers: [{ provide: AdminCouponsService, useValue: api }] });
  const fixture = TestBed.createComponent(SaCoupons);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, api, el: fixture.nativeElement as HTMLElement };
}

describe('SaCoupons (admin)', () => {
  it('loads real coupons and shows real KPIs, no hardcoded sample codes', () => {
    const { el, api } = setup();
    expect(api.list).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('SAVE10');
    expect(el.textContent).toContain('123.5');
    expect(el.textContent).not.toContain('WASEET20');
    expect(el.textContent).not.toContain('12,840');
  });

  it('shows an honest empty state', () => {
    const { el } = setup(of(page([])));
    expect(el.textContent).toContain('لا توجد كوبونات مطابقة');
  });

  it('shows an error state with retry when the request fails', () => {
    const { el } = setup(throwError(() => ({ error: { message: 'فشل' } })));
    expect(el.textContent).toContain('فشل');
    expect(el.textContent).toContain('إعادة المحاولة');
  });

  it('status filter chip reloads with the server-side status', () => {
    const { cmp, api } = setup();
    cmp.setStatus('expired');
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'expired', page: 1 }));
  });

  it('opens the detail with redemptions', () => {
    const { cmp, fixture, el } = setup();
    cmp.openDetail(coupon());
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="coupon-detail"]')?.textContent).toContain('W-1');
  });

  it('deactivate requires a confirmation AND a reason before calling the API', () => {
    const { cmp, api, fixture } = setup();
    cmp.askToggle(coupon());
    fixture.detectChanges();
    expect(cmp.canConfirm()).toBe(false);
    cmp.confirmToggle();
    expect(api.setActive).not.toHaveBeenCalled();
    cmp.confirmReason.set('إساءة استخدام');
    cmp.confirmToggle();
    expect(api.setActive).toHaveBeenCalledWith('c1', false, 'إساءة استخدام');
    expect(TestBed.inject(UiNotificationService).toasts().some(t => t.kind === 'success' && t.message.includes('SAVE10'))).toBe(true);
  });

  it('reactivating an expired coupon is disabled with a visible reason and never opens the dialog', () => {
    const { cmp, fixture, el } = setup(of(page([coupon({ active: true, status: 'expired' })])));
    expect(cmp.toggleBlockedReason(coupon({ active: false, status: 'expired' }))).toContain('منتهي');
    cmp.askToggle(coupon({ active: false, status: 'expired' }));
    expect(cmp.confirmTarget()).toBeNull();
    fixture.detectChanges();
    expect(el.querySelector('.scp-coupon')).toBeTruthy();
  });

  it('reactivating an inactive coupon needs no reason', () => {
    const { cmp, api } = setup();
    cmp.askToggle(coupon({ active: false, status: 'inactive' }));
    expect(cmp.canConfirm()).toBe(true);
    cmp.confirmToggle();
    expect(api.setActive).toHaveBeenCalledWith('c1', true, undefined);
  });

  it('the create button is disabled and the honest reason is visible', () => {
    const { el } = setup();
    expect((el.querySelector('.scp-hdr button') as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector('[data-testid="create-disabled-reason"]')?.textContent).toContain('مقدم الخدمة');
  });

  it('special offers tab loads lazily from the read-only endpoint', () => {
    const { cmp, api, fixture, el } = setup();
    expect(api.listSpecialOffers).not.toHaveBeenCalled();
    cmp.showTab('offers');
    fixture.detectChanges();
    expect(api.listSpecialOffers).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('لا توجد عروض خاصة مطابقة');
  });
});
