import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Withdraw } from './withdraw';
import { MarketerOverviewService } from '../../../../core/services/marketer-overview.service';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../shared/forms/form-spec-utils';

const WALLET = { currency: 'USD', approvedEarnings: 900, pendingEarnings: 0, reservedWithdrawals: 0, paidWithdrawals: 0, withdrawableBalance: 600, minimumWithdrawal: 300, paypalEmail: 'm@example.com', hasPaypal: true, withdrawBlockedReason: null };

describe('marketer withdraw form: field-level errors, backend errors, one request', () => {
  let fixture: ComponentFixture<Withdraw>;
  let svc: any;
  const el = () => fixture.nativeElement as HTMLElement;
  const amount = () => el().querySelector<HTMLInputElement>('#withdraw-amount')!;
  const button = () => el().querySelector<HTMLButtonElement>('button.btn-primary-gradient')!;

  const setup = async (submit: any = of({ success: true })) => {
    (Element.prototype as any).scrollIntoView = vi.fn();
    svc = {
      getSummary: () => of({ success: true, data: {} }),
      getWallet: () => of({ success: true, data: WALLET }),
      getWithdrawals: () => of({ success: true, data: { items: [] } }),
      getWithdrawal: vi.fn(),
      submitWithdrawal: vi.fn(() => submit),
    };
    await TestBed.configureTestingModule({ imports: [Withdraw], providers: [provideRouter([]), { provide: MarketerOverviewService, useValue: svc }] }).compileComponents();
    fixture = TestBed.createComponent(Withdraw);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges();
  };
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

  it('the amount starts empty and the placeholder holds no invented number', async () => {
    await setup();
    expect(amount().value).toBe('');
    expect(amount().placeholder).not.toMatch(/\d/);
  });

  it('empty submit: the message is under the amount (aria-invalid, describedby, role=alert) and the amount has focus; no request', async () => {
    await setup();
    button().click();
    await settleForm();
    expectFieldProblem(amount(), 'أدخل مبلغ السحب');
    expectFocused(amount());
    expect(svc.submitWithdrawal).not.toHaveBeenCalled();
  });

  it('below the minimum and above the balance explain themselves at the field', async () => {
    await setup();
    amount().value = '100'; amount().dispatchEvent(new Event('input'));
    button().click(); await settleForm();
    expectFieldProblem(amount(), 'الحد الأدنى');
    amount().value = '9999'; amount().dispatchEvent(new Event('input'));
    button().click(); await settleForm();
    expectFieldProblem(amount(), 'يتجاوز رصيدك');
    expect(svc.submitWithdrawal).not.toHaveBeenCalled();
  });

  it('a 400 naming the amount lands on the amount field', async () => {
    await setup(throwError(() => httpFail(400, { errors: [{ field: 'amount', message: 'المبلغ أكبر من الرصيد المتاح' }] })));
    amount().value = '400'; amount().dispatchEvent(new Event('input'));
    button().click(); await settleForm();
    expectFieldProblem(amount(), 'المبلغ أكبر من الرصيد المتاح');
    expect(amount().value).toBe('400');
  });

  it('429 stays a generic message: no field is marked', async () => {
    await setup(throwError(() => httpFail(429, { message: 'Too many requests' })));
    amount().value = '400'; amount().dispatchEvent(new Event('input'));
    button().click(); await settleForm();
    expectNoFieldProblem(el());
  });

  it('a double click sends ONE request', async () => {
    const pending = new Subject<any>();
    await setup(pending);
    amount().value = '400'; amount().dispatchEvent(new Event('input'));
    button().click(); button().click();
    expect(svc.submitWithdrawal).toHaveBeenCalledTimes(1);
    pending.next({ success: true }); pending.complete();
  });
});
