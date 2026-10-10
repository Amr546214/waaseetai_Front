import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Withdraw } from './withdraw';
import { WithdrawalApiService } from '../../../../../core/services/withdrawal-api.service';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Provider withdrawals are PayPal-only: no bank fields, the destination is the saved PayPal email and the
// request body carries only { amount, method: 'paypal' } (the server resolves the destination itself).
describe('provider withdraw (PayPal only)', () => {
  let fixture: ComponentFixture<Withdraw>;
  let component: Withdraw;
  let submit: ReturnType<typeof vi.fn>;

  async function setup(paypalPayoutEmail: string | null, accountType = 'PROVIDER_INDIVIDUAL', withdrawals: any[] = [], opts: { balance?: number; submitImpl?: () => any } = {}) {
    submit = vi.fn(opts.submitImpl ?? (() => of({ success: true })));
    await TestBed.configureTestingModule({
      imports: [Withdraw],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType }) } },
        { provide: ProviderProfileService, useValue: { getProfile: () => of({ paypalPayoutEmail }) } },
        {
          provide: WithdrawalApiService,
          useValue: {
            getProviderWallet: () => of({ data: { summary: { availableBalance: opts.balance ?? 500, totalEarnings: opts.balance ?? 500, escrowBalance: 0, currency: 'USD' } } }),
            getProviderWithdrawals: () => of({ data: { withdrawals, pagination: { total: withdrawals.length, totalPages: 1 } } }),
            submitProviderWithdrawal: submit,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Withdraw);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('shows PayPal as the only method and no bank inputs', async () => {
    await setup('me@example.com');
    const el: HTMLElement = fixture.nativeElement;
    for (const gone of ['#wdName', '#wdIban', '#wdAcc']) expect(el.querySelector(gone)).toBeNull();
    expect(el.textContent).toContain('PayPal');
    expect(el.textContent).not.toContain('bank_transfer');
    expect(el.querySelector('[data-testid="wd-paypal-email"]')?.textContent).toContain('me@example.com');
  });

  it('submits only { amount, method: "paypal" } — no bank fields', async () => {
    await setup('me@example.com');
    component.setAmount(100);
    component.submit();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({ amount: 100, method: 'paypal' });
  });

  it('without a saved PayPal email it asks to add one and does not submit', async () => {
    await setup(null);
    expect(fixture.nativeElement.querySelector('[data-testid="wd-paypal-missing"]')).toBeTruthy();
    component.setAmount(100);
    component.submit();
    expect(submit).not.toHaveBeenCalled();
    expect(component.formErrors()['paypal']).toBeTruthy();
  });

  it('no PayPal email: "أضف بريد PayPal لاستلام الأرباح" with a link to the profile data page; no bank / IBAN text anywhere', async () => {
    await setup(null);
    const el: HTMLElement = fixture.nativeElement;
    const note = el.querySelector('[data-testid="wd-paypal-missing"]')!;
    expect(note.textContent).toContain('أضف بريد PayPal لاستلام الأرباح');
    expect(note.querySelector('a')!.getAttribute('href')).toContain('/provider-overview/profile/data');
    component.setAmount(100);
    component.submit();
    expect(component.formErrors()['paypal']).toBe('أضف بريد PayPal لاستلام الأرباح');
    expect(el.textContent).not.toMatch(/IBAN|حساب بنكي|الحساب البنكي|اسم البنك|تحويل بنكي/);
  });

  it('history never shows a legacy bank destination: an old bank row shows no IBAN / account name / number and no "bank transfer" label', async () => {
    await setup('me@example.com', 'PROVIDER_INDIVIDUAL', [
      { id: 'w1', amount: 50, currency: 'USD', status: 'COMPLETED', method: 'bank_transfer', iban: 'SA0380000000608010167519', accountName: 'Old Holder', accountNumber: '123456789', createdAt: '2026-10-01T00:00:00Z' },
      { id: 'w2', amount: 20, currency: 'USD', status: 'PENDING', method: 'paypal', paypalEmail: 'me@example.com', createdAt: '2026-10-02T00:00:00Z' },
    ]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('me@example.com');
    expect(text).not.toMatch(/IBAN|SA0380|Old Holder|123456789|رقم الحساب|اسم الحساب|تحويل بنكي/);
    expect(component.getMethodLabel('bank_transfer')).not.toMatch(/بنك/);
  });

  it('company accounts: no fake "code sent to the company phone" step; the request goes straight to the admin review queue', async () => {
    await setup('co@example.com', 'PROVIDER_COMPANY');
    component.setAmount(100);
    component.submit();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(submit).toHaveBeenCalledWith({ amount: 100, method: 'paypal' });
    expect(el.querySelector('.wd-otp-overlay')).toBeNull();
    expect(el.textContent).not.toContain('جوال الشركة');
  });

  describe('AUD-FND-000065: a rejected click is never silent', () => {
    const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const type = (value: string) => { const input = (fixture.nativeElement as HTMLElement).querySelector('#wdAmt') as HTMLInputElement; input.value = value; input.dispatchEvent(new Event('input')); fixture.detectChanges(); };

    it('balance 0 + amount 1: the error shows as soon as it is typed, a click sends no request, and the banner repeats it', async () => {
      await setup('me@example.com', 'PROVIDER_INDIVIDUAL', [], { balance: 0 });
      expect(q('wd-zero-balance')!.textContent).toContain('لا يوجد رصيد متاح للسحب حاليًا');
      type('1');
      expect(q('wd-amount-error')!.textContent).toContain('الرصيد غير كافٍ');
      ((fixture.nativeElement as HTMLElement).querySelector('.wd-btn-pri') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(submit).not.toHaveBeenCalled();
      expect(q('wd-submit-error')!.textContent).toContain('الرصيد غير كافٍ');
    });

    it('amount above a positive balance: "لا يمكنك طلب سحب أكبر من الرصيد المتاح", no request', async () => {
      await setup('me@example.com', 'PROVIDER_INDIVIDUAL', [], { balance: 500 });
      type('900');
      expect(q('wd-amount-error')!.textContent).toContain('لا يمكنك طلب سحب أكبر من الرصيد المتاح');
      component.submit(); fixture.detectChanges();
      expect(submit).not.toHaveBeenCalled();
      expect(q('wd-submit-error')).toBeTruthy();
    });

    it('a valid amount clears the error and sends one request', async () => {
      await setup('me@example.com', 'PROVIDER_INDIVIDUAL', [], { balance: 500 });
      type('900'); expect(q('wd-amount-error')).toBeTruthy();
      type('100'); expect(q('wd-amount-error')).toBeNull();
      component.submit();
      expect(submit).toHaveBeenCalledTimes(1);
    });

    it('if the backend still answers insufficient balance, its message is displayed', async () => {
      await setup('me@example.com', 'PROVIDER_INDIVIDUAL', [], { balance: 500, submitImpl: () => throwError(() => ({ status: 400, error: { message: 'المبلغ المطلوب يتجاوز رصيدك المتاح (500 $)' } })) });
      type('100'); component.submit(); fixture.detectChanges();
      expect(q('wd-submit-error')!.textContent).toContain('يتجاوز رصيدك المتاح');
    });

    it('the PayPal freeze error from the backend is displayed, with the time withdrawals open again', async () => {
      const availableAt = new Date(Date.now() + 23 * 3600_000).toISOString();
      await setup('me@example.com', 'PROVIDER_INDIVIDUAL', [], { balance: 500, submitImpl: () => throwError(() => ({ status: 400, error: { message: 'تم تغيير بريد PayPal مؤخرًا. يمكنك طلب السحب بعد مرور 24 ساعة.', code: 'PAYPAL_EMAIL_FROZEN', availableAt, retryAfterSeconds: 82800 } })) });
      type('100'); component.submit(); fixture.detectChanges();
      expect(q('wd-submit-error')!.textContent).toContain('يمكنك طلب السحب بعد مرور 24 ساعة');
      expect(q('wd-submit-error-hint')!.textContent).toContain('يتاح السحب بعد');
    });
  });
});
