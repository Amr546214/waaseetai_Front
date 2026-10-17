import { FormA11ySyncService } from '../../../../../shared/forms/form-a11y-sync.service';
import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { expectFieldProblem, expectFocused, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

const PROFILE = {
  headline: 'مصمم', mainSpecialty: 'تصميم', bio: '', country: 'السعودية', city: 'الرياض', location: '',
  hourlyRate: null, yearsOfExperience: null,
  user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '+966501234567', alternativePhone: '', idDocumentUrl: 'https://x.test/id.pdf' },
  certUrls: [], skills: [], portfolioItems: [], languages: [],
};

describe('provider profile data: Batch B forms (field errors, generic errors, one request, no ready-made numbers)', () => {
  let fixture: ComponentFixture<Data>;
  let component: Data;
  let ui: UiNotificationService;
  let svc: Record<string, ReturnType<typeof vi.fn>>;

  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (sel: string) => el().querySelector<HTMLElement>(sel)!;
  const setup = (profile: any = PROFILE) => {
    (Element.prototype as any).scrollIntoView = vi.fn();
    svc = {
      getProfile: vi.fn(() => of(profile)),
      getSpecialtyCategories: vi.fn(() => of({ success: true, data: [] })), getSkillsCatalog: vi.fn(() => of({ success: true, data: { category: null, skills: [] } })), getActiveSessions: vi.fn(() => of({ data: [] })),
      updateBasicInfo: vi.fn(() => of({})),
      initiateSensitiveChange: vi.fn(() => of({ data: { requestId: 'r1', emailHint: 'a***@b.co' } })),
      requestPaypalEmailChange: vi.fn(() => of({ emailSent: true })),
      changePassword: vi.fn(() => of({})),
      updateWhatsapp: vi.fn(() => of({ success: true, data: { alternativePhone: null } })),
      getChangeRequests: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      imports: [Data],
      providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => null } }, { provide: ProviderProfileService, useValue: svc }],
    });
    fixture = TestBed.createComponent(Data);
    component = fixture.componentInstance;
    ui = TestBed.inject(UiNotificationService);
    document.body.appendChild(el());
    fixture.detectChanges(); render();
  };
  afterEach(() => { el()?.remove(); fixture?.destroy(); ui?.clearAll(); TestBed.resetTestingModule(); });

  describe('section 6: no ready-made numbers', () => {
    it('a profile without a rate / years starts empty (null, not 0) and the save does not invent them', () => {
      setup();
      expect(component.profileForm.value.hourlyRate).toBeNull();
      expect(component.profileForm.value.yearsOfExperience).toBeNull();
      component.saveProfile();
      const payload = svc['updateBasicInfo'].mock.calls[0][0];
      expect('hourlyRate' in payload).toBe(false);
      expect('yearsOfExperience' in payload).toBe(false);
    });

    it('editing restores the real saved values and sends them back', () => {
      setup({ ...PROFILE, hourlyRate: 25, yearsOfExperience: 4 });
      expect(component.profileForm.value.hourlyRate).toBe(25);
      component.saveProfile();
      const payload = svc['updateBasicInfo'].mock.calls[0][0];
      expect(payload.hourlyRate).toBe(25);
      expect(payload.yearsOfExperience).toBe(4);
    });

    it('the job-title placeholder carries no invented number', () => {
      setup();
      expect(q('#pr-title').getAttribute('placeholder')).not.toMatch(/\d/);
    });
  });

  describe('profile tab', () => {
    beforeEach(() => setup());
    const fill = () => { component.profileForm.patchValue({ firstName: 'أحمد', lastName: 'علي', headline: 'مصمم', specialty: 'تصميم', country: 'السعودية', city: 'الرياض' }); render(); };

    it('invalid submit: first invalid field has focus, aria-invalid and a role=alert message', async () => {
      component.profileForm.patchValue({ firstName: '', headline: '' }); render();
      q('button.btn-primary').click();
      render(); await settleForm();
      TestBed.inject(FormA11ySyncService).sync(document); // the app root runs this watcher for every touched-invalid control
      expectFocused(q('#pr-fname'));
      expect(q('#pr-fname').getAttribute('aria-invalid')).toBe('true');
      expect(q('#prof-panel-profile').querySelector('[role="alert"][data-testid="field-error"]')).toBeTruthy();
      expect(svc['updateBasicInfo']).not.toHaveBeenCalled();
    });

    it('a 400 naming a field lands on that field; 429 marks nothing', async () => {
      fill();
      svc['updateBasicInfo'].mockReturnValue(throwError(() => httpFail(400, { errors: [{ field: 'headline', message: 'المسمى المهني غير مقبول' }] })));
      component.saveProfile(); render(); await settleForm();
      expect(component.profileForm.get('headline')!.errors?.['server']).toBe('المسمى المهني غير مقبول');
      component.profileForm.get('headline')!.setValue('مصمم'); render();
      svc['updateBasicInfo'].mockReturnValue(throwError(() => httpFail(429, { message: 'Too many requests' })));
      component.saveProfile(); render();
      expect(component.profileForm.get('headline')!.errors).toBeNull();
      expect(component.profileForm.invalid).toBe(false);
    });

    it('a double click sends ONE request', () => {
      fill();
      const pending = new Subject<any>();
      svc['updateBasicInfo'].mockReturnValue(pending);
      const btn = q('button.btn-primary') as HTMLButtonElement;
      btn.click(); btn.click(); component.saveProfile();
      expect(svc['updateBasicInfo']).toHaveBeenCalledTimes(1);
      pending.next({}); pending.complete();
    });
  });

  describe('contact tab: WhatsApp', () => {
    beforeEach(() => { setup(); component.setTab('contact'); render(); });
    const input = () => q('#ct-whatsapp') as HTMLInputElement;
    const save = () => q('[data-testid="save-whatsapp-btn"]') as HTMLButtonElement;

    it('an invalid number: focus on the input, aria-invalid and describedby pointing at the role=alert message', async () => {
      input().value = '12'; input().dispatchEvent(new Event('input')); render();
      save().click(); render(); await settleForm();
      expectFocused(input());
      expectFieldProblem(input(), 'رقم WhatsApp غير صالح');
      expect(svc['updateWhatsapp']).not.toHaveBeenCalled();
    });

    it('a 400 is shown at the field (aria wired); 429 / 500 stay a generic toast and never mark the field', async () => {
      input().value = '+201025073026'; input().dispatchEvent(new Event('input'));
      svc['updateWhatsapp'].mockReturnValue(throwError(() => httpFail(400, { message: 'INVALID_ALTERNATIVE_PHONE' })));
      save().click(); render(); await settleForm();
      expect(component.whatsappControl.errors?.['server']).toBeTruthy();
      expectFieldProblem(input());
      for (const status of [429, 500]) {
        component.whatsappControl.setValue('+201025073026'); render();
        svc['updateWhatsapp'].mockReturnValue(throwError(() => httpFail(status, { message: 'x' })));
        save().click(); render();
        expect(component.whatsappControl.errors, String(status)).toBeNull();
        expect(input().getAttribute('aria-invalid')).toBeNull();
        expect(ui.toasts().length).toBeGreaterThan(0);
      }
    });

    it('a double click sends ONE request', () => {
      input().value = '+201025073026'; input().dispatchEvent(new Event('input'));
      const pending = new Subject<any>();
      svc['updateWhatsapp'].mockReturnValue(pending);
      save().click(); save().click();
      expect(svc['updateWhatsapp']).toHaveBeenCalledTimes(1);
      pending.next({ success: true, data: { alternativePhone: '+201025073026' } }); pending.complete();
    });
  });

  describe('security tab: change password', () => {
    beforeEach(() => { setup(); component.setTab('security'); component.passwordFormVisible.set(true); render(); });
    const good = { currentPassword: 'OldPass1!', newPassword: 'NewPass1x', confirmPassword: 'NewPass1x' };
    const save = () => Array.from(el().querySelectorAll('button')).find(b => (b.textContent || '').includes('حفظ كلمة المرور الجديدة')) as HTMLButtonElement;

    it('a generic 400 naming newPassword lands on that field with focus; 429 marks nothing', async () => {
      component.passwordForm.reset(good);
      svc['changePassword'].mockReturnValue(throwError(() => httpFail(400, { errors: [{ field: 'newPassword', message: 'كلمة المرور مستخدمة سابقًا' }] })));
      save().click(); render(); await settleForm();
      expect(component.passwordForm.get('newPassword')!.errors?.['server']).toBe('كلمة المرور مستخدمة سابقًا');
      expectFocused(q('#pwd-new'));
      component.passwordForm.reset(good); render();
      svc['changePassword'].mockReturnValue(throwError(() => httpFail(429, { message: 'Too many requests' })));
      save().click(); render();
      expect(component.passwordForm.get('newPassword')!.errors).toBeNull();
      expect(ui.toasts().length).toBeGreaterThan(0);
    });

    it('a double click sends ONE request', () => {
      component.passwordForm.reset(good);
      const pending = new Subject<any>();
      svc['changePassword'].mockReturnValue(pending);
      save().click(); save().click();
      expect(svc['changePassword']).toHaveBeenCalledTimes(1);
      pending.next({}); pending.complete();
    });
  });
});
