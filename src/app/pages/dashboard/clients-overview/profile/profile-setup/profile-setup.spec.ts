import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Client onboarding step 3 is PayPal-only: no bank/wallet inputs, and the setup payload carries
// bank.paymentType='paypal' + bank.paypalPayoutEmail (no iban/bankName/accountHolder).
describe('client profile-setup: PayPal-only financial step', () => {
  let fixture: ComponentFixture<ProfileSetupDashboard>;
  let component: ProfileSetupDashboard;
  let save: ReturnType<typeof vi.fn>;
  let setupData: any;

  beforeEach(async () => {
    save = vi.fn(() => of({ success: true }));
    setupData = {};
    await TestBed.configureTestingModule({
      imports: [ProfileSetupDashboard],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => null } },
        { provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data: setupData }), saveClientProfileSetup: save } },
      ],
    }).compileComponents();
  });

  const create = () => {
    fixture = TestBed.createComponent(ProfileSetupDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const fillValid = () => {
    component.setupForm.get('details')!.patchValue({ idNumber: '1234567890', dob: '1990-01-01', country: 'السعودية', city: 'الرياض', occupation: 'x', address: 'y' });
    component.setupForm.get('agreements')!.patchValue({ accurate: true, terms: true, privacy: true });
  };

  it('step 3 shows only the PayPal email field - no bank, IBAN, account holder or wallet inputs', () => {
    create();
    component.setStep(3);
    fixture.detectChanges();
    const text = el().textContent || '';
    expect(el().querySelector('#su-paypal')).toBeTruthy();
    expect(text).toContain('PayPal');
    expect(text).not.toMatch(/IBAN|الآيبان|اسم البنك|محفظة\s*رقمية|مصرف الراجحي/);
    for (const n of ['bankName', 'accountHolder', 'iban']) {
      expect(el().querySelector(`[formcontrolname="${n}"]`), n).toBeNull();
    }
    expect(el().querySelector('input[type="radio"][formcontrolname="paymentType"]')).toBeNull();
  });

  it('PayPal email is required and must be valid (bank fields are not required)', () => {
    create();
    const c = component.setupForm.get('bank.paypalPayoutEmail')!;
    expect(c.valid).toBe(false);
    c.setValue('bad'); expect(c.valid).toBe(false);
    c.setValue('a@b'); expect(c.valid).toBe(false);
    c.setValue('name@example.com'); expect(c.valid).toBe(true);
    expect(component.setupForm.get('bank')!.valid).toBe(true);
  });

  it('submits bank.paymentType="paypal" + bank.paypalPayoutEmail and no bank fields', () => {
    create();
    fillValid();
    component.setupForm.get('bank.paypalPayoutEmail')!.setValue('Name@Example.com');
    component.submitForm();
    expect(save).toHaveBeenCalledTimes(1);
    const bank = save.mock.calls[0][0].bank;
    expect(bank).toEqual({ paymentType: 'paypal', paypalPayoutEmail: 'Name@Example.com' });
    for (const k of ['iban', 'bankName', 'accountHolder']) expect(bank).not.toHaveProperty(k);
  });

  it('does not submit without a valid PayPal email', () => {
    create();
    fillValid();
    component.submitForm();
    expect(save).not.toHaveBeenCalled();
  });

  it('prefills the saved PayPal email and ignores a legacy bank paymentType', () => {
    setupData = { paymentType: 'bank', bankName: 'rajhi', iban: 'SA0000000000000000000000', paypalPayoutEmail: 'saved@example.com' };
    create();
    expect(component.setupForm.get('bank.paypalPayoutEmail')?.value).toBe('saved@example.com');
    expect(component.setupForm.get('bank.paymentType')?.value).toBe('paypal');
  });

  it('the step label says PayPal, not bank/wallet', () => {
    create();
    expect(component.steps[2].label).toContain('PayPal');
  });
});
