import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

const httpError = (status: number, message: string, extra: Record<string, unknown> = {}) =>
  throwError(() => new HttpErrorResponse({ status, error: { success: false, message, ...extra } }));

const PROFILE = {
  headline: 'مصمم', mainSpecialty: 'تصميم', bio: '', country: 'السعودية', city: 'الرياض', location: '',
  user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '+966501234567', alternativePhone: '', idDocumentUrl: 'https://x.test/id.pdf' },
  certUrls: [], skills: [], portfolioItems: [], languages: [],
};

describe('provider profile data tabs: shared validation', () => {
  let fixture: ComponentFixture<Data>;
  let component: Data;
  let ui: UiNotificationService;
  let svc: Record<string, ReturnType<typeof vi.fn>>;

  const setup = (accountType: AccountType | null = null) => {
    svc = {
      getProfile: vi.fn(() => of(PROFILE)),
      getSpecialtyCategories: vi.fn(() => of({ success: true, data: [] })), getSkillsCatalog: vi.fn(() => of({ success: true, data: { category: null, skills: [] } })), getActiveSessions: vi.fn(() => of({ data: [] })),
      updateBasicInfo: vi.fn(() => of({})),
      initiateSensitiveChange: vi.fn(() => of({ data: { requestId: 'r1', emailHint: 'a***@b.co' } })),
      verifySensitiveChange: vi.fn(() => of({ data: { status: 'APPLIED' } })),
      savePaypalPayoutEmail: vi.fn(() => of({})), requestPaypalEmailChange: vi.fn(() => of({ emailSent: true, emailHint: 'ow***@example.com' })),
      changePassword: vi.fn(() => of({})),
      updateSkills: vi.fn(() => of({ skills: [] })),
      updateWhatsapp: vi.fn((v: string) => of({ success: true, message: v ? 'تم حفظ رقم WhatsApp' : 'تم حذف رقم WhatsApp', data: { alternativePhone: v || null } })),
      addPortfolioItem: vi.fn(() => of({})),
      deletePortfolioItem: vi.fn(() => of({})),
      uploadDocument: vi.fn(),
      revokeSession: vi.fn(),
      getChangeRequests: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      imports: [Data],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { currentUser: () => (accountType ? { accountType } : null) } },
        { provide: ProviderProfileService, useValue: svc },
      ],
    });
    fixture = TestBed.createComponent(Data);
    component = fixture.componentInstance;
    ui = TestBed.inject(UiNotificationService);
    fixture.detectChanges();
    render();
  };

  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const panel = (tab: string) => el().querySelector(`#prof-panel-${tab}`) as HTMLElement;
  const summary = (tab: string) => panel(tab).querySelector('[data-testid="form-summary"]')?.textContent || '';
  const fieldErrors = (tab: string) => Array.from(panel(tab).querySelectorAll('[data-testid="field-error"]')).map(e => e.textContent || '');
  const toasts = () => ui.toasts().map(t => t.message).join(' | ');
  const button = (tab: string, text: string) =>
    Array.from(panel(tab).querySelectorAll('button')).find(b => (b.textContent || '').includes(text)) as HTMLButtonElement;
  const fill = (form: any, value: Record<string, unknown>) => { form.patchValue(value); render(); };
  const ARABIC = /[؀-ۿ]/;

  afterEach(() => { fixture?.destroy(); ui?.clearAll(); TestBed.resetTestingModule(); });

  describe('profile tab (PUT basic-info)', () => {
    beforeEach(() => { setup(); document.body.appendChild(el()); });
    afterEach(() => el().remove());

    it('partial save: allows saving edits without requiring country or city, falling back to stored fields when blank', () => {
      fill(component.profileForm, { firstName: '', lastName: '  ', headline: '', specialty: '', country: '' });
      button('profile', 'حفظ التعديلات').click();
      render();
      expect(svc['updateBasicInfo']).toHaveBeenCalledTimes(1);
      expect(button('profile', 'حفظ التعديلات').disabled).toBe(false);
      expect(component.currentTab()).toBe('profile');
    });

    it('shows per-field draft badge, original saved value, and reverts a single field back to original on click', () => {
      expect(component.isFieldDraft('headline')).toBe(false);
      expect(el().querySelector('[data-testid="draft-box-headline"]')).toBeNull();
      fill(component.profileForm, { headline: 'مطور واجهات أول' });
      expect(component.isFieldDraft('headline')).toBe(true);
      expect(component.originalFieldDisplay('headline')).toBe('مصمم');
      const box = el().querySelector('[data-testid="draft-box-headline"]') as HTMLElement;
      expect(box).toBeTruthy();
      expect(box.textContent).toContain('الأصل المحفوظ:');
      expect(box.textContent).toContain('مصمم');
      const revertBtn = box.querySelector('button.field-draft-revert') as HTMLButtonElement;
      expect(revertBtn).toBeTruthy();
      revertBtn.click();
      render();
      expect(component.profileForm.get('headline')?.value).toBe('مصمم');
      expect(component.isFieldDraft('headline')).toBe(false);
      expect(el().querySelector('[data-testid="draft-box-headline"]')).toBeNull();
    });

    it('applies the backend limits: name 60, headline 100, bio 500, http(s) URLs only', () => {
      fill(component.profileForm, { firstName: 'أ'.repeat(61), headline: 'ع'.repeat(101), bio: 'ب'.repeat(501), githubUrl: 'ftp://x.test', linkedinUrl: 'not a url', websiteUrl: 'javascript:alert(1)' });
      component.saveProfile();
      render();
      expect(svc['updateBasicInfo']).not.toHaveBeenCalled();
      const text = summary('profile');
      for (const label of ['الاسم الأول', 'المسمى المهني', 'الوصف المهني', 'LinkedIn', 'GitHub', 'رابط معرض الأعمال']) expect(text, label).toContain(label);
      fill(component.profileForm, { firstName: 'أ'.repeat(60), headline: 'ع'.repeat(100), bio: 'ب'.repeat(500), githubUrl: 'https://github.com/x', linkedinUrl: 'http://linkedin.com/in/x', websiteUrl: '' });
      component.saveProfile();
      expect(svc['updateBasicInfo']).toHaveBeenCalledTimes(1);
    });

    it('INVALID_URL:githubUrl lands on the githubUrl field in Arabic, with focus and no generic toast', () => {
      svc['updateBasicInfo'].mockReturnValue(httpError(400, 'INVALID_URL:githubUrl'));
      component.saveProfile();
      render();
      const c = component.profileForm.get('githubUrl')!;
      expect(c.errors?.['server']).toMatch(ARABIC);
      expect(fieldErrors('profile').join(' ')).toContain('http://');
      expect(summary('profile')).toContain('GitHub');
      expect(document.activeElement?.id).toBe('website-url');
      expect(ui.toasts().length).toBe(0);
      expect(component.isSavingProfile()).toBe(false);
      // editing the field clears the server error
      c.setValue('https://github.com/me');
      expect(c.errors).toBeNull();
    });

    it('REQUIRED_PROFILE_FIELDS / PROFILE_FIELD_TOO_LONG / 500 are shown in Arabic, never as the raw code', () => {
      for (const code of ['REQUIRED_PROFILE_FIELDS', 'PROFILE_FIELD_TOO_LONG']) {
        ui.clearAll();
        svc['updateBasicInfo'].mockReturnValue(httpError(400, code));
        component.saveProfile();
        expect(toasts()).toMatch(ARABIC);
        expect(toasts()).not.toContain(code);
      }
      ui.clearAll();
      svc['updateBasicInfo'].mockReturnValue(httpError(500, 'Internal server error'));
      component.saveProfile();
      expect(toasts()).not.toContain('Internal');
      expect(toasts()).toMatch(ARABIC);
    });

    it('the save button is disabled only while saving, and says so', () => {
      const pending = new Subject<any>();
      svc['updateBasicInfo'].mockReturnValue(pending);
      component.saveProfile();
      render();
      expect(button('profile', 'جاري الحفظ').disabled).toBe(true);
      pending.next({});
      pending.complete();
      render();
      expect(button('profile', 'حفظ التعديلات').disabled).toBe(false);
    });

    it('a rejected avatar (type/size) shows an inline Arabic error and is not applied', () => {
      const big = new File([new Uint8Array(6 * 1024 * 1024)], 'a.png', { type: 'image/png' });
      component.onAvatarSelected({ target: { files: [big], value: 'x' } } as any);
      render();
      expect(el().querySelector('[data-testid="avatar-error"]')?.textContent).toMatch(ARABIC);
      expect(component.avatarUrl()).toBeNull();
    });

    it('notification channel Telegram is not a fake control: it is disabled with a visible reason', () => {
      const tg = Array.from(panel('profile').querySelectorAll('.notif-check')).find(l => (l.textContent || '').includes('Telegram'))!;
      expect((tg.querySelector('input') as HTMLInputElement).disabled).toBe(true);
      expect(tg.textContent).toContain('غير متاحة');
    });

    it('a new notification is not cleared by the timer of an older one (central service, no local toast state)', () => {
      expect('showToast' in component).toBe(false);
      expect('displayToast' in component).toBe(false);
      vi.useFakeTimers();
      try {
        ui.success('الأولى');
        vi.advanceTimersByTime(3000);
        ui.success('الثانية');
        vi.advanceTimersByTime(1000);
        expect(ui.toasts().map(t => t.message)).toEqual(['الثانية']);
        vi.advanceTimersByTime(3000);
        expect(ui.toasts()).toEqual([]);
      } finally { vi.useRealTimers(); }
    });
  });

  describe('skills and portfolio (profile tab)', () => {
    beforeEach(() => { setup(); document.body.appendChild(el()); });
    afterEach(() => el().remove());

    it('a failed skills save (picker) shows an Arabic error and keeps the list unchanged', () => {
      svc['updateSkills'].mockReturnValue(httpError(500, 'Internal server error'));
      component.onSkillsChange(['Angular']);
      render();
      expect(component.skillError()).toMatch(ARABIC);
      expect(component.skillError()).not.toContain('Internal');
      expect(component.skillsArray.length).toBe(0);
      expect(el().querySelector('[data-testid="skill-error"]')).toBeTruthy();
    });

    it('a skill outside the field catalog is refused by the server with its Arabic message, which is shown as is', () => {
      svc['updateSkills'].mockReturnValue(httpError(400, 'اختر مهارات من قائمة المهارات المقترحة لمجالك؛ لم يتم حفظ البيانات. (Python)'));
      component.onSkillsChange(['Python']);
      expect(component.skillError()).toContain('اختر مهارات من قائمة المهارات المقترحة');
    });

    it('a failed skills removal shows an Arabic error and the list stays', () => {
      component.skillsArray.push(component['fb'].control('Angular'));
      svc['updateSkills'].mockReturnValue(httpError(0, ''));
      component.onSkillsChange([]);
      expect(component.skillError()).toMatch(ARABIC);
      expect(component.skillsArray.length).toBe(1);
    });

    it('failed portfolio add/delete show an Arabic notification and no success toast', () => {
      svc['addPortfolioItem'].mockReturnValue(httpError(500, 'Internal server error'));
      component.addPortfolioItem('مشروع', 'https://x.test');
      expect(toasts()).toMatch(ARABIC);
      expect(component.portfolioList().length).toBe(0);
      ui.clearAll();
      svc['deletePortfolioItem'].mockReturnValue(httpError(500, 'Internal server error'));
      component.portfolioList.set([{ id: 'p1' }]);
      component.deletePortfolioItem('p1');
      expect(toasts()).toMatch(ARABIC);
      expect(component.portfolioList().length).toBe(1);
      expect(ui.toasts().some(t => t.kind === 'success')).toBe(false);
    });

    it('portfolio add rejects an empty title and a non-http(s) link before any request', () => {
      component.addPortfolioItem('', '');
      component.addPortfolioItem('مشروع', 'ftp://x');
      expect(svc['addPortfolioItem']).not.toHaveBeenCalled();
      expect(ui.toasts().length).toBe(2);
    });
  });

  describe('contact tab (DISPLAY ONLY: the e-mail and the phone are immutable from the interface)', () => {
    beforeEach(() => { setup(); document.body.appendChild(el()); component.setTab('contact'); render(); });
    afterEach(() => el().remove());

    it('shows the stored e-mail and phone as plain values: no input or select for them; the only input is the optional WhatsApp number', () => {
      const p = panel('contact');
      expect(p.querySelector('[data-testid="contact-email"]')!.textContent!.trim()).toBe('a@b.co');
      expect(p.querySelector('[data-testid="contact-phone"]')!.textContent).toContain('+966');
      expect(Array.from(p.querySelectorAll('input, select, textarea')).map(i => i.getAttribute('data-testid'))).toEqual(['contact-whatsapp-input']);
      expect(p.querySelector('app-phone-input, form')).toBeNull();
      const buttons = Array.from(p.querySelectorAll('button')).map(b => (b.textContent || '').trim());
      expect(buttons).toEqual(['حفظ رقم WhatsApp', 'الانتقال إلى الملف المهني']);
      expect(component.currentTab()).toBe('contact');
    });

    it('no wording suggests that the e-mail or the phone can be changed here (no code, no request, no review)', () => {
      const text = (panel('contact').textContent || '').replace(/\s+/g, ' ');
      for (const banned of ['إرسال رمز التحقق', 'يتطلب تأكيد رمز', 'رمز التحقق', 'يُرسل رمز', 'طلباتي السابقة', 'قيد المراجعة', 'تغيير البريد']) expect(text, banned).not.toContain(banned);
      expect(text).toContain('للعرض فقط');
      expect(el().querySelector('[data-testid="contact-tab-readonly"]')!.textContent).toContain('للعرض فقط');
      // the tab strip no longer says "برمز تحقق" for the contact tab
      expect(el().querySelector('.prof-tab-btn:nth-child(2)')!.textContent).not.toContain('برمز تحقق');
    });

    it('nothing on the contact tab can start a change: no method, no network request, no OTP modal, whatever is clicked', () => {
      expect((component as any).saveContact).toBeUndefined();
      expect((component as any).contactForm).toBeUndefined();
      panel('contact').querySelectorAll('button').forEach(b => (b as HTMLButtonElement).click());
      render();
      expect(svc['updateWhatsapp']).toHaveBeenCalledTimes(1); // the WhatsApp save is the only action, and it is a direct save
      expect(svc['initiateSensitiveChange']).not.toHaveBeenCalled();
      expect(svc['verifySensitiveChange']).not.toHaveBeenCalled();
      expect(component.showOtpModal()).toBe(false);
      expect(component.isSaving()).toBe(false);
    });

    it('the service type accepts the DOCUMENTS category only (the CONTACT category cannot even be asked for)', () => {
      const src = readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'core', 'services', 'provider-profile.service.ts'), 'utf8');
      expect(src).toMatch(/initiateSensitiveChange\(category: 'DOCUMENTS'/);
      expect(src).not.toMatch(/'CONTACT'/);
    });

    it('WhatsApp: a valid number is saved directly (no code, no request, no review) and the page says so', () => {
      component.whatsappControl.setValue('+20 102-507 3026');
      (el().querySelector('[data-testid="save-whatsapp-btn"]') as HTMLButtonElement).click();
      render();
      expect(svc['updateWhatsapp']).toHaveBeenCalledWith('+20 102-507 3026');
      expect(svc['initiateSensitiveChange']).not.toHaveBeenCalled();
      expect(component.showOtpModal()).toBe(false);
      expect(ui.toasts().some(t => t.kind === 'success' && t.message.includes('رقم WhatsApp'))).toBe(true);
      expect(component.contactWhatsapp()).toBe('+20 102-507 3026');
    });

    it('WhatsApp: an invalid number is refused before any request (inline Arabic error); empty clears it', () => {
      component.whatsappControl.setValue('abc');
      (el().querySelector('[data-testid="save-whatsapp-btn"]') as HTMLButtonElement).click();
      render();
      expect(svc['updateWhatsapp']).not.toHaveBeenCalled();
      expect(el().querySelector('[data-testid="whatsapp-error"]')!.textContent).toMatch(ARABIC);
      component.whatsappControl.setValue('');
      component.saveWhatsapp();
      expect(svc['updateWhatsapp']).toHaveBeenCalledWith('');
    });

    it('WhatsApp: a server refusal is shown inline in Arabic and the value is kept for another try', () => {
      svc['updateWhatsapp'].mockReturnValue(httpError(400, 'INVALID_WHATSAPP', { code: 'INVALID_WHATSAPP' }));
      component.whatsappControl.setValue('+20 102-507 3026');
      component.saveWhatsapp();
      render();
      expect(component.whatsappControl.errors?.['server']).toMatch(ARABIC);
      expect(component.whatsappControl.value).toBe('+20 102-507 3026');
      expect(component.savingWhatsapp()).toBe(false);
    });

    it('OTP modal (documents): an incomplete code shows an inline error (no request); a wrong code shows the Arabic reason in the modal', () => {
      component.docsForm.patchValue({ idDocumentUrl: 'https://res.cloudinary.com/testcloud/image/upload/id.pdf' });
      component.setTab('docs'); render();
      component.saveDocs();
      render();
      component.verifyOtp();
      render();
      expect(svc['verifySensitiveChange']).not.toHaveBeenCalled();
      expect(el().querySelector('[data-testid="otp-error"]')?.textContent).toMatch(ARABIC);
      expect(document.activeElement?.id).toBe('sens-otp-0');
      component.otpCode.set('123456');
      svc['verifySensitiveChange'].mockReturnValue(httpError(400, 'INVALID_OR_EXPIRED_OTP'));
      component.verifyOtp();
      render();
      expect(component.showOtpModal()).toBe(true);
      expect(el().querySelector('[data-testid="otp-error"]')?.textContent).toContain('غير صحيح أو انتهت');
    });
  });

  describe('payout tab (PayPal)', () => {
    beforeEach(() => { setup(); document.body.appendChild(el()); component.setTab('payout'); render(); });
    afterEach(() => el().remove());

    it('empty and malformed email: no request, summary, inline error, focus, enabled button', () => {
      component.payoutForm.patchValue({ paypalPayoutEmail: '' });
      button('payout', 'إضافة بريد PayPal').click();
      render();
      expect(svc['requestPaypalEmailChange']).not.toHaveBeenCalled();
      expect(summary('payout')).toContain('بريد PayPal مطلوب');
      expect(fieldErrors('payout')).toEqual(['بريد PayPal مطلوب']);
      expect(document.activeElement?.id).toBe('pp-email');
      expect(button('payout', 'إضافة بريد PayPal').disabled).toBe(false);
      fill(component.payoutForm, { paypalPayoutEmail: 'a@b' });
      component.savePaypal();
      render();
      expect(fieldErrors('payout')[0]).toContain('name@example.com');
      expect(svc['requestPaypalEmailChange']).not.toHaveBeenCalled();
    });

    it('a zod 400 on paypalPayoutEmail becomes the field error; other failures are an Arabic message under the button', () => {
      component.payoutForm.patchValue({ paypalPayoutEmail: 'me@paypal.com' });
      svc['requestPaypalEmailChange'].mockReturnValue(httpError(400, 'Validation Error', { errors: [{ field: 'paypalPayoutEmail', message: 'بريد PayPal غير صحيح' }] }));
      component.savePaypal();
      render();
      expect(component.payoutForm.get('paypalPayoutEmail')!.errors?.['server']).toBe('بريد PayPal غير صحيح');
      expect(ui.toasts().length).toBe(0);
      component.payoutForm.patchValue({ paypalPayoutEmail: 'me2@paypal.com' });
      svc['requestPaypalEmailChange'].mockReturnValue(httpError(500, 'Internal server error'));
      component.savePaypal();
      // a failed first step is said under the button (the OTP panel stays closed)
      expect(component.paypalRequestError()).toMatch(ARABIC);
      expect(component.pendingPaypalEmail()).toBeNull();
      expect(component.savingPaypal()).toBe(false);
    });
  });

  describe('documents tab (sensitive change)', () => {
    beforeEach(() => { setup(); document.body.appendChild(el()); component.setTab('docs'); render(); });
    afterEach(() => el().remove());

    it('without an ID document: no request, summary, inline error, the upload card is focused, button enabled', () => {
      component.docsForm.patchValue({ idDocumentUrl: '' });
      render();
      button('docs', 'إرسال طلب تعديل').click();
      render();
      expect(svc['initiateSensitiveChange']).not.toHaveBeenCalled();
      expect(summary('docs')).toContain('مستند الهوية مطلوب');
      expect(fieldErrors('docs')).toEqual(['مستند الهوية مطلوب']);
      expect(document.activeElement?.id).toBe('doc-card-idDocumentUrl');
      expect(button('docs', 'إرسال طلب تعديل').disabled).toBe(false);
    });

    it('ID_DOCUMENT_REQUIRED and INVALID_DOCUMENT_URL:<key> land on the matching document', () => {
      svc['initiateSensitiveChange'].mockReturnValue(httpError(400, 'INVALID_DOCUMENT_URL:certificatesUrl'));
      component.docsForm.patchValue({ certificatesUrl: 'http://x.test/c.pdf' });
      component.saveDocs();
      render();
      expect(component.docsForm.get('certificatesUrl')!.errors?.['server']).toMatch(ARABIC);
      expect(document.activeElement?.id).toBe('doc-card-certificatesUrl');
      svc['initiateSensitiveChange'].mockReturnValue(httpError(400, 'ID_DOCUMENT_REQUIRED'));
      component.docsForm.patchValue({ certificatesUrl: '' });
      component.saveDocs();
      expect(component.docsForm.get('idDocumentUrl')!.errors?.['server']).toBe('مستند الهوية مطلوب');
    });

    it('a rejected file (type/size) shows an inline Arabic error and never starts an upload', () => {
      const bad = new File(['x'], 'a.exe', { type: 'application/x-msdownload' });
      component.onDocSelected({ target: { files: [bad], value: 'x' } } as any, 'idDocumentUrl');
      render();
      expect(svc['uploadDocument']).not.toHaveBeenCalled();
      expect(panel('docs').textContent).toContain('نوع الملف غير مسموح');
      const big = new File([new Uint8Array(11 * 1024 * 1024)], 'a.pdf', { type: 'application/pdf' });
      component.onDocSelected({ target: { files: [big], value: 'x' } } as any, 'idDocumentUrl');
      expect(component.docFileErrors()['idDocumentUrl']).toContain('كبير');
    });

    it('while a document uploads the save button is disabled with a visible Arabic reason', () => {
      component.documentUploads.set({ idDocumentUrl: { name: 'a.pdf', progress: 40, status: 'uploading' } });
      render();
      expect(button('docs', 'إرسال طلب تعديل').disabled).toBe(true);
      expect(panel('docs').querySelector('[data-testid="docs-upload-reason"]')?.textContent).toContain('جاري رفع المستند');
      component.saveDocs();
      expect(svc['initiateSensitiveChange']).not.toHaveBeenCalled();
    });

    it('the card hints say 10MB (the real limit), not 5MB', () => {
      expect(panel('docs').textContent).not.toContain('5MB');
    });
  });

  describe('security tab (change password)', () => {
    beforeEach(() => { setup(); document.body.appendChild(el()); component.setTab('security'); component.passwordFormVisible.set(true); render(); });
    afterEach(() => el().remove());

    it('empty: no request, summary, inline errors, focus on the current password, button enabled', () => {
      button('security', 'حفظ كلمة المرور الجديدة').click();
      render();
      expect(svc['changePassword']).not.toHaveBeenCalled();
      for (const label of ['كلمة المرور الحالية', 'كلمة المرور الجديدة', 'تأكيد كلمة المرور']) expect(summary('security'), label).toContain(label);
      expect(fieldErrors('security').length).toBe(3);
      expect(document.activeElement?.id).toBe('pwd-old');
      expect(button('security', 'حفظ كلمة المرور الجديدة').disabled).toBe(false);
    });

    it('applies the backend rule: 8-72 chars with at least 3 character groups, differs from current, matches the confirmation', () => {
      const attempt = (value: Record<string, string>) => { fill(component.passwordForm, { currentPassword: 'OldPass1!', newPassword: 'x', confirmPassword: 'x', ...value }); component.changePassword(); render(); };
      attempt({ newPassword: 'short1A', confirmPassword: 'short1A' });
      expect(summary('security')).toContain('8 أحرف');
      attempt({ newPassword: 'alllowercase', confirmPassword: 'alllowercase' });
      expect(summary('security')).toContain('3 أنواع');
      attempt({ newPassword: 'a'.repeat(73) + 'A1', confirmPassword: 'a'.repeat(73) + 'A1' });
      expect(summary('security')).toContain('72');
      attempt({ newPassword: 'OldPass1!', confirmPassword: 'OldPass1!' });
      expect(summary('security')).toContain('تختلف عن الحالية');
      attempt({ newPassword: 'NewPass1x', confirmPassword: 'NewPass1y' });
      expect(summary('security')).toContain('غير مطابق');
      expect(svc['changePassword']).not.toHaveBeenCalled();
      attempt({ newPassword: 'NewPass1x', confirmPassword: 'NewPass1x' });
      expect(svc['changePassword']).toHaveBeenCalledWith('OldPass1!', 'NewPass1x');
    });

    it('401 CURRENT_PASSWORD_INCORRECT -> the current-password field; PASSWORD_UNCHANGED / WEAK_PASSWORD -> the new-password field', () => {
      const good = { currentPassword: 'OldPass1!', newPassword: 'NewPass1x', confirmPassword: 'NewPass1x' };
      const cases: [number, string, string][] = [[401, 'CURRENT_PASSWORD_INCORRECT', 'currentPassword'], [400, 'PASSWORD_UNCHANGED', 'newPassword'], [400, 'WEAK_PASSWORD', 'newPassword']];
      for (const [status, code, field] of cases) {
        component.passwordForm.reset(good);
        svc['changePassword'].mockReturnValue(httpError(status, code));
        component.changePassword();
        render();
        expect(component.passwordForm.get(field)!.errors?.['server'], code).toMatch(ARABIC);
        expect(ui.toasts().length, code).toBe(0);
        expect(component.isChangingPassword()).toBe(false);
      }
    });

    it('a network failure is an Arabic notification and the form keeps its values', () => {
      component.passwordForm.reset({ currentPassword: 'OldPass1!', newPassword: 'NewPass1x', confirmPassword: 'NewPass1x' });
      svc['changePassword'].mockReturnValue(httpError(0, ''));
      component.changePassword();
      expect(toasts()).toMatch(ARABIC);
      expect(component.passwordForm.value.newPassword).toBe('NewPass1x');
    });

    it('no fake MFA claim: the static "MFA مفعلة" row is gone', () => {
      expect(panel('security').textContent).not.toContain('MFA');
    });
  });

  describe('company mode (isCompanyMode)', () => {
    beforeEach(() => { setup(AccountType.PROVIDER_COMPANY); });

    it('renders (no missing-control crash), shows why editing is unavailable and offers no fake save', () => {
      expect(el().querySelector('[data-testid="company-unavailable"]')?.textContent).toContain('غير متاح حاليًا');
      expect(el().querySelector('form')).toBeNull();
      expect(el().querySelector('button[type="submit"]')).toBeNull();
      expect(el().textContent).not.toContain('12 يوليو');
      expect(el().textContent).not.toContain('السجل التجاري.pdf');
      expect(svc['updateBasicInfo']).not.toHaveBeenCalled();
      expect(ui.toasts().length).toBe(0);
    });
  });
});
