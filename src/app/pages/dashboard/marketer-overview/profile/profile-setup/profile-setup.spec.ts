import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ProfileSetup } from './profile-setup';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

const VALID_IBAN = 'SA0380000000608010167519';

describe('ProfileSetup (marketer): shared validation', () => {
  let fixture: ComponentFixture<ProfileSetup>;
  let component: ProfileSetup;
  let svc: { getProfile: any; updateMarketingInfo: any; addChannel: any; updateBankInfo: any };

  beforeEach(async () => {
    svc = {
      getProfile: vi.fn(() => of({ success: true, data: { marketingChannels: [], completionPercentage: 20, user: {} } })),
      updateMarketingInfo: vi.fn(() => of({ success: true })),
      addChannel: vi.fn(() => of({ success: true })),
      updateBankInfo: vi.fn(() => of({ success: true, isPendingRequest: true })),
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
  const fillBank = () => component.bankForm.patchValue({ accountHolderName: 'محمد أحمد', iban: VALID_IBAN, bankName: 'مصرف الراجحي' });

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

    it('the step explains that it can be skipped or completed', () => {
      goTo(3);
      expect(el().textContent).toContain('تخطي');
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

  describe('bank step', () => {
    it('empty save: no request, all three required fields named, the bank name now carries a required marker, button enabled', () => {
      goTo(4);
      component.saveBankInfo();
      render();
      expect(svc.updateBankInfo).not.toHaveBeenCalled();
      for (const label of ['اسم صاحب الحساب', 'رقم IBAN', 'اسم البنك']) expect(summary(), label).toContain(label);
      expect(errors().some(t => t.includes('اختر اسم البنك'))).toBe(true);
      const bankLabel = Array.from(el().querySelectorAll('label')).find(l => l.textContent?.includes('اسم البنك'))!;
      expect(bankLabel.querySelector('.req')).toBeTruthy();
      expect((Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('حفظ ومتابعة')) as HTMLButtonElement).disabled).toBe(false);
    });

    it('an invalid IBAN gets an Arabic explanation; an over-long one is flagged (backend max 34)', () => {
      goTo(4);
      fillBank();
      component.bankForm.get('iban')!.setValue('SA12');
      component.saveBankInfo(); render();
      expect(svc.updateBankInfo).not.toHaveBeenCalled();
      expect(errors().some(t => t.includes('IBAN صالحًا'))).toBe(true);
      component.bankForm.get('iban')!.setValue('SA' + '1'.repeat(40));
      expect(component.bankForm.get('iban')!.errors?.['maxlength']).toBeTruthy();
    });

    it('valid details are sent; the success copy says they go to REVIEW and step 5 shows "قيد المراجعة" from the BACKEND state (not a local flag)', () => {
      goTo(4);
      fillBank();
      // After the request the backend reports the IBAN as pending review (this survives a reload).
      svc.getProfile.mockReturnValue(of({ success: true, data: { marketingChannels: [], completionPercentage: 40, user: {}, bankStatus: 'pending_review', missingItems: [
        { key: 'iban', label: 'الحساب البنكي (IBAN)', points: 30, status: 'pending_review', tab: 'bank', hint: 'طلب الحساب البنكي قيد المراجعة' }] } }));
      component.saveBankInfo();
      expect(svc.updateBankInfo).toHaveBeenCalledWith({ accountHolderName: 'محمد أحمد', iban: VALID_IBAN, bankName: 'مصرف الراجحي' });
      expect(component.toastMsg()).toContain('للمراجعة');
      expect(component.currentStep()).toBe(5);
      render();
      expect(el().querySelector('[data-testid="bank-state"]')!.textContent).toContain('قيد المراجعة');
      expect(el().querySelector('[data-testid="bank-state"]')!.textContent).not.toContain('لم يُضف');
      expect(el().querySelector('.cbx-item[data-key="iban"]')!.getAttribute('data-status')).toBe('pending_review');
    });


    it('zod errors[] from the server land on the matching input; the English 400 is never shown', () => {
      svc.updateBankInfo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Validation Error', errors: [{ path: 'body.iban', message: 'رقم IBAN غير صحيح' }] } })));
      goTo(4);
      fillBank();
      component.saveBankInfo();
      render();
      expect(component.bankForm.get('iban')!.errors?.['server']).toBe('رقم IBAN غير صحيح');
      expect(errors().some(t => t.includes('رقم IBAN غير صحيح'))).toBe(true);
      expect(component.isSubmitting()).toBe(false);
    });

    it('409 "a change request is already pending" shows the server message (Arabic) and stays on the step', () => {
      const notify = TestBed.inject(UiNotificationService);
      svc.updateBankInfo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'يوجد طلب تعديل معلّق بالفعل لـ: iban' } })));
      goTo(4);
      fillBank();
      component.saveBankInfo();
      expect(notify.toasts().at(-1)!.message).toContain('طلب تعديل معلّق');
      expect(component.currentStep()).toBe(4);
      expect(component.bankReviewState()).toBe('لم يُضف');
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
    component.saveBankInfo();
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
