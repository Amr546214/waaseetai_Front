import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TourService } from '../../../../../core/tour/tour.service';
import { CLIENT_PROFILE_EDIT_TOUR } from '../../../../../core/tour/tours/client-profile-edit.tour';
import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';
import { MB } from '../../../../../core/forms/file-validation';

// Client profile/edit tabs: shared validation UX, and honest handling of what the backend does not save.
describe('client profile-edit: shared validation', () => {
  let fixture: ComponentFixture<ProfileEdit>;
  let component: ProfileEdit;
  let updateTab: ReturnType<typeof vi.fn>;
  let updateProfile: ReturnType<typeof vi.fn>;
  let getPrefs: ReturnType<typeof vi.fn<(...a: any[]) => any>>;
  let updatePrefs: ReturnType<typeof vi.fn<(...a: any[]) => any>>;
  let profileData: any;
  let suggestBio: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

  async function configure(accountType: string, over: { profile?: any; prefs?: any } = {}) {
    updateTab = vi.fn(() => of({ success: true, message: 'تم التحديث. التعديلات الحساسة تتطلب التحقق.' }));
    updateProfile = vi.fn(() => of({ success: true }));
    suggestBio = vi.fn(() => of({ success: true, data: { suggestedBio: 'أنا مهندس أطلب خدمات تصميم.' } }));
    getPrefs = vi.fn(() => of({ success: true, data: { settings: {} } }));
    updatePrefs = vi.fn(() => of({ success: true, data: { settings: {} } }));
    profileData = { firstName: 'سارة', lastName: 'أحمد', email: 'a@b.co', phoneNumber: '+966551234567', country: 'السعودية', city: 'الرياض', ...(over.profile || {}) };
    if (over.prefs) getPrefs = vi.fn(() => over.prefs);
    await TestBed.configureTestingModule({
      imports: [ProfileEdit],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType, activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
        { provide: NotificationPreferencesService, useValue: { getPreferences: () => getPrefs(), updatePreferences: (x: any) => updatePrefs(x) } },
        {
          provide: ProfileApiService,
          useValue: {
            getMyProfile: () => of({ success: true, data: { currentProfileData: profileData, latestHistory: [] } }),
            getChangeRequests: () => of({ success: true, data: [] }), getMyChangeRequests: () => of({ success: true, data: [] }),
            updateTab, updateProfile, suggestClientBio: (x: any) => suggestBio(x),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileEdit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => { await configure('CLIENT_INDIVIDUAL'); });

  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const goTab = (t: any) => { component.switchTab(t); render(); };
  const summary = () => el().querySelector('[data-testid="form-summary"]')?.textContent || '';
  const errors = () => Array.from(el().querySelectorAll('[data-testid="field-error"]')).map(e => e.textContent || '');
  const submitBtn = () => el().querySelector('form button[type="submit"]') as HTMLButtonElement;

  describe('profile tab', () => {
    it('an invalid company website (company account): no request, summary + inline Arabic error, button enabled', async () => {
      TestBed.resetTestingModule();
      await configure('CLIENT_COMPANY');
      component.clientForm.get('website')!.setValue('mysite.com'); // no scheme
      component.saveProfile(); render();
      expect(updateProfile).not.toHaveBeenCalled();
      expect(summary()).toContain('موقع الشركة');
      expect(errors().some(t => t.includes('http'))).toBe(true);
      expect(submitBtn().disabled).toBe(false);
    });

    it('a bio over the 1000-character backend limit is explained and not sent', () => {
      component.clientForm.get('bio')!.setValue('x'.repeat(1001));
      component.saveProfile(); render();
      expect(updateProfile).not.toHaveBeenCalled();
      expect(errors().some(t => t.includes('1000'))).toBe(true);
    });

    it('a valid save sends the bio, interests, links and display prefs (all stored for a client now), never provider-only fields', () => {
      component.clientForm.patchValue({ companyName: 'شركة', bio: 'نبذة', website: 'https://example.com', linkedinUrl: 'https://linkedin.com/in/x', portfolioUrl: 'https://p.example.com', personalWebsiteUrl: 'https://me.example.com', interfaceLanguage: 'English', timezone: '(GMT+4) توقيت دبي' });
      component.interests.set(['تصميم', 'برمجة']);
      component.saveProfile();
      expect(updateProfile).toHaveBeenCalledTimes(1);
      const body = updateProfile.mock.calls[0][0];
      expect(body).toEqual(expect.objectContaining({ companyName: 'شركة', bio: 'نبذة', website: 'https://example.com', linkedinUrl: 'https://linkedin.com/in/x', portfolioUrl: 'https://p.example.com', personalWebsiteUrl: 'https://me.example.com', interfaceLanguage: 'English', timezone: '(GMT+4) توقيت دبي', interests: ['تصميم', 'برمجة'] }));
      for (const k of ['skills', 'hourlyRate', 'experienceLevel']) expect(body, k).not.toHaveProperty(k);
    });

    it('the sections are live: no disabled fieldset, no "not saved" notice, the link inputs are enabled', () => {
      expect(el().querySelector('[data-testid="unsaved-sections"]')).toBeNull();
      expect(el().querySelector('[data-testid="unsaved-notice"]')).toBeNull();
      expect(el().textContent).not.toContain('لا تُحفظ حاليًا');
      for (const name of ['portfolioUrl', 'linkedinUrl', 'personalWebsiteUrl', 'interfaceLanguage', 'timezone']) {
        const input = el().querySelector(`[formcontrolname="${name}"]`) as HTMLInputElement;
        expect(input, name).toBeTruthy();
        expect(input.disabled, name).toBe(false);
        expect(input.closest('fieldset[disabled]'), name).toBeNull();
      }
    });

    it('server zod errors land on the field (400 with errors[]); a 500 is shown in Arabic', () => {
      updateProfile.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Validation Error', errors: [{ path: 'body.website', message: 'رابط الموقع غير صحيح' }] } })));
      component.clientForm.patchValue({ website: 'https://example.com' });
      vi.useFakeTimers();
      component.saveProfile();
      vi.advanceTimersByTime(100);
      expect(component.clientForm.get('website')!.errors?.['server']).toBe('رابط الموقع غير صحيح');
      expect(component.errorMsg()).not.toMatch(/[A-Za-z]/);
      updateProfile.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Internal Server Error' } })));
      component.clientForm.get('website')!.setValue('https://example.org');
      component.saveProfile();
      expect(component.errorMsg()).not.toMatch(/[A-Za-z]/);
      expect(component.isSaving()).toBe(false);
      vi.useRealTimers();
    });

    it('an oversize or non-image avatar is rejected with an Arabic message', () => {
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [new File([new Uint8Array(6 * MB)], 'a.png', { type: 'image/png' })] });
      component.onAvatarUpload({ target: input } as unknown as Event);
      expect(component.errorMsg()).toContain('حجم الملف كبير جدًا');
      const input2 = document.createElement('input');
      Object.defineProperty(input2, 'files', { value: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] });
      component.onAvatarUpload({ target: input2 } as unknown as Event);
      expect(component.errorMsg()).toContain('نوع الملف غير مسموح');
      expect(updateProfile).not.toHaveBeenCalled();
    });
  });

  describe('basics tab', () => {
    beforeEach(() => goTab('basics'));

    it('the display name is ONE username field (a single word is fine) saved on its own; the old first/last inputs are gone from this form', () => {
      expect(el().querySelector('ws-username-field')).not.toBeNull();
      expect(el().querySelector('[formControlName="firstName"]')).toBeNull();
      expect(el().querySelector('[formControlName="lastName"]')).toBeNull();
    });

    it('email and phone are read-only (disabled, labelled), and only the name is sent', () => {
      expect(component.basicsForm.get('email')!.disabled).toBe(true);
      expect(component.basicsForm.get('phoneNumber')!.disabled).toBe(true);
      expect(el().querySelector('[data-testid="basics-note"]')?.textContent).toContain('طلب تعديل');
      expect(el().textContent).toContain('(للقراءة فقط)');
      component.saveTab('basics');
      expect(updateTab).toHaveBeenCalledWith('basics', { firstName: 'سارة', lastName: 'أحمد' });
    });

    it('the success message is accurate: a name change is a request sent for review, not a save', () => {
      updateTab.mockReturnValueOnce(of({ success: true, message: 'تم إرسال طلب تعديل البيانات الأساسية للمراجعة', data: { isPendingRequest: true, requestId: 'r1' } }));
      component.saveTab('basics');
      expect(component.successMsg()).toBe('تم إرسال طلب تعديل البيانات الأساسية للمراجعة');
    });

    it('the result is visible on the basics tab itself (banners are not limited to the profile tab)', () => {
      updateTab.mockReturnValueOnce(of({ success: true, message: 'تم إرسال طلب تعديل البيانات الأساسية للمراجعة', data: { isPendingRequest: true, requestId: 'r1' } }));
      component.saveTab('basics'); render();
      expect(el().querySelector('[data-testid="tab-success"]')?.textContent).toContain('تم إرسال طلب تعديل');
    });
  });

  describe('contact tab', () => {
    beforeEach(() => goTab('contact'));

    it('the optional WhatsApp field does NOT block saving when empty; only WhatsApp + city are sent', () => {
      component.contactForm.patchValue({ alternativePhone: '' });
      component.saveTab('contact');
      expect(updateTab).toHaveBeenCalledTimes(1);
      expect(updateTab.mock.calls[0][0]).toBe('contact');
      expect(Object.keys(updateTab.mock.calls[0][1]).sort()).toEqual(['alternativePhone', 'city']);
      expect(component.successMsg()).toContain('WhatsApp');
    });

    it('email, phone and country carry no required marker; the note says what is saved', () => {
      const text = el().textContent || '';
      expect(el().querySelector('[data-testid="contact-note"]')?.textContent).toContain('رقم WhatsApp ومدينة الإقامة فقط');
      expect(component.contactForm.get('email')!.disabled).toBe(true);
      expect(text).toContain('(للقراءة فقط)');
    });

    it('a missing city (country chosen) blocks with a summary and an inline message', () => {
      component.contactForm.patchValue({ country: 'السعودية' });
      component.contactForm.get('city')!.setValue('');
      component.saveTab('contact'); render();
      expect(updateTab).not.toHaveBeenCalled();
      expect(summary()).toContain('مدينة الإقامة');
      expect(errors().some(t => t.includes('اختر مدينة الإقامة'))).toBe(true);
    });

    it('a server error is shown in Arabic and keeps the form', () => {
      updateTab.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429, error: { message: 'Too many requests from this IP, please try again after 15 minutes' } })));
      component.contactForm.patchValue({ alternativePhone: '' });
      component.saveTab('contact');
      expect(component.errorMsg()).toContain('15 دقيقة');
      expect(component.errorMsg()).not.toMatch(/[A-Za-z]/);
    });
  });

  describe('public profile: interests / links / prefs persist and failures are honest', () => {
    it('after a reload the saved bio, interests, links and prefs are shown again (read from GET /profiles/me)', async () => {
      TestBed.resetTestingModule();
      // a fresh page load fed by what the backend returns after the earlier save
      await configure('CLIENT_INDIVIDUAL', {
        profile: { bio: 'عميل مهتم بالتصميم', interests: ['تصميم', 'برمجة'], portfolioUrl: 'https://p.example.com', linkedinUrl: 'https://linkedin.com/in/x', personalWebsiteUrl: 'https://me.example.com', interfaceLanguage: 'English', timezone: '(GMT+4) توقيت دبي' },
        prefs: of({ success: true, data: { settings: { channel_email: false, channel_in_app: true } } }),
      });
      expect(component.clientForm.value).toEqual(expect.objectContaining({ bio: 'عميل مهتم بالتصميم', portfolioUrl: 'https://p.example.com', linkedinUrl: 'https://linkedin.com/in/x', personalWebsiteUrl: 'https://me.example.com', interfaceLanguage: 'English', timezone: '(GMT+4) توقيت دبي' }));
      expect(component.interests()).toEqual(['تصميم', 'برمجة']);
      expect(component.notifEmail()).toBe(false);
      expect(component.notifInApp()).toBe(true);
    });

    it('a never-saved language / timezone keeps the form defaults (no empty select)', () => {
      expect(component.clientForm.value.interfaceLanguage).toBe('العربية');
      expect(component.clientForm.value.timezone).toBe('(GMT+3) توقيت الرياض');
    });

    it('adding an interest in the UI is part of the next save and removing one is too', () => {
      const input = document.createElement('input'); input.value = ' تسويق ';
      component.addInterest(input);
      expect(component.interests()).toContain('تسويق');
      component.removeInterest('تسويق');
      component.clientForm.patchValue({ bio: 'تغيير' }); // an unchanged form is no longer sent (K-1)
      component.saveProfile();
      // each interest change is saved on its own at once (add, then remove); the form save that follows carries the final list
      expect(updateProfile.mock.calls[0][0]).toEqual({ interests: expect.arrayContaining(['تسويق']) });
      expect(updateProfile.mock.calls[1][0].interests).not.toContain('تسويق');
      expect(updateProfile.mock.calls.at(-1)![0].interests).not.toContain('تسويق');
    });

    it('success is shown only after the profile AND the notification preferences are stored', () => {
      component.notifEmail.set(true); // a changed toggle is what gets written (K-1)
      component.saveProfile();
      expect(updatePrefs).toHaveBeenCalledWith({ channel_email: true, channel_in_app: true });
      expect(component.successMsg()).toContain('تم تحديث');
      expect(component.errorMsg()).toBe('');
    });

    it('a failed profile save is an error and never a success (the preferences are not even sent)', () => {
      updateProfile.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'x' } })));
      component.clientForm.patchValue({ bio: 'تغيير' });
      component.notifEmail.set(true);
      component.saveProfile();
      expect(component.successMsg()).toBe('');
      expect(component.errorMsg()).not.toBe('');
      expect(updatePrefs).not.toHaveBeenCalled();
    });

    it('profile saved but preferences failed: an explicit error that says what was and was not saved, no success', () => {
      updatePrefs.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.notifEmail.set(true);
      component.saveProfile();
      expect(component.successMsg()).toBe('');
      expect(component.errorMsg()).toContain('تم حفظ بيانات الملف');
      expect(component.errorMsg()).toContain('تفضيلات الإشعارات');
    });

    it('preferences that could not be loaded are not editable and are never overwritten on save', async () => {
      TestBed.resetTestingModule();
      await configure('CLIENT_INDIVIDUAL', { prefs: throwError(() => new HttpErrorResponse({ status: 500 })) });
      expect(component.prefsState()).toBe('error');
      render();
      expect(el().querySelector('[data-testid="prefs-load-error"]')).toBeTruthy();
      expect((el().querySelector('[data-testid="notif-email"]') as HTMLInputElement).disabled).toBe(true);
      component.saveProfile();
      expect(updatePrefs).not.toHaveBeenCalled();
    });

    it('the notification / display text says these are account preferences only, and does not claim they stop sending', () => {
      const hintElement = el().querySelector('[data-testid="prefs-hint"]')!;
      const hint = hintElement.textContent || '';
      expect(hintElement.closest('details')?.open).toBe(false);
      expect(hint).toContain('تفضيلات حساب');
      expect(hint).toContain('لا توقف إرسال الإشعارات إلى مركز الإشعارات');
      expect(el().textContent).not.toMatch(/توقف(ها)? الإشعارات فورًا|لن تصلك إشعارات|سيتوقف/);
    });

    it('the interests / skills texts do not claim they appear in the public profile (they are saved in the edit page only)', () => {
      const t = el().textContent || '';
      expect(t).not.toContain('تظهر في ملفك العام');
      expect(t).not.toContain('لتظهر في ملفك الشخصي');
      expect(el().querySelector('textarea[formControlName="bio"]')).not.toBeNull();
      expect(el().querySelector('input[placeholder="أضف اهتمام جديد"]')).not.toBeNull();
      expect(el().querySelector('[aria-label="معلومات الصفحة"]')).toBeNull();
    });

    it('only supported notification channels are offered without an unsupported-channel explanation', () => {
      expect(el().querySelector('[data-testid="notif-email"]')).not.toBeNull();
      expect(el().querySelector('[data-testid="notif-inapp"]')).not.toBeNull();
      expect(el().textContent).not.toContain('قناتا Telegram وWhatsApp');
      expect(el().querySelector('input[type="checkbox"]:not([data-testid])')).toBeNull();
    });
  });

  describe('identity tab: country/city save at once, the national id is a reviewed request, the rest is read-only', () => {
    beforeEach(() => goTab('identity'));

    it('the form is live (not inert), the button is enabled, the note explains what is reviewed and what is unavailable', () => {
      expect(submitBtn().disabled).toBe(false);
      expect(el().querySelector('form[inert]')).toBeNull();
      expect(el().querySelector('[data-testid="identity-note"]')?.textContent).toContain('طلب تعديل');
      expect(el().querySelector('[data-testid="identity-docs-pointer"]')?.textContent).toContain('استكمال البيانات');
      // the fake upload zones (they only showed a file name and "تم الإرفاق بنجاح") are gone
      expect(el().querySelector('input[type="file"]')).toBeNull();
      expect(component.identityForm.get('nationality')!.disabled).toBe(true);
      expect(component.identityForm.get('idExpiryDate')!.disabled).toBe(true);
    });

    it('saving sends idNumber / country / city only (never nationality or the expiry date) and shows the SERVER message', () => {
      updateTab.mockReturnValueOnce(of({ success: true, message: 'تم إرسال طلب تعديل رقم الهوية للمراجعة' }));
      component.identityForm.patchValue({ idNumber: '2123456789', country: 'السعودية', city: 'الرياض' });
      component.saveTab('identity'); render();
      expect(updateTab).toHaveBeenCalledTimes(1);
      const [tab, body] = updateTab.mock.calls[0];
      expect(tab).toBe('identity');
      expect(body).toEqual({ idNumber: '2123456789', country: 'السعودية', city: 'الرياض' });
      expect(component.successMsg()).toBe('تم إرسال طلب تعديل رقم الهوية للمراجعة');
      expect(component.errorMsg()).toBe('');
    });

    it('a malformed id is explained and never sent', () => {
      component.identityForm.patchValue({ idNumber: '123' });
      component.saveTab('identity');
      expect(updateTab).not.toHaveBeenCalled();
      expect(component.errorMsg()).toContain('7 إلى 20');
    });

    it('a rejected save (409 pending request / 400) shows the error and NO success', () => {
      updateTab.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: { success: false, message: 'لديك طلب تعديل لرقم الهوية قيد المراجعة بالفعل' } })));
      component.identityForm.patchValue({ idNumber: '2123456789' });
      component.saveTab('identity'); render();
      expect(component.successMsg()).toBe('');
      expect(component.errorMsg()).toContain('قيد المراجعة');
    });

    it('"طلباتي السابقة" opens the real requests page', () => {
      expect(el().querySelector('a[href$="/client-overview/profile/requests"]')).not.toBeNull();
    });
  });

  describe('security tab', () => {
    it('MFA shows an unavailable badge and the password form has an enabled submit', () => {
      goTab('security');
      component.isChangingPassword.set(true); render();
      expect(el().querySelector('[data-testid="security-unsupported"]')?.textContent?.trim()).toBe('غير متاح');
      expect((el().querySelector('[data-testid="pw-submit"]') as HTMLButtonElement).disabled).toBe(false);
      expect(el().textContent).toContain('المصادقة الثنائية (MFA)');
    });

    it('no fake login sessions: no "جلسات الدخول النشطة", no device / browser / location, no end-sessions control; an honest note instead', () => {
      goTab('security');
      const text = el().textContent || '';
      expect(text).not.toContain('جلسات الدخول النشطة');
      expect(text).not.toMatch(/Chrome|Safari|Windows 11|iPhone|الرياض/);
      expect(text).not.toMatch(/انهاء\s+الجلسات|إنهاء\s+الجلسات|الجلسة\s+الحالية/);
      expect(el().querySelector('[data-testid="sessions-unavailable"] .profile-status-badge')?.textContent?.trim()).toBe('غير متاح');
    });
  });

  describe('optional profile guide (shared narrated tour)', () => {
    it('the button starts the shared tour with this page\'s definition (voiced), is purple with the AI mark, and touches no form or API', () => {
      component.clientForm.patchValue({ bio: 'نبذة لم تُحفظ بعد' });
      const tour = TestBed.inject(TourService);
      const start = vi.spyOn(tour, 'start').mockImplementation(() => undefined);
      const button = el().querySelector<HTMLButtonElement>('[data-testid="profile-guide-start"]')!;
      expect(button.querySelector('[data-ws-ai-mark]')).not.toBeNull();
      expect(button.className).toContain('ws-tour-start');
      button.click();
      expect(start).toHaveBeenCalledWith(CLIENT_PROFILE_EDIT_TOUR);
      expect(el().querySelector('[data-testid="profile-guide"]')).toBeNull();
      expect(component.clientForm.get('bio')!.value).toBe('نبذة لم تُحفظ بعد');
      expect(updateProfile).not.toHaveBeenCalled(); expect(updateTab).not.toHaveBeenCalled(); expect(updatePrefs).not.toHaveBeenCalled();
    });

    it('every step of the tour finds its target inside the tab it clicks first (so the spotlight never misses)', () => {
      for (const step of CLIENT_PROFILE_EDIT_TOUR.steps) {
        const tabId = /data-tour-tab="(\w+)"/.exec(step.click ?? '')?.[1];
        expect(tabId, step.id).toBeTruthy();
        el().querySelector<HTMLButtonElement>(step.click!)!.click(); render();
        expect(component.activeTab(), step.id).toBe(tabId);
        expect(el().querySelector(step.target!), step.id).not.toBeNull();
      }
    });
  });

  it('switching tabs clears the previous summary and messages', () => {
    component.clientForm.get('website')!.setValue('bad');
    component.saveProfile();
    expect(component.missing().length).toBeGreaterThan(0);
    component.switchTab('basics');
    expect(component.missing()).toEqual([]);
    expect(component.errorMsg()).toBe('');
  });
  it('a one-word username survives a general profile save without replaying hidden names', () => {
    component.onUsernameChanged('عمرو');
    for (const form of [component.basicsForm, component.clientForm, component.providerForm, component.contactForm]) {
      if (form.get('firstName')) expect(form.get('firstName')!.value).toBe('عمرو');
      if (form.get('lastName')) expect(form.get('lastName')!.value).toBe('');
    }
    component.clientForm.patchValue({ bio: 'نبذة جديدة' });
    component.saveProfile();
    expect(updateProfile).toHaveBeenCalledTimes(1);
    const payload = updateProfile.mock.calls[0][0];
    expect(payload.bio).toBe('نبذة جديدة');
    expect(payload).not.toHaveProperty('firstName');
    expect(payload).not.toHaveProperty('lastName');
  });


  describe('bio: wording by account type + the AI helper', () => {
    const bioBox = () => el().querySelector<HTMLTextAreaElement>('textarea[formcontrolname="bio"]')!;

    it('an individual is not asked to describe a company: the placeholder talks about the person and the services they need', () => {
      expect(bioBox().placeholder).toContain('عنك');
      expect(bioBox().placeholder).not.toContain('الشركة');
    });

    it('a company keeps the company wording', async () => {
      TestBed.resetTestingModule(); await configure('CLIENT_COMPANY'); render();
      expect(bioBox().placeholder).toContain('الشركة');
    });

    it('the AI button (purple, official AI mark) drafts the bio from the form, puts it in the box, marks it as an AI suggestion to review, and saves nothing', () => {
      component.clientForm.patchValue({ industry: 'مهندس' });
      const btn = el().querySelector<HTMLButtonElement>('[data-testid="bio-ai-btn"]')!;
      expect(btn.querySelector('[data-ws-ai-mark]')).not.toBeNull();
      expect(btn.textContent).toContain('ساعدني أكتب نبذة');
      btn.click(); render();
      expect(suggestBio).toHaveBeenCalledWith(expect.objectContaining({ occupation: 'مهندس', interests: [] }));
      expect(component.clientForm.get('bio')!.value).toBe('أنا مهندس أطلب خدمات تصميم.');
      expect(el().querySelector('[data-testid="bio-ai-note"]')?.textContent).toContain('اقتراح من وسيط AI');
      expect(el().querySelector('[data-testid="bio-ai-note"] [data-ws-ai-mark]')).not.toBeNull();
      expect(updateProfile).not.toHaveBeenCalled();
      expect(el().querySelector<HTMLButtonElement>('[data-testid="bio-ai-btn"]')!.textContent).toContain('حسّن صياغة نبذتي');
    });

    it('with the user\'s own text it sends it to be polished; a refusal (400) shows its reason in the AI note and keeps the text', () => {
      component.clientForm.patchValue({ bio: 'مهندس أبحث عن مصمم' });
      suggestBio.mockImplementation(() => throwError(() => ({ status: 400, error: { message: 'أضف مهنتك أو اهتماماتك' } })));
      el().querySelector<HTMLButtonElement>('[data-testid="bio-ai-btn"]')!.click(); render();
      expect(suggestBio).toHaveBeenCalledWith(expect.objectContaining({ bio: 'مهندس أبحث عن مصمم' }));
      expect(component.clientForm.get('bio')!.value).toBe('مهندس أبحث عن مصمم');
      expect(el().querySelector('[data-testid="bio-ai-note"]')?.textContent).toContain('أضف مهنتك');
    });
  });
});
