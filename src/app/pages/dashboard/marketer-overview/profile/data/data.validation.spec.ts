import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Data } from './data';
import { MarketerOverviewService } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

const PROFILE = {
  id: 'p1', referralSlug: 'abc', completionPercentage: 40, marketingChannels: [{ id: 'c1', platform: 'LINKEDIN', handle: 'x', createdAt: '' }],
  bio: 'نبذة', avatarUrl: '', paypalPayoutEmail: 'm@example.com',
  user: { firstName: 'محمد', lastName: 'أحمد', email: 'm@x.com', phoneNumber: '501234567', phoneCountryCode: '+966', idNumber: '1234567890' },
};

const httpErr = (status: number, body: any) => throwError(() => new HttpErrorResponse({ status, error: body }));
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('Data (marketer profile): shared validation', () => {
  let fixture: ComponentFixture<Data>;
  let c: Data;
  let svc: any;
  let prefs: any;

  beforeEach(async () => {
    svc = {
      getProfile: vi.fn(() => of({ success: true, data: PROFILE })),
      updateMarketingInfo: vi.fn(() => of({ success: true })),
      addChannel: vi.fn(() => of({ success: true })),
      removeChannel: vi.fn(() => of({ success: true })),
      updatePaypalPayout: vi.fn(() => of({ success: true, data: { paypalPayoutEmail: 'new@example.com' } })),
      createIdentityRequest: vi.fn(() => of({ success: true, data: [] })),
      changePassword: vi.fn(() => of({ success: true })),
    };
    prefs = { getPreferences: vi.fn(() => of({ success: true, data: {} })), updatePreferences: vi.fn(() => of({ success: true })) };
    await TestBed.configureTestingModule({
      imports: [Data],
      providers: [
        provideRouter([]),
        { provide: MarketerOverviewService, useValue: {
          getSummary: () => of({ success: true, data: {} }),
          getChannelPerformance: () => of({ success: true, data: [] }),
          getRecentCommissions: () => of({ success: true, data: [] }),
        } },
        { provide: MarketerProfileService, useValue: svc },
        { provide: NotificationPreferencesService, useValue: prefs },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Data);
    c = fixture.componentInstance;
    fixture.detectChanges();
    document.body.appendChild(el());
  });
  afterEach(() => { el().remove(); TestBed.inject(UiNotificationService).clearAll(); });

  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const goTo = (tab: string) => { c.setActiveTab(tab); render(); };
  const summary = () => el().querySelector('[data-testid="form-summary"]')?.textContent || '';
  const errors = () => Array.from(el().querySelectorAll('[data-testid="field-error"]')).map(e => e.textContent || '');
  const notice = () => el().querySelector('[data-testid="tab-notice"]')?.textContent || '';
  const btn = (text: string) => Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes(text)) as HTMLButtonElement;
  const toasts = () => TestBed.inject(UiNotificationService).toasts().map(t => t.message).join(' | ');
  const hasEnglish = (s: string) => /[A-Za-z]{4,}/.test(s.replace(/PayPal|LinkedIn/g, ''));

  it('should create and load the profile into the forms', () => {
    expect(c).toBeTruthy();
    expect(c.paypalForm.value.paypalPayoutEmail).toBe('m@example.com');
    expect(c.basicsForm.value.firstName).toBe('محمد');
  });

  describe('profile tab (bio, channel, avatar)', () => {
    it('bio over 500 chars: no request, summary + inline error + focus, button enabled', () => {
      c.marketingForm.patchValue({ bio: 'x'.repeat(501) });
      render();
      c.submitMarketingProfile();
      render();
      expect(svc.updateMarketingInfo).not.toHaveBeenCalled();
      expect(summary()).toContain('الوصف التسويقي');
      expect(errors().some(t => t.includes('500') || t.includes('يزيد'))).toBe(true);
      expect(document.activeElement?.id).toBe('af-bio');
      expect(btn('حفظ الملف التسويقي').disabled).toBe(false);
    });

    it('valid bio saves', () => {
      c.submitMarketingProfile();
      expect(svc.updateMarketingInfo).toHaveBeenCalled();
    });

    it('add channel with nothing chosen: no request, summary, inline errors, focus on platform, button enabled', () => {
      c.channelForm.reset({ platform: '', handle: '' });
      c.addChannel();
      render();
      expect(svc.addChannel).not.toHaveBeenCalled();
      expect(summary()).toContain('نوع القناة');
      expect(summary()).toContain('معرّف القناة');
      expect(errors().some(t => t.includes('اختر نوع القناة'))).toBe(true);
      expect(errors().some(t => t.includes('أدخل معرّف القناة'))).toBe(true);
      expect(document.activeElement?.getAttribute('formcontrolname')).toBe('platform');
      expect(btn('اضافة').disabled).toBe(false);
    });

    it('whitespace-only handle is treated as missing', () => {
      c.channelForm.patchValue({ platform: 'LINKEDIN', handle: '   ' });
      c.addChannel();
      expect(svc.addChannel).not.toHaveBeenCalled();
    });

    it('channel server 500 (English text) shows Arabic only and keeps the form', () => {
      svc.addChannel.mockReturnValue(httpErr(500, { message: 'Internal Server Error' }));
      c.channelForm.patchValue({ platform: 'LINKEDIN', handle: 'abc' });
      c.addChannel();
      expect(hasEnglish(toasts())).toBe(false);
      expect(toasts()).toContain('الخادم');
      expect(c.channelForm.value.handle).toBe('abc');
    });

    it('channel zod 400 puts the Arabic message on the handle field', () => {
      svc.addChannel.mockReturnValue(httpErr(400, { message: 'Validation Error', errors: [{ field: 'handle', message: 'String must contain at most 50 character(s)' }] }));
      c.channelForm.patchValue({ platform: 'LINKEDIN', handle: 'abc' });
      c.addChannel();
      render();
      expect(c.channelForm.get('handle')!.errors?.['server']).toContain('معرّف القناة');
      expect(errors().some(t => t.includes('معرّف القناة') && t.includes('50'))).toBe(true);
    });

    it('channel edit stays disabled with a visible reason', () => {
      expect(el().querySelector('[data-testid="channel-edit-note"]')?.textContent).toContain('غير متاح');
      expect((el().querySelector('.channel-edit') as HTMLButtonElement).disabled).toBe(true);
    });

    it('avatar: wrong type is rejected inline, nothing is sent', () => {
      const input = { files: [{ name: 'a.gif', type: 'image/gif', size: 100 }], value: 'x' } as any;
      c.onAvatarChange({ target: input } as any);
      render();
      expect(svc.updateMarketingInfo).not.toHaveBeenCalled();
      expect(el().querySelector('[data-testid="avatar-error"]')?.textContent).toContain('نوع الملف');
    });

    it('avatar: too large is rejected inline', () => {
      const input = { files: [{ name: 'a.png', type: 'image/png', size: 6 * 1024 * 1024 }], value: 'x' } as any;
      c.onAvatarChange({ target: input } as any);
      expect(c.avatarError()).toContain('5');
      expect(svc.updateMarketingInfo).not.toHaveBeenCalled();
    });

    it('remove avatar with no avatar does not fake a deletion', () => {
      c.removeAvatar();
      expect(svc.updateMarketingInfo).not.toHaveBeenCalled();
      expect(c.avatarError()).toContain('لا توجد صورة');
      expect(c.toastMessage()).toBeNull();
    });
  });

  describe('basics tab (identity change request)', () => {
    beforeEach(() => goTo('basics'));

    it('no mandatory marker on read-only email or on the optional phone', () => {
      expect(el().querySelector('label[for="af-email"] .req')).toBeNull();
      expect(el().querySelector('label[for="af-phone"] .req')).toBeNull();
      expect(el().querySelector('[data-testid="email-readonly-hint"]')?.textContent).toContain('لا يمكن');
    });

    it('over-long values: no request, summary, inline errors, focus, button enabled', () => {
      c.basicsForm.patchValue({ firstName: 'x'.repeat(51), phoneNumber: '1'.repeat(21) });
      render();
      c.submitBasicsChangeRequest();
      render();
      expect(svc.createIdentityRequest).not.toHaveBeenCalled();
      expect(summary()).toContain('الاسم الأول');
      expect(summary()).toContain('رقم الجوال');
      expect(errors().length).toBeGreaterThanOrEqual(2);
      expect(document.activeElement?.id).toBe('af-fname');
      expect(btn('إرسال طلب تعديل').disabled).toBe(false);
    });

    it('national id accepts up to 20 chars (no maxlength=10) and says so', () => {
      const nid = el().querySelector('#af-nid') as HTMLInputElement;
      expect(nid.getAttribute('maxlength')).toBeNull();
      c.basicsForm.patchValue({ nationalId: '1'.repeat(15) });
      expect(c.basicsForm.get('nationalId')!.valid).toBe(true);
    });

    it('nothing changed: blocked with a visible Arabic message, no request', () => {
      c.submitBasicsChangeRequest();
      render();
      expect(svc.createIdentityRequest).not.toHaveBeenCalled();
      expect(notice()).toContain('لم تغيّر');
      expect(btn('إرسال طلب تعديل').disabled).toBe(false);
    });

    it('everything cleared: asks for at least one value', () => {
      c.basicsForm.patchValue({ firstName: '', lastName: '', nationalId: '', phoneNumber: '' });
      c.submitBasicsChangeRequest();
      render();
      expect(svc.createIdentityRequest).not.toHaveBeenCalled();
      expect(notice()).toContain('قيمة جديدة');
    });

    it('a changed value is sent and a persistent "قيد المراجعة" note appears', () => {
      c.basicsForm.patchValue({ firstName: ' علي ' });
      c.submitBasicsChangeRequest();
      render();
      expect(svc.createIdentityRequest).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'علي' }));
      expect(el().querySelector('[data-testid="identity-pending"]')?.textContent).toContain('قيد مراجعة الإدارة');
    });

    it('409 pending request: Arabic message kept next to the button, no pending flag', () => {
      svc.createIdentityRequest.mockReturnValue(httpErr(409, { message: 'يوجد طلب تعديل معلّق بالفعل لـ: الاسم الأول' }));
      c.basicsForm.patchValue({ firstName: 'علي' });
      c.submitBasicsChangeRequest();
      render();
      expect(notice()).toContain('معلّق بالفعل');
      expect(c.identityPending()).toBe(false);
    });

    it('400 "no change" from the server stays visible in Arabic', () => {
      svc.createIdentityRequest.mockReturnValue(httpErr(400, { message: 'لم يتم إجراء أي تغيير على الحقول المطلوبة' }));
      c.basicsForm.patchValue({ firstName: 'علي' });
      c.submitBasicsChangeRequest();
      render();
      expect(notice()).toContain('لم يتم إجراء أي تغيير');
    });

    it('zod 400 (English) lands on the right field in Arabic', async () => {
      svc.createIdentityRequest.mockReturnValue(httpErr(400, { message: 'Validation Error', errors: [{ path: ['phoneNumber'], message: 'String must contain at most 20 character(s)' }] }));
      c.basicsForm.patchValue({ phoneNumber: '123' });
      c.submitBasicsChangeRequest();
      render();
      expect(c.basicsForm.get('phoneNumber')!.errors?.['server']).toContain('رقم الجوال');
      expect(hasEnglish(c.basicsForm.get('phoneNumber')!.errors?.['server'])).toBe(false);
      await wait(100);
      expect(document.activeElement?.id).toBe('af-phone');
    });

    it('nationality is disabled with a visible reason (it is never sent)', () => {
      expect((el().querySelector('#af-nat') as HTMLSelectElement).disabled).toBe(true);
      expect(el().querySelector('[data-testid="nationality-note"]')?.textContent).toContain('غير متاح');
    });
  });

  describe('PayPal tab (the only payout destination)', () => {
    beforeEach(() => goTo('banking'));
    const saveBtn = () => btn('حفظ بريد PayPal');

    it('shows only the PayPal email: no bank, IBAN, holder, swift, wallet or document inputs', () => {
      const text = el().textContent || '';
      expect((el().querySelector('#afpp-email') as HTMLInputElement).value).toBe('m@example.com');
      expect(text).not.toMatch(/IBAN|اسم البنك|الحساب البنكي|البيانات البنكية|صاحب الحساب|السويفت|محفظة/);
      for (const n of ['iban', 'bankName', 'accountHolderName', 'swiftCode']) expect(el().querySelector(`[formcontrolname="${n}"]`), n).toBeNull();
      expect(el().querySelector('#afdoc-front')).toBeNull();
    });

    it('an invalid email is not sent and is explained in Arabic', () => {
      c.paypalForm.patchValue({ paypalPayoutEmail: 'not-an-email' });
      c.savePaypal(); render();
      expect(svc.updatePaypalPayout).not.toHaveBeenCalled();
      expect(errors().some(t => t.includes('بريد PayPal صالحًا'))).toBe(true);
      expect(saveBtn().disabled).toBe(false);
    });

    it('a valid email is saved at once (no governed modal) and only the email is sent', () => {
      c.paypalForm.patchValue({ paypalPayoutEmail: 'new@example.com' });
      c.savePaypal(); render();
      expect(svc.updatePaypalPayout).toHaveBeenCalledWith('new@example.com');
      expect(c.toastMessage()?.text).toBe('تم حفظ بريد PayPal');
      expect(el().querySelector('.modal-ov')).toBeNull();
    });

    it('an empty email removes the saved one', () => {
      c.paypalForm.patchValue({ paypalPayoutEmail: '' });
      c.savePaypal(); render();
      expect(svc.updatePaypalPayout).toHaveBeenCalledWith('');
      expect(c.toastMessage()?.text).toBe('تم إزالة بريد PayPal');
    });

    it('a server 400 (zod errors[]) lands on the PayPal field in Arabic', () => {
      svc.updatePaypalPayout.mockReturnValue(httpErr(400, { message: 'Validation Error', errors: [{ path: ['body', 'paypalPayoutEmail'], message: 'أدخل بريد PayPal صالحًا مثل name@example.com' }] }));
      c.paypalForm.patchValue({ paypalPayoutEmail: 'new@example.com' });
      c.savePaypal(); render();
      expect(c.paypalForm.get('paypalPayoutEmail')!.errors?.['server']).toBeTruthy();
      expect(errors().some(t => t.includes('بريد PayPal صالحًا'))).toBe(true);
    });
  });

  describe('referral tab', () => {
    beforeEach(() => goTo('referral'));

    it('the message textarea and its save button are disabled with a visible reason', () => {
      expect((el().querySelector('#aff-desc') as HTMLTextAreaElement).disabled).toBe(true);
      expect(btn('حفظ بيانات الاحالة').disabled).toBe(true);
      expect(el().querySelector('[data-testid="referral-save-note"]')?.textContent).toContain('غير متاح');
    });

    it('copy failure is reported in Arabic', async () => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
      c.copyToClipboard('abc', 'code');
      await wait(10);
      expect(toasts()).toContain('تعذّر النسخ');
    });
  });

  describe('security tab (password)', () => {
    beforeEach(() => { goTo('security'); c.passwordFormVisible.set(true); render(); });
    const fill = (cur: string, nw: string, conf = nw) => c.passwordForm.patchValue({ currentPassword: cur, newPassword: nw, confirmPassword: conf });
    const saveBtn = () => btn('حفظ كلمة المرور الجديدة');

    it('empty: no request, summary names all three, inline errors, focus on the first, button enabled', () => {
      c.changePassword();
      render();
      expect(svc.changePassword).not.toHaveBeenCalled();
      expect(summary()).toContain('كلمة المرور الحالية');
      expect(summary()).toContain('كلمة المرور الجديدة');
      expect(summary()).toContain('تأكيد كلمة المرور الجديدة');
      expect(document.activeElement?.id).toBe('mkt-pwd-old');
      expect(saveBtn().disabled).toBe(false);
    });

    it('fewer than 3 character groups is explained inline', () => {
      fill('Old12345!', 'abcdefgh1');
      c.changePassword();
      render();
      expect(svc.changePassword).not.toHaveBeenCalled();
      expect(errors().some(t => t.includes('ثلاثة أنواع'))).toBe(true);
    });

    it('over 72 chars is rejected', () => {
      fill('Old12345!', 'Aa1!' + 'x'.repeat(70));
      c.changePassword();
      expect(svc.changePassword).not.toHaveBeenCalled();
      expect(c.passwordForm.get('newPassword')!.errors?.['maxlength']).toBeTruthy();
    });

    it('mismatch is shown on the confirmation field', () => {
      fill('Old12345!', 'Newpass1!', 'Different1!');
      c.changePassword();
      render();
      expect(svc.changePassword).not.toHaveBeenCalled();
      expect(errors().some(t => t.includes('غير متطابقتين'))).toBe(true);
      expect(summary()).toContain('تأكيد كلمة المرور الجديدة');
    });

    it('a valid change is sent and the form closes', () => {
      fill('Old12345!', 'Newpass1!');
      c.changePassword();
      expect(svc.changePassword).toHaveBeenCalledWith('Old12345!', 'Newpass1!');
      expect(c.passwordFormVisible()).toBe(false);
    });

    it('CURRENT_PASSWORD_INCORRECT (401): Arabic message on the current-password field, stays on the tab', async () => {
      svc.changePassword.mockReturnValue(httpErr(401, { success: false, message: 'CURRENT_PASSWORD_INCORRECT' }));
      fill('Wrong123!', 'Newpass1!');
      c.changePassword();
      render();
      expect(c.activeTab()).toBe('security');
      expect(c.passwordForm.get('currentPassword')!.errors?.['server']).toBe('كلمة المرور الحالية غير صحيحة');
      expect(errors().some(t => t.includes('غير صحيحة'))).toBe(true);
      await wait(100);
      expect(document.activeElement?.id).toBe('mkt-pwd-old');
      expect(c.passwordFormVisible()).toBe(true);
    });

    it('PASSWORD_UNCHANGED (400): message on the new-password field', () => {
      svc.changePassword.mockReturnValue(httpErr(400, { success: false, message: 'PASSWORD_UNCHANGED' }));
      fill('Same123!x', 'Same123!x');
      c.changePassword();
      render();
      expect(c.passwordForm.get('newPassword')!.errors?.['server']).toContain('تختلف');
    });

    it('WEAK_PASSWORD (400): the backend real rule (3 groups, 8-72) is stated', () => {
      svc.changePassword.mockReturnValue(httpErr(400, { success: false, message: 'WEAK_PASSWORD' }));
      fill('Old12345!', 'Newpass1!');
      c.changePassword();
      expect(c.passwordForm.get('newPassword')!.errors?.['server']).toContain('ثلاثة أنواع');
    });

    it('network failure: Arabic toast, form kept', () => {
      svc.changePassword.mockReturnValue(httpErr(0, null));
      fill('Old12345!', 'Newpass1!');
      c.changePassword();
      expect(toasts()).toContain('الاتصال');
      expect(c.passwordFormVisible()).toBe(true);
    });
  });

  describe('alerts', () => {
    beforeEach(() => goTo('security'));

    it('server error shows the mapped Arabic message, not a generic one', () => {
      prefs.updatePreferences.mockReturnValue(httpErr(429, { message: 'Too many requests, please try again after 15 minutes' }));
      c.saveAlertPreferences();
      expect(toasts()).toContain('15 دقيقة');
      expect(hasEnglish(toasts())).toBe(false);
    });

    it('success toast, button never disabled while idle', () => {
      c.saveAlertPreferences();
      expect(c.toastMessage()?.text).toContain('تم حفظ');
      expect(btn('حفظ الإعدادات').disabled).toBe(false);
    });

    it('failed preference load is explained', () => {
      c.alertsLoadFailed.set(true);
      render();
      expect(el().querySelector('[data-testid="alerts-load-note"]')?.textContent).toContain('الافتراضية');
    });
  });

  it('an older success toast timer does not clear a newer toast', async () => {
    vi.useFakeTimers();
    try {
      c.saveAlertPreferences();
      vi.advanceTimersByTime(2000);
      c.saveAlertPreferences();
      vi.advanceTimersByTime(2000);
      expect(c.toastMessage()).not.toBeNull();
      vi.advanceTimersByTime(1500);
      expect(c.toastMessage()).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});
