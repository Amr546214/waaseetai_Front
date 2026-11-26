import { LegalNameService } from '../../../../../core/services/legal-name.service';
import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
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
      providers: [{ provide: LegalNameService, useValue: { get: () => of({ success: true, data: { status: 'PROVIDED', legalName: 'اسم هوية محفوظ', changeNeedsReview: false, pendingRequest: null } }) } }, provideRouter([]), { provide: MarketerProfileService, useValue: svc }],
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
  // navigation by the bar is gated by the required items (tested in profile-setup.required.spec.ts); these specs test what each step does, so they place the wizard on it
  const goTo = (step: number) => { component.currentStep.set(step); render(); };
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

    it('the step says one valid channel is required (any platform), and how to add it', () => {
      goTo(3);
      expect(el().textContent).not.toContain('تخطي');
      expect(el().textContent).toContain('قناة واحدة صالحة تكفي');
      expect(el().textContent).toContain('اضغط "إضافة ومتابعة"');
    });

    it('a valid channel is sent and the wizard moves on', () => {
      goTo(3);
      component.channelForm.patchValue({ platform: 'LINKEDIN', handle: 'https://linkedin.com/in/x' });
      component.addChannel();
      expect(svc.addChannel).toHaveBeenCalledWith({ platform: 'LINKEDIN', handle: 'https://linkedin.com/in/x', setup: true });
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
    it('a bio over the 500-character limit is explained and not sent', () => {
      goTo(2);
      component.marketingForm.get('bio')!.setValue('x'.repeat(501));
      component.saveBio(); render();
      expect(svc.updateMarketingInfo).not.toHaveBeenCalled();
      expect(errors().some(t => t.includes('500'))).toBe(true);
      expect(summary()).toContain('الوصف التسويقي');
    });

    it('an empty bio is NOT valid any more: nothing is sent and the message is under the bio', () => {
      goTo(2);
      component.saveBio(); render();
      expect(svc.updateMarketingInfo).not.toHaveBeenCalled();
      expect(errors().some(t => t.includes('الوصف التسويقي مطلوب'))).toBe(true);
    });
  });

  it('moving between steps clears the previous summary', () => {
    goTo(4);
    component.savePaypal();
    expect(component.missing().length).toBeGreaterThan(0);
    component.prevStep();
    expect(component.missing()).toEqual([]);
  });

  it('finishing the setup reports success centrally, then returns to the overview', () => {
    vi.useFakeTimers();
    try {
      const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      // the three required items are in place (a saved avatar, bio and one channel)
      component.profile.set({ avatarUrl: 'data:image/png;base64,AAA', bio: 'وصف تسويقي', marketingChannels: [{ id: 'c1', platform: 'TIKTOK', handle: 'x' }] } as any);
      component.finish();
      expect(TestBed.inject(UiNotificationService).toasts().at(-1)).toMatchObject({ kind: 'success', message: 'تم استكمال بياناتك بنجاح' });
      vi.advanceTimersByTime(1200);
      expect(nav).toHaveBeenCalledWith(['/marketer-overview']);
    } finally { vi.useRealTimers(); }
  });
});
