import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { MB } from '../../../../../core/forms/file-validation';

// Client profile/edit tabs: shared validation UX, and honest handling of what the backend does not save.
describe('client profile-edit: shared validation', () => {
  let fixture: ComponentFixture<ProfileEdit>;
  let component: ProfileEdit;
  let updateTab: ReturnType<typeof vi.fn>;
  let updateProfile: ReturnType<typeof vi.fn>;

  async function configure(accountType: string) {
    updateTab = vi.fn(() => of({ success: true, message: 'تم التحديث. التعديلات الحساسة تتطلب التحقق.' }));
    updateProfile = vi.fn(() => of({ success: true }));
    await TestBed.configureTestingModule({
      imports: [ProfileEdit],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType, activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
        {
          provide: ProfileApiService,
          useValue: {
            getMyProfile: () => of({ success: true, data: { currentProfileData: { firstName: 'سارة', lastName: 'أحمد', email: 'a@b.co', phoneNumber: '+966551234567', country: 'السعودية', city: 'الرياض' }, latestHistory: [] } }),
            getChangeRequests: () => of({ success: true, data: [] }),
            updateTab, updateProfile,
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

    it('a valid save sends ONLY what the backend stores for a client (no linkedinUrl/portfolio/website2/language/timezone/interests)', () => {
      component.clientForm.patchValue({ companyName: 'شركة', bio: 'نبذة', website: 'https://example.com', linkedinUrl: 'https://linkedin.com/in/x', portfolioUrl: 'https://p.example', personalWebsiteUrl: 'https://me.example' });
      component.saveProfile();
      expect(updateProfile).toHaveBeenCalledTimes(1);
      const body = updateProfile.mock.calls[0][0];
      for (const k of ['linkedinUrl', 'portfolioUrl', 'personalWebsiteUrl', 'interfaceLanguage', 'timezone', 'interests']) expect(body, k).not.toHaveProperty(k);
      expect(body).toEqual(expect.objectContaining({ companyName: 'شركة', bio: 'نبذة', website: 'https://example.com' }));
    });

    it('the sections the backend does not save are shown disabled with an explanation (no fake save)', () => {
      const box = el().querySelector('[data-testid="unsaved-sections"]') as HTMLFieldSetElement;
      expect(box.disabled).toBe(true);
      expect(el().querySelector('[data-testid="unsaved-notice"]')?.textContent).toContain('لا تُحفظ حاليًا');
      expect(box.querySelector('input[formcontrolname="linkedinUrl"]')).toBeTruthy();
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

    it('a 1-character name: no request, summary + inline error, button enabled', () => {
      component.basicsForm.patchValue({ firstName: 'س' });
      component.saveTab('basics'); render();
      expect(updateTab).not.toHaveBeenCalled();
      expect(summary()).toContain('الاسم الأول');
      expect(errors().some(t => t.includes('حرفين'))).toBe(true);
      expect(submitBtn().disabled).toBe(false);
    });

    it('email and phone are read-only (disabled, labelled), and only the name is sent', () => {
      expect(component.basicsForm.get('email')!.disabled).toBe(true);
      expect(component.basicsForm.get('phoneNumber')!.disabled).toBe(true);
      expect(el().querySelector('[data-testid="basics-note"]')?.textContent).toContain('الاسم فقط');
      expect(el().textContent).toContain('(للقراءة فقط)');
      component.saveTab('basics');
      expect(updateTab).toHaveBeenCalledWith('basics', { firstName: 'سارة', lastName: 'أحمد' });
    });

    it('the success message is accurate (the name was saved), not the backend\'s "sensitive changes need verification"', () => {
      component.saveTab('basics');
      expect(component.successMsg()).toBe('تم حفظ الاسم بنجاح');
    });

    it('the result is visible on the basics tab itself (banners are not limited to the profile tab)', () => {
      component.saveTab('basics'); render();
      expect(el().querySelector('[data-testid="tab-success"]')?.textContent).toContain('تم حفظ الاسم بنجاح');
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
      expect(component.errorMsg()).toContain('10 أرقام');
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

  describe('security tab (static mock-up)', () => {
    it('is flagged as not active: the password button is disabled with a reason and the demo data is labelled', () => {
      goTab('security');
      component.isChangingPassword.set(true); render();
      expect(el().querySelector('[data-testid="security-unsupported"]')?.textContent).toContain('غير مفعّل');
      const btn = el().querySelector('button[aria-describedby="security-pw-reason"]') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(el().querySelector('[data-testid="security-disabled-reason"]')?.textContent).toContain('معطّل');
      expect((el().textContent || '').match(/عرض توضيحي/g)?.length).toBeGreaterThanOrEqual(2);
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
});
