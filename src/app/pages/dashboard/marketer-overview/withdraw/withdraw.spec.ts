import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Withdraw, WITHDRAWAL_STATE } from './withdraw';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { MarketerOverviewService, MarketerWallet } from '../../../../core/services/marketer-overview.service';

// The withdraw page shows the SERVER's balance (never a figure derived in the browser), every withdrawal state and the transaction details.
const WALLET: MarketerWallet = { currency: 'USD', approvedEarnings: 900, pendingEarnings: 50, reservedWithdrawals: 100, paidWithdrawals: 200, withdrawableBalance: 600, minimumWithdrawal: 300, paypalEmail: 'm@example.com', hasPaypal: true, withdrawBlockedReason: null };
const ROWS = [
  { id: 'w1', amount: 100, status: 'PENDING', paypalEmail: 'm@example.com', createdAt: '2026-10-01T10:00:00Z' },
  { id: 'w2', amount: 200, status: 'COMPLETED', paypalEmail: 'm@example.com', createdAt: '2026-09-01T10:00:00Z' },
  { id: 'w3', amount: 400, status: 'REJECTED', paypalEmail: 'm@example.com', createdAt: '2026-08-01T10:00:00Z', rejectionReason: 'بيانات غير مكتملة' },
  { id: 'w4', amount: 50, status: 'PROCESSING', paypalEmail: 'm@example.com', createdAt: '2026-07-01T10:00:00Z' },
  { id: 'w5', amount: 60, status: 'APPROVED', paypalEmail: 'm@example.com', createdAt: '2026-06-01T10:00:00Z' },
  { id: 'w6', amount: 70, status: 'REVERSED', paypalEmail: 'm@example.com', createdAt: '2026-05-01T10:00:00Z' },
];

describe('marketer withdraw: server balance, states and details', () => {
  let fixture: ComponentFixture<Withdraw>;
  let c: Withdraw;
  let svc: any;

  const setup = async (wallet: Partial<MarketerWallet> = {}, rows: any[] = ROWS, submit: any = of({ success: true })) => {
    svc = {
      getSummary: () => of({ success: true, data: { totalCommissions: 12345, successfulReferrals: 3 } }),
      getWallet: () => of({ success: true, data: { ...WALLET, ...wallet } }),
      getWithdrawals: () => of({ success: true, data: { items: rows } }),
      getWithdrawal: vi.fn((id: string) => of({ success: true, data: { ...rows.find(r => r.id === id), referenceId: 'WD-1', updatedAt: '2026-10-02T10:00:00Z' } })),
      submitWithdrawal: vi.fn(() => submit),
    };
    await TestBed.configureTestingModule({ imports: [Withdraw], providers: [provideRouter([]), { provide: MarketerOverviewService, useValue: svc }] }).compileComponents();
    fixture = TestBed.createComponent(Withdraw);
    c = fixture.componentInstance;
    fixture.detectChanges();
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

  it('the balance, reserved and paid figures are the server wallet, not the summary total', async () => {
    await setup();
    expect(c.withdrawableBalance()).toBe(600);
    expect(c.reservedAmount()).toBe(100);
    expect(c.completedAmount()).toBe(200);
    expect(el().textContent).toContain('600');
    expect(el().textContent).not.toContain('12345 $ عمولات'); // the header shows the approved earnings of the wallet
  });

  it('max / minimum / balance after use the real values; "use max" fills the amount', async () => {
    await setup();
    expect(el().querySelector('[data-testid="withdraw-limits"]')!.textContent).toContain('الحد الأدنى: 300');
    expect(el().querySelector('[data-testid="withdraw-limits"]')!.textContent).toContain('الحد الأقصى: 600');
    c.useMax();
    expect(c.withdrawForm.value.amount).toBe(600);
    c.withdrawForm.patchValue({ amount: 350 });
    expect(c.balanceAfter()).toBe(250);
    c.withdrawForm.patchValue({ amount: 9999 });
    expect(c.balanceAfter()).toBe(0);
  });

  it('every state has its own Arabic label: pending / approved / processing / paid / rejected / reversed', async () => {
    await setup();
    const states = Array.from(el().querySelectorAll('[data-testid="withdrawal-state"]')).map(e => [e.getAttribute('data-status'), e.textContent!.trim()]);
    expect(states).toEqual([['PENDING', 'بانتظار مراجعة الإدارة'], ['COMPLETED', 'مدفوع'], ['REJECTED', 'مرفوض'], ['PROCESSING', 'قيد التحويل'], ['APPROVED', 'معتمد'], ['REVERSED', 'أُعيد من PayPal']]);
    expect(Object.keys(WITHDRAWAL_STATE)).toEqual(['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'REVERSED']);
  });

  it('transaction details: opening a rejected withdrawal shows the rejection reason, reference and that the amount returned', async () => {
    await setup();
    const btns = el().querySelectorAll<HTMLButtonElement>('[data-testid="withdrawal-details-btn"]');
    btns[2].click(); fixture.detectChanges();
    expect(svc.getWithdrawal).toHaveBeenCalledWith('w3');
    const detail = el().querySelector('[data-testid="withdrawal-detail"]')!;
    expect(detail.textContent).toContain('بيانات غير مكتملة');
    expect(detail.textContent).toContain('WD-1');
    expect(detail.textContent).toContain('عاد إلى رصيدك');
    btns[2].click(); fixture.detectChanges();
    expect(el().querySelector('[data-testid="withdrawal-detail"]')).toBeNull();
  });

  it('no invented schedule or timing claims (no Wednesday payout day, no 1-3 business days, no fee)', async () => {
    await setup();
    expect(el().textContent).not.toMatch(/الأربعاء|1-3|أيام عمل|رسوم|عمولة PayPal|خلال \d+ ساعة/);
  });

  it('a blocked wallet (no PayPal / below minimum) disables the button and shows the server reason', async () => {
    await setup({ withdrawBlockedReason: 'رصيدك القابل للسحب أقل من الحد الأدنى (300 $)', withdrawableBalance: 100 });
    expect(el().querySelector('[data-testid="withdraw-blocked"]')!.textContent).toContain('أقل من الحد الأدنى');
    expect((el().querySelector('button.btn-primary-gradient') as HTMLButtonElement).disabled).toBe(true);
    c.withdrawForm.patchValue({ amount: 400 });
    c.submitWithdrawal();
    expect(svc.submitWithdrawal).not.toHaveBeenCalled();
    expect(TestBed.inject(UiNotificationService).toasts().at(-1)?.kind).toBe('error');
  });

  it('over-withdraw and below-minimum never reach the server; a valid amount does, then the data reloads', async () => {
    await setup();
    c.withdrawForm.patchValue({ amount: 601 }); c.submitWithdrawal();
    expect(TestBed.inject(UiNotificationService).toasts().at(-1)).toMatchObject({ kind: 'error', message: expect.stringContaining('يتجاوز رصيدك') });
    c.withdrawForm.patchValue({ amount: 299 }); c.submitWithdrawal();
    expect(TestBed.inject(UiNotificationService).toasts().at(-1)).toMatchObject({ kind: 'error', message: expect.stringContaining('300') });
    expect(svc.submitWithdrawal).not.toHaveBeenCalled();
    c.withdrawForm.patchValue({ amount: 600 }); c.submitWithdrawal();
    expect(svc.submitWithdrawal).toHaveBeenCalledWith(600);
    expect(TestBed.inject(UiNotificationService).toasts().at(-1)).toMatchObject({ kind: 'success', message: 'تم تقديم طلب السحب بنجاح' });
  });

  it('the server\'s own refusal is shown as is', async () => {
    await setup({}, ROWS, throwError(() => ({ status: 409, error: { message: 'المبلغ المطلوب يتجاوز رصيدك الصافي بعد طلبات السحب المعلقة (10 $)' } })));
    c.withdrawForm.patchValue({ amount: 500 }); c.submitWithdrawal();
    expect(TestBed.inject(UiNotificationService).toasts().at(-1)).toMatchObject({ kind: 'error', message: expect.stringContaining('بعد طلبات السحب المعلقة') });
  });

  it('no withdrawals yet: honest empty state', async () => {
    await setup({}, []);
    expect(el().textContent).toContain('لا توجد عمليات سحب مسجّلة بعد');
  });

  it('the wallet failing to load shows an error with retry, not zeros as if real', async () => {
    svc = { getSummary: () => of({ success: true, data: {} }), getWallet: () => throwError(() => new Error('x')), getWithdrawals: () => of({ success: true, data: { items: [] } }), getWithdrawal: vi.fn(), submitWithdrawal: vi.fn() };
    await TestBed.configureTestingModule({ imports: [Withdraw], providers: [provideRouter([]), { provide: MarketerOverviewService, useValue: svc }] }).compileComponents();
    fixture = TestBed.createComponent(Withdraw); c = fixture.componentInstance; fixture.detectChanges();
    expect(el().querySelector('[data-testid="wallet-error"]')).not.toBeNull();
  });
});
