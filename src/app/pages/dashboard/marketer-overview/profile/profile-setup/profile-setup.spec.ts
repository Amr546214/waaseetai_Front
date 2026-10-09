import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ProfileSetup } from './profile-setup';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

describe('ProfileSetup (marketer): shared validation', () => {
  let fixture: ComponentFixture<ProfileSetup>;
  let component: ProfileSetup;
  let svc: { getProfile: any; updateMarketingInfo: any; addChannel: any; updatePaypalPayout: any };

  beforeEach(async () => {
    svc = {
      getProfile: vi.fn(() => of({ success: true, data: { marketingChannels: [], completionPercentage: 20, user: {} } })),
      updateMarketingInfo: vi.fn(() => of({ success: true })),
      addChannel: vi.fn(() => of({ success: true })),
      updatePaypalPayout: vi.fn(() => of({ success: true, data: { paypalPayoutEmail: 'm@example.com' } })),
    };
    await TestBed.configureTestingModule({
      imports: [ProfileSetup],
      providers: [provideRouter([]), { provide: MarketerProfileService, useValue: svc }],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileSetup);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => TestBed.inject(UiNotificationService).clearAll());

  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const summary = () => el().querySelector('[data-testid="form-summary"]')?.textContent || '';
  const errors = () => Array.from(el().querySelectorAll('[data-testid="field-error"]')).map(e => e.textContent || '');
  const goTo = (step: number) => { component.setStep(step); render(); };
  const fillPaypal = () => component.paypalForm.patchValue({ paypalPayoutEmail: 'm@example.com' });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('channel step', () => {
    it('Add with nothing chosen: no request, summary names both fields, inline errors, focus on the first, button enabled', () => {
      document.body.appendChild(el());
      goTo(3);
      component.addChannel();
      render();
      expect(svc.addChannel).not.toHaveBeenCalled();
      expect(summary()).toContain('نوع القناة');
      expect(summary()).toContain('معرّف القناة');
      expect(errors().some(t => t.includes('اختر نوع القناة'))).toBe(true);
      expect(errors().some(t => t.includes('أدخل معرّف القناة'))).toBe(true);
      expect(document.activeElement?.getAttribute('formcontrolname')).toBe('platform');
      expect((Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('إضافة ومتابعة')) as HTMLButtonElement).disabled).toBe(false);
      el().remove();
    });

    it('the step explains that it can be completed, or passed with "التالي"', () => {
      goTo(3);
      expect(el().textContent).not.toContain('تخطي');
      expect(el().textContent).toContain('اضغط "التالي" للمتابعة بدونها');
      expect(el().textContent).toContain('اضغط "إضافة ومتابعة"');
    });

    it('a valid channel is sent and the wizard moves on', () => {
      goTo(3);
      component.channelForm.patchValue({ platform: 'LINKEDIN', handle: 'https://linkedin.com/in/x' });
      component.addChannel();
      expect(svc.addChannel).toHaveBeenCalledWith({ platform: 'LINKEDIN', handle: 'https://linkedin.com/in/x' });
      expect(component.currentStep()).toBe(4);
      expect(component.missing()).toEqual([]);
    });

    it('a 500 (the backend throws a plain Error) is shown in Arabic, nothing English, and the form is kept', () => {
      const notify = TestBed.inject(UiNotificationService);
      svc.addChannel.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Internal Server Error' } })));
      goTo(3);
      component.channelForm.patchValue({ platform: 'TIKTOK', handle: 'x' });
      component.addChannel();
      expect(notify.toasts().at(-1)!.message).not.toMatch(/[A-Za-z]/);
      expect(component.isSubmitting()).toBe(false);
      expect(component.channelForm.value.handle).toBe('x');
      expect(component.currentStep()).toBe(3);
    });
  });

  describe('PayPal step', () => {
    it('shows one PayPal email field only: no bank, IBAN, account holder or wallet text or inputs', () => {
      goTo(4);
      const text = el().textContent || '';
      expect(el().querySelector('#ps-paypal')).toBeTruthy();
      expect(text).toContain('بريد PayPal');
      expect(text).toContain('يُستخدم PayPal فقط للمدفوعات على المنصة');
      expect(text).not.toMatch(/IBAN|اسم البنك|الحساب البنكي|صاحب الحساب|محفظة|STC Pay|الراجحي/);
      for (const n of ['iban', 'bankName', 'accountHolderName', 'swiftCode']) expect(el().querySelector(`[formcontrolname="${n}"]`), n).toBeNull();
    });

    it('empty save: no request, the PayPal email is named as missing, button enabled', () => {
      goTo(4);
      component.savePaypal();
      render();
      expect(svc.updatePaypalPayout).not.toHaveBeenCalled();
      expect(summary()).toContain('بريد PayPal');
      expect(errors().some(t => t.includes('بريد PayPal مطلوب'))).toBe(true);
      expect((Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('حفظ ومتابعة')) as HTMLButtonElement).disabled).toBe(false);
    });

    it('an invalid email gets an Arabic explanation and is not sent', () => {
      goTo(4);
      component.paypalForm.get('paypalPayoutEmail')!.setValue('not-an-email');
      component.savePaypal(); render();
      expect(svc.updatePaypalPayout).not.toHaveBeenCalled();
      expect(errors().some(t => t.includes('بريد PayPal صالحًا'))).toBe(true);
    });

    it('a valid email is sent alone (no bank fields) and step 5 shows PayPal "مكتمل" from the backend state', () => {
      goTo(4);
      fillPaypal();
      svc.getProfile.mockReturnValue(of({ success: true, data: { marketingChannels: [], completionPercentage: 70, user: {}, paypalPayoutEmail: 'm@example.com', missingItems: [] } }));
      component.savePaypal();
      expect(svc.updatePaypalPayout).toHaveBeenCalledWith('m@example.com');
      expect(component.toastMsg()).toBe('تم حفظ بريد PayPal');
      expect(component.currentStep()).toBe(5);
      render();
      expect(el().querySelector('[data-testid="paypal-state"]')!.textContent).toContain('مكتمل');
      expect(el().textContent).not.toMatch(/IBAN|الحساب البنكي|اسم البنك/);
    });

    it('zod errors[] from the server land on the PayPal input; the English 400 is never shown', () => {
      svc.updatePaypalPayout.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Validation Error', errors: [{ path: 'body.paypalPayoutEmail', message: 'أدخل بريد PayPal صالحًا مثل name@example.com' }] } })));
      goTo(4);
      fillPaypal();
      component.savePaypal();
      render();
      expect(component.paypalForm.get('paypalPayoutEmail')!.errors?.['server']).toBeTruthy();
      expect(component.isSubmitting()).toBe(false);
      expect(component.currentStep()).toBe(4);
    });

    it('before PayPal is saved the review says "لم يُضف"', () => {
      goTo(5);
      expect(component.paypalState()).toBe('لم يُضف');
    });
  });

  describe('bio step', () => {
    it('is optional, but a bio over the 500-character limit is explained and not sent', () => {
      goTo(2);
      component.marketingForm.get('bio')!.setValue('x'.repeat(501));
      component.saveBio(); render();
      expect(svc.updateMarketingInfo).not.toHaveBeenCalled();
      expect(errors().some(t => t.includes('500'))).toBe(true);
      expect(summary()).toContain('الوصف التسويقي');
    });

    it('an empty bio is valid and saved', () => {
      goTo(2);
      component.saveBio();
      expect(svc.updateMarketingInfo).toHaveBeenCalledTimes(1);
    });
  });

  it('moving between steps clears the previous summary', () => {
    goTo(4);
    component.savePaypal();
    expect(component.missing().length).toBeGreaterThan(0);
    component.prevStep();
    expect(component.missing()).toEqual([]);
  });

  it('a newer toast is not cleared early by the timer of an older one', () => {
    vi.useFakeTimers();
    component.showToast('الأول');
    vi.advanceTimersByTime(2500);
    component.showToast('الثاني');
    vi.advanceTimersByTime(1000); // the first toast's 3 s would have elapsed here
    expect(component.toastMsg()).toBe('الثاني');
    vi.advanceTimersByTime(2100);
    expect(component.toastMsg()).toBeNull();
    vi.useRealTimers();
  });
});
