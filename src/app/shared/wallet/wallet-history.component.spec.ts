import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { WalletHistoryComponent } from './wallet-history.component';

describe('WalletHistoryComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [WalletHistoryComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(WalletHistoryComponent);
    fixture.componentRef.setInput('role', 'client');
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }
  const row = (id: string, extra: any = {}) => ({ id, type: 'DEPOSIT', amount: 96.5, currency: 'USD', status: 'COMPLETED', createdAt: '2026-11-01T10:00:00Z', title: 't' + id, ...extra });

  it('shows the recorded before / deduction / net, the missing-details text, the employee, and an explicit empty state', () => {
    const { fixture, http } = setup();
    http.expectOne(r => r.url.endsWith('/client/finance/wallet/history') && r.params.get('page') === '1').flush({ success: true, data: {
      items: [row('a', { employeeName: 'سارة', breakdown: { operation: 'DEPOSIT', operationLabel: 'إيداع عبر PayPal', currency: 'USD', detailsRecorded: true, missingNote: null, gross: 100, deductions: [{ code: 'PAYPAL_DEPOSIT_FEE', label: 'رسوم الإيداع', amount: 3.5, ratePercent: 3.5, level: null, levelRecorded: false, reason: 'x' }], net: 96.5, netMeaning: 'ADDED_TO_WALLET', note: null } }),
              row('b', { amount: -150, breakdown: { operation: 'OTHER', operationLabel: 'x', currency: 'USD', detailsRecorded: false, missingNote: 'تفاصيل الخصم غير مسجّلة', gross: null, deductions: [], net: 150, netMeaning: 'ADDED_TO_WALLET', note: null } })],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 }, summary: { cards: {} } } });
    fixture.detectChanges();
    const t = (fixture.nativeElement as HTMLElement).textContent!;
    expect(t).toContain('100.00'); expect(t).toContain('96.50'); expect(t).toContain('رسوم الإيداع'); expect(t).toContain('سارة');
    expect(t).toContain('تفاصيل الخصم غير مسجّلة'); expect(t).toContain('150.00'); expect(t).not.toContain('-150');
  });

  it('empty history shows the no-transactions state', () => {
    const { fixture, http } = setup();
    http.expectOne(r => r.url.endsWith('/client/finance/wallet/history')).flush({ success: true, data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('لا توجد معاملات مالية بعد');
  });
});
