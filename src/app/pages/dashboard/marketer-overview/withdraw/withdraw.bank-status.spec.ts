import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Withdraw } from './withdraw';
import { MarketerOverviewService } from '../../../../core/services/marketer-overview.service';
import { MarketerProfileService } from '../../../../core/services/marketer-profile.service';

// Withdraw page: three bank states from the backend: none / pending review / approved.
describe('marketer withdraw: bank data state', () => {
  let fixture: ComponentFixture<Withdraw>;
  let c: Withdraw;

  const setup = async (profile: any) => {
    await TestBed.configureTestingModule({
      imports: [Withdraw],
      providers: [
        provideRouter([]),
        { provide: MarketerOverviewService, useValue: { getSummary: () => of({ success: true, data: { totalCommissions: 1000 } }), getWithdrawals: () => of({ success: true, data: { items: [] } }), createWithdrawal: vi.fn(() => of({ success: true })) } },
        { provide: MarketerProfileService, useValue: { getProfile: () => of({ success: true, data: profile }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Withdraw);
    c = fixture.componentInstance;
    fixture.detectChanges();
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

  it('none: "لم تُضف بيانات حساب بنكي" with a link to add the IBAN', async () => {
    await setup({ iban: '', bankStatus: 'none' });
    expect(c.hasBankInfo()).toBe(false);
    expect(el().querySelector('[data-testid="bank-none"]')!.textContent).toContain('لم تُضف بيانات حساب بنكي');
    expect(el().querySelector('[data-testid="bank-pending-review"]')).toBeNull();
  });

  it('pending review: "بياناتك البنكية قيد المراجعة" (not "لم تُضف") with a link to the requests', async () => {
    await setup({ iban: '', bankStatus: 'pending_review' });
    expect(c.hasBankInfo()).toBe(false);
    expect(c.bankPendingReview()).toBe(true);
    const note = el().querySelector('[data-testid="bank-pending-review"]')!;
    expect(note.textContent).toContain('قيد المراجعة');
    expect(note.querySelector('a')!.getAttribute('href')).toBe('/marketer-overview/profile/requests');
    expect(el().querySelector('[data-testid="bank-none"]')).toBeNull();
  });

  it('approved: the bank name and IBAN are shown, no warning', async () => {
    await setup({ iban: 'SA0380000000608010167519', bankName: 'مصرف الراجحي', bankStatus: 'approved' });
    expect(c.hasBankInfo()).toBe(true);
    expect(el().textContent).toContain('SA0380000000608010167519');
    expect(el().querySelector('[data-testid="bank-none"]')).toBeNull();
    expect(el().querySelector('[data-testid="bank-pending-review"]')).toBeNull();
  });

  it('an older backend without bankStatus still works (iban present = approved)', async () => {
    await setup({ iban: 'SA0380000000608010167519' });
    expect(c.hasBankInfo()).toBe(true);
  });

  it('requesting a withdrawal while the bank data is pending explains it (no request)', async () => {
    await setup({ iban: '', bankStatus: 'pending_review' });
    c.withdrawForm.patchValue({ amount: 400 });
    c.submitWithdrawal();
    expect(c.toastMessage()?.text).toBe('بياناتك البنكية قيد المراجعة، يمكنك طلب السحب بعد اعتمادها');
    expect(c.toastMessage()?.type).toBe('error');
  });

  it('requesting a withdrawal with no bank data at all still asks for the IBAN', async () => {
    await setup({ iban: '', bankStatus: 'none' });
    c.withdrawForm.patchValue({ amount: 400 });
    c.submitWithdrawal();
    expect(c.toastMessage()?.text).toContain('أضف رقم الحساب البنكي');
  });
});
