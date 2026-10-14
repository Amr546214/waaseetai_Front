import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Withdraw } from './withdraw';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { MarketerOverviewService } from '../../../../core/services/marketer-overview.service';

// Withdraw page: PayPal is the only destination. No PayPal email saved = a clear message, never a bank / IBAN field.
describe('marketer withdraw: PayPal only', () => {
  let fixture: ComponentFixture<Withdraw>;
  let c: Withdraw;

  const setup = async (profile: any) => {
    const wallet = { currency: 'USD', approvedEarnings: 1000, pendingEarnings: 0, reservedWithdrawals: 0, paidWithdrawals: 0, withdrawableBalance: 1000, minimumWithdrawal: 300, paypalEmail: profile.paypalPayoutEmail, hasPaypal: !!profile.paypalPayoutEmail, withdrawBlockedReason: profile.paypalPayoutEmail ? null : 'أضف بريد PayPal لاستلام الأرباح' };
    await TestBed.configureTestingModule({
      imports: [Withdraw],
      providers: [
        provideRouter([]),
        { provide: MarketerOverviewService, useValue: { getSummary: () => of({ success: true, data: { totalCommissions: 1000 } }), getWallet: () => of({ success: true, data: wallet }), getWithdrawals: () => of({ success: true, data: { items: [] } }), createWithdrawal: vi.fn(() => of({ success: true })) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Withdraw);
    c = fixture.componentInstance;
    fixture.detectChanges();
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

  it('no PayPal email: "أضف بريد PayPal لاستلام الأرباح" with a link to the profile; no bank / IBAN text at all', async () => {
    await setup({ paypalPayoutEmail: null });
    expect(c.hasPaypal()).toBe(false);
    const note = el().querySelector('[data-testid="paypal-none"]')!;
    expect(note.textContent).toContain('أضف بريد PayPal لاستلام الأرباح');
    expect(note.querySelector('a')!.getAttribute('href')).toContain('/marketer-overview/profile/data');
    expect(el().textContent).not.toMatch(/IBAN|الحساب البنكي|اسم البنك|بنك غير محدد|محفظة/);
  });

  it('PayPal saved: the PayPal email is the destination shown, no bank / IBAN, no warning', async () => {
    await setup({ paypalPayoutEmail: 'm@example.com', iban: 'SA0380000000608010167519', bankName: 'مصرف الراجحي' });
    expect(c.hasPaypal()).toBe(true);
    expect(el().querySelector('[data-testid="paypal-destination"]')!.textContent).toContain('m@example.com');
    expect(el().querySelector('[data-testid="paypal-none"]')).toBeNull();
    expect(el().textContent).not.toMatch(/IBAN|SA0380000000608010167519|مصرف الراجحي|الحساب البنكي/);
  });

  it('requesting a withdrawal without a PayPal email shows the message and sends nothing', async () => {
    await setup({ paypalPayoutEmail: null });
    c.withdrawForm.patchValue({ amount: 400 });
    c.submitWithdrawal();
    expect(TestBed.inject(UiNotificationService).toasts().at(-1)).toMatchObject({ kind: 'error', message: 'أضف بريد PayPal لاستلام الأرباح' });
  });
});
