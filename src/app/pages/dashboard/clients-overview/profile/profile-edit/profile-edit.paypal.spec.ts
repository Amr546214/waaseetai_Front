import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Client profile/edit, "البيانات البنكية / المحفظة" tab: PayPal is the only usable receiving method.
describe('client profile-edit: PayPal-only receiving method', () => {
  let fixture: ComponentFixture<ProfileEdit>;
  let component: ProfileEdit;
  let http: HttpTestingController;
  let updateTab: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    updateTab = vi.fn(() => of({ success: true }));
    await TestBed.configureTestingModule({
      imports: [ProfileEdit],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
        {
          provide: ProfileApiService,
          useValue: {
            getMyProfile: () => of({ success: true, data: { currentProfileData: {}, latestHistory: [] } }),
            getChangeRequests: () => of({ success: true, data: [] }),
            updateTab,
            updateProfile: vi.fn(() => of({ success: true })),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileEdit);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    component.switchTab('banking');
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('the bank option is disabled with a "غير متاح حاليًا" badge and cannot be selected', () => {
    const bank = el().querySelector('#pm-bank') as HTMLElement;
    expect(bank.getAttribute('aria-disabled')).toBe('true');
    expect(bank.textContent).toContain('غير متاح حاليًا');
    expect((bank.querySelector('input') as HTMLInputElement).disabled).toBe(true);
    component.setPaymentMethod('bank');
    expect(component.paymentMethod()).toBe('wallet');
  });

  it('PayPal (wallet) is the default and only method; the form never defaults to bank', () => {
    expect(component.paymentMethod()).toBe('wallet');
    expect(component.bankingForm.get('paymentMethod')?.value).toBe('wallet');
    expect(el().querySelector('#pm-paypal')?.textContent).toContain('PayPal');
  });

  it('shows only the PayPal email field: no bank, IBAN, wallet provider, wallet phone or wallet id', () => {
    const tab = el().textContent || '';
    expect(el().querySelector('#cl-paypal')).toBeTruthy();
    expect(tab).not.toMatch(/IBAN|اسم البنك|مزود المحفظة|رقم الجوال المرتبط|معرف المحفظة|STC Pay|urpay|barq|Alinma/);
    for (const name of ['bankName', 'ibanNumber', 'walletProvider', 'walletPhone', 'walletId', 'accountHolderName']) {
      expect(el().querySelector(`[formcontrolname="${name}"]`), name).toBeNull();
    }
  });

  it('PayPal email is required and must be valid', () => {
    const c = component.bankingForm.get('paypalEmail')!;
    expect(c.valid).toBe(false);
    c.setValue('not-an-email'); expect(c.valid).toBe(false);
    c.setValue('a@b'); expect(c.valid).toBe(false);
    c.setValue('name@example.com'); expect(c.valid).toBe(true);
    c.setValue('bad'); c.markAsTouched(); fixture.detectChanges();
    expect(el().textContent).toContain('أدخل بريد PayPal صالحًا');
  });

  it('saving is not offered yet (backend has no client PayPal field): the button is disabled and no request is ever sent', () => {
    expect((el().querySelector('form button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    expect(el().querySelector('#cl-paypal-pending')?.textContent).toContain('غير مفعّل بعد');
    component.bankingForm.get('paypalEmail')!.setValue('name@example.com');
    component.saveTab('banking');
    expect(updateTab).not.toHaveBeenCalled();
    http.expectNone(() => true);
    expect(component.errorMsg()).toContain('غير مفعّل');
  });

  it('an invalid email is rejected before anything else', () => {
    component.bankingForm.get('paypalEmail')!.setValue('nope');
    component.saveTab('banking');
    expect(updateTab).not.toHaveBeenCalled();
    expect(component.errorMsg()).toContain('PayPal');
  });
});
