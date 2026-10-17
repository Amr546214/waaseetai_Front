import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Withdraw } from './withdraw';
import { MarketerOverviewService, MarketerWallet } from '../../../../core/services/marketer-overview.service';
import { installMemoryStorage } from '../../../../core/wait/memory-storage.testkit';

const WALLET: MarketerWallet = { currency: 'USD', approvedEarnings: 900, pendingEarnings: 0, reservedWithdrawals: 0, paidWithdrawals: 0, withdrawableBalance: 600, minimumWithdrawal: 300, paypalEmail: 'm@example.com', hasPaypal: true, withdrawBlockedReason: null };

// Withdrawal request (money out): a 429 is a wait on the confirm button only; the typed amount stays; nothing is re-sent at zero.
describe('marketer withdraw countdown (429)', () => {
  let restore: () => void = () => undefined;
  let fixture: ComponentFixture<Withdraw>; let c: Withdraw; let submit: ReturnType<typeof vi.fn>;
  beforeEach(() => { restore = installMemoryStorage(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z')); });
  afterEach(() => { fixture?.destroy(); vi.useRealTimers(); restore(); TestBed.resetTestingModule(); });

  async function setup(result: () => any) {
    submit = vi.fn(result);
    const svc = {
      getSummary: () => of({ success: true, data: {} }), getWallet: () => of({ success: true, data: WALLET }),
      getWithdrawals: () => of({ success: true, data: { items: [] } }), getWithdrawal: vi.fn(), submitWithdrawal: submit,
    };
    await TestBed.configureTestingModule({ imports: [Withdraw], providers: [provideRouter([]), { provide: MarketerOverviewService, useValue: svc }] }).compileComponents();
    fixture = TestBed.createComponent(Withdraw); c = fixture.componentInstance;
    fixture.detectChanges(); fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges();
    c.withdrawForm.patchValue({ amount: 400 });
    return fixture.nativeElement as HTMLElement;
  }
  const limited = (retryAfter: string | null) => throwError(() => ({ status: 429, headers: { get: (k: string) => (k === 'Retry-After' ? retryAfter : null) }, error: { message: 'محاولات سحب كثيرة' } }));
  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  it('429 with a wait: confirm disabled with «بعد m:ss», sentence shown, amount kept, no second request, enabled at zero without any automatic request', async () => {
    const el = await setup(() => limited('45'));
    c.submitWithdrawal(); fixture.detectChanges();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(q(el, 'withdraw-wait')!.textContent).toContain('بعد 0:45');
    expect(q(el, 'withdraw-rate-limit')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد 0:45');
    expect(el.textContent).not.toContain('حدث خطأ في الخادم');
    expect(c.withdrawForm.value.amount).toBe(400);
    c.submitWithdrawal(); expect(submit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(46_000); fixture.detectChanges();
    expect(q(el, 'withdraw-wait')).toBeNull();
    expect(q(el, 'withdraw-rate-limit')).toBeNull();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('429 with no stated time: honest sentence, no number, the button stays usable (the server decides next time)', async () => {
    const el = await setup(() => limited(null));
    c.submitWithdrawal(); fixture.detectChanges();
    const t = q(el, 'withdraw-rate-limit')!.textContent!;
    expect(t).toContain('بعد قليل'); expect(t).not.toMatch(/\d/);
    expect(q(el, 'withdraw-wait')).toBeNull();
    c.submitWithdrawal(); expect(submit).toHaveBeenCalledTimes(2);
  });
});
