import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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

  async function setup(paypalPayoutEmail: string | null, accountType = 'PROVIDER_INDIVIDUAL', withdrawals: any[] = []) {
    submit = vi.fn(() => of({ success: true }));
    await TestBed.configureTestingModule({
      imports: [Withdraw],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType }) } },
        { provide: ProviderProfileService, useValue: { getProfile: () => of({ paypalPayoutEmail }) } },
        {
          provide: WithdrawalApiService,
          useValue: {
            getProviderWallet: () => of({ data: { summary: { availableBalance: 500, totalEarnings: 500, escrowBalance: 0, currency: 'USD' } } }),
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
});
