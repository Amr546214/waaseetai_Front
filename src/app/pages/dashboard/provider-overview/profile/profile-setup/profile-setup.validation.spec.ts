import { ChangeDetectorRef, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService } from '../../../../../core/services/setup-test.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { MB } from '../../../../../core/forms/file-validation';

// Provider onboarding (7 steps): Next / step bar / final submit use the shared validation kit.
describe('provider profile-setup: shared validation', () => {
  let fixture: ComponentFixture<ProfileSetupDashboard>;
  let component: ProfileSetupDashboard;
  let http: HttpTestingController;
  let save: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    save = vi.fn(() => of({ success: true }));
    await TestBed.configureTestingModule({
      imports: [ProfileSetupDashboard],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => null } },
        { provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data: {} }), saveProviderProfileSetup: save } },
        { provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: [] }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
        { provide: SetupTestService, useValue: { warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), isGenerating: signal(false), statusMsg: signal(''), disconnect: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileSetupDashboard);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); });

  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const summary = () => el().querySelector('[data-testid="form-summary"]')?.textContent || '';
  const fieldErrors = () => Array.from(el().querySelectorAll('[data-testid="field-error"]')).map(e => e.textContent || '');
  const step1 = () => component.setupForm.get('profData')!.patchValue({ jobTitle: 'مطور', expYears: '1 الى 3 سنوات', country: 'السعودية', city: 'الرياض', bio: 'نبذة' });
  const step2 = () => { component.selectedSpecs.set(['تطوير مواقع']); component.setupForm.get('specialties')!.patchValue({ mainSpec: 'web', subSpecs: ['تطوير مواقع'] }); };
  const step3 = () => component.setupForm.get('payout')!.patchValue({ paypalEmail: 'me@example.com' });
  const step4 = () => component.uploadedFrontId.set('front-url');
  const step5 = () => component.portfolioItems.set({ 'تطوير مواقع': [{ review: 'r-url', reviewDisplayName: 'r.pdf', proofs: [], proofDisplayNames: [] }] });
  const file = (name: string, type: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type });
  const pickEvent = (...files: File[]) => ({ target: { files, value: 'x' } }) as any;

  it('Next on an empty step 1: stays, names every missing field, shows inline errors, focuses the first, button enabled', () => {
    document.body.appendChild(el());
    component.goToStep(2);
    render();
    expect(component.currentStep()).toBe(1);
    // (the city list stays disabled until a country is chosen, so the city is listed once the country is set)
    for (const label of ['المسمى الوظيفي', 'سنوات الخبرة', 'الدولة', 'النبذة المهنية']) expect(summary(), label).toContain(label);
    expect(fieldErrors().length).toBe(4);
    expect(document.activeElement?.id).toBe('job-title');
    expect((el().querySelector('.btn-wz-next') as HTMLButtonElement).disabled).toBe(false);
    el().remove();
  });

  it('once a country is chosen the city becomes a listed requirement too', () => {
    component.setupForm.get('profData.country')!.setValue('السعودية');
    component.goToStep(2);
    expect(component.missing().map(m => m.label)).toContain('المدينة');
  });

  it('the step bar cannot skip incomplete steps: jumping to 5 stops at the first incomplete one', () => {
    component.goToStep(5);
    expect(component.currentStep()).toBe(1);
    step1();
    component.goToStep(5);
    expect(component.currentStep()).toBe(2);
    expect(component.missing().map(m => m.label)).toContain('التخصص الرئيسي');
    step2();
    component.goToStep(5);
    expect(component.currentStep()).toBe(3);
    step3();
    component.goToStep(5);
    expect(component.currentStep()).toBe(4); // front ID missing
    step4();
    component.goToStep(5);
    expect(component.currentStep()).toBe(5);
  });

  it('step 2: a main specialty without a sub-specialty is explained (summary + chips highlight)', () => {
    step1();
    component.goToStep(2);
    component.setupForm.get('specialties.mainSpec')!.setValue('web');
    component.goToStep(3);
    render();
    expect(component.currentStep()).toBe(2);
    expect(component.subSpecError()).toBe(true);
    expect(summary()).toContain('التخصصات الفرعية');
  });

  it('step 3: a missing/invalid PayPal email blocks Next with an Arabic reason', () => {
    step1(); step2();
    component.currentStep.set(3);
    component.setupForm.get('payout.paypalEmail')!.setValue('not-an-email');
    component.goToStep(4);
    render();
    expect(component.currentStep()).toBe(3);
    expect(summary()).toContain('بريد PayPal');
  });

  it('step 4: no front ID -> summary + inline file error (no pop-up), still on step 4', () => {
    step1(); step2(); step3();
    component.currentStep.set(4);
    component.goToStep(5);
    render();
    expect(component.currentStep()).toBe(4);
    expect(component.alertModal()).toBeNull();
    expect(summary()).toContain('صورة الهوية (الوجه الأمامي)');
    expect(el().querySelector('[data-testid="doc-file-errors"]')?.textContent).toContain('مطلوبة');
  });

  it('the back-ID and selfie slots are labelled optional (only the front ID is enforced)', () => {
    component.currentStep.set(4); render();
    const text = el().textContent || '';
    const back = Array.from(el().querySelectorAll('.doc-name')).find(n => n.textContent?.includes('الظهر'))!;
    const selfie = Array.from(el().querySelectorAll('.doc-name')).find(n => n.textContent?.includes('Selfie'))!;
    expect(back.textContent).toContain('اختياري');
    expect(selfie.textContent).toContain('اختياري');
    expect(text).toContain('إلزامي'); // the front ID
  });

  describe('file inputs', () => {
    it('an oversize ID file is rejected with the real size and the limit, nothing is uploaded', () => {
      component.currentStep.set(4);
      component.onFileSelected(pickEvent(file('id.png', 'image/png', 11 * MB)), 'frontId');
      render();
      expect(component.fileErrors()['frontId']).toContain('حجم الملف كبير جدًا');
      expect(component.fileErrors()['frontId']).toContain('10 ميغابايت');
      http.expectNone(r => r.url.endsWith('/documents/upload'));
      expect(el().querySelector('[data-testid="doc-file-errors"]')?.textContent).toContain('10 ميغابايت');
    });

    it('a wrong type is rejected naming PDF/JPG/PNG; a multi-file certificate batch names the bad file', () => {
      component.onFileSelected(pickEvent(file('a.zip', 'application/zip', 10)), 'selfie');
      expect(component.fileErrors()['selfie']).toContain('PDF أو JPG أو PNG');
      component.onFileSelected(pickEvent(file('ok.pdf', 'application/pdf', 10), file('bad.exe', 'application/octet-stream', 10)), 'certs');
      expect(component.fileErrors()['certs']).toContain('bad.exe');
      http.expectNone(r => r.url.endsWith('/documents/upload'));
    });

    it('a valid file clears the previous error and is uploaded', () => {
      component.onFileSelected(pickEvent(file('big.png', 'image/png', 11 * MB)), 'frontId');
      expect(component.fileErrors()['frontId']).toBeTruthy();
      component.onFileSelected(pickEvent(file('ok.png', 'image/png', 1000)), 'frontId');
      expect(component.fileErrors()['frontId']).toBeUndefined();
      const req = http.expectOne(r => r.url.endsWith('/documents/upload'));
      req.flush({ success: true, data: { url: 'https://x/ok.png', name: 'ok.png' } });
      expect(component.uploadedFrontId()).toBe('https://x/ok.png');
    });

    it('an upload that fails on the server explains why, in Arabic, naming the file', () => {
      component.onFileSelected(pickEvent(file('id.png', 'image/png', 1000)), 'frontId');
      http.expectOne(r => r.url.endsWith('/documents/upload')).flush({ message: 'Payload Too Large' }, { status: 413, statusText: 'Payload Too Large' });
      const msg = component.fileErrors()['frontId'];
      expect(msg).toContain('id.png');
      expect(msg).toContain('كبير');
      expect(msg.replace('id.png', '')).not.toMatch(/[A-Za-z]/);
    });

    it('portfolio sample: wrong type / oversize / failed upload are shown inline on step 5 for that specialty', () => {
      component.portfolioItems.set({ 'تطوير مواقع': [{ review: '', reviewDisplayName: '', proofs: [], proofDisplayNames: [] }] });
      component.currentStep.set(5); render();
      component.onPortfolioReviewChange(pickEvent(file('s.exe', 'application/x-msdownload', 10)), 'تطوير مواقع', 0);
      render();
      expect(component.fileErrors()['portfolio-تطوير مواقع']).toContain('نوع الملف غير مسموح');
      expect(el().querySelector('[data-testid="portfolio-file-errors"]')?.textContent).toContain('تطوير مواقع');
      component.onPortfolioReviewChange(pickEvent(file('s.pdf', 'application/pdf', 1000)), 'تطوير مواقع', 0);
      http.expectOne(r => r.url.endsWith('/documents/upload')).flush({}, { status: 429, statusText: 'Too Many Requests' });
      expect(component.fileErrors()['portfolio-تطوير مواقع']).toContain('المحاولات');
    });
  });

  it('step 5 without a work sample: summary names the specialty and the reason', () => {
    step1(); step2(); step3(); step4();
    component.currentStep.set(5);
    component.portfolioItems.set({ 'تطوير مواقع': [{ review: '', reviewDisplayName: '', proofs: [], proofDisplayNames: [] }] });
    component.goToStep(6);
    render();
    expect(component.currentStep()).toBe(5);
    expect(summary()).toContain('نموذج عمل: تطوير مواقع');
  });

  it('step 6: the final acknowledgement is a visible requirement with an Arabic message', () => {
    step1(); step2(); step3(); step4(); step5();
    component.currentStep.set(6);
    component.saveAndGoToTest();
    render();
    expect(component.currentStep()).toBe(6);
    expect(summary()).toContain('الإقرار والموافقة النهائية');
    expect(fieldErrors().some(t => t.includes('يجب الموافقة على الإقرار'))).toBe(true);
    http.expectNone(r => r.url.endsWith('/profiles/update'));
    expect((el().querySelector('.step-nav .btn-wz-next') as HTMLButtonElement).disabled).toBe(false);
  });

  it('the final submit jumps to the first incomplete step instead of a generic "بيانات ناقصة" pop-up', () => {
    step1(); step2(); step3(); // step 4 (front ID) missing
    component.currentStep.set(6);
    component.setupForm.get('agreements.ackFinal')!.setValue(true);
    component.saveAndGoToTest();
    expect(component.currentStep()).toBe(4);
    expect(component.alertModal()).toBeNull();
    expect(component.missing()[0].label).toContain('صورة الهوية');
  });

  describe('final save', () => {
    const allValid = () => { step1(); step2(); step3(); step4(); step5(); component.setupForm.get('agreements.ackFinal')!.setValue(true); component.currentStep.set(6); };
    // Finance #33: the PayPal email is no longer saved by the wizard; after a successful setup a code request goes out (none on a failed save).
    const passPaypal = () => http.match(r => r.method === 'POST' && r.url.endsWith('/profiles/paypal-email/change/request')).forEach(r => r.flush({ data: { emailSent: true, emailHint: 'ow***@example.com' } }));

    it('a failed proof upload leaves an empty placeholder: it is never sent to the backend', () => {
      allValid();
      component.portfolioItems.set({ 'تطوير مواقع': [{ review: 'r-url', reviewDisplayName: 'r', proofs: ['', 'p-url'], proofDisplayNames: ['x', 'p'] }] });
      vi.spyOn(component, 'goToStep').mockImplementation(() => {});
      component.saveAndGoToTest();
      passPaypal();
      expect(save.mock.calls[0][0].portfolio['تطوير مواقع'][0].proofs).toEqual(['p-url']);
    });

    it('the backend 400 about a skill (Arabic) is shown next to the skills (step 1) and listed in the summary', () => {
      allValid();
      save.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'اختر مهارات موجودة في دليل المهارات' } })));
      component.saveAndGoToTest();
      passPaypal();
      render();
      expect(component.currentStep()).toBe(1);
      expect(component.skillsServerError()).toContain('المهارات');
      expect(el().querySelector('#skills-server-error')?.textContent).toContain('المهارات');
      expect(summary()).toContain('المهارات');
      expect(component.isSubmitting()).toBe(false);
    });

    it('zod errors[] on fields of earlier steps return to that step (PayPal -> step 3, occupation -> step 1) with the field error set', () => {
      vi.useFakeTimers();
      allValid();
      save.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'Validation Error', errors: [{ path: 'body.paypalPayoutEmail', message: 'بريد PayPal غير صحيح' }] } })));
      component.saveAndGoToTest();
      passPaypal();
      vi.advanceTimersByTime(500);
      expect(component.currentStep()).toBe(3);
      expect(component.setupForm.get('payout.paypalEmail')!.errors?.['server']).toBe('بريد PayPal غير صحيح');
      expect(component.alertModal()).toBeNull();

      allValid();
      save.mockReturnValue(throwError(() => ({ status: 400, error: { errors: [{ path: 'details.occupation', message: 'المسمى غير مقبول' }] } })));
      component.saveAndGoToTest();
      passPaypal();
      vi.advanceTimersByTime(500);
      expect(component.currentStep()).toBe(1);
      expect(component.setupForm.get('profData.jobTitle')!.errors?.['server']).toBe('المسمى غير مقبول');
      vi.useRealTimers();
    });

    it('429 / 500 / network on save are shown in Arabic only', () => {
      for (const [status, body] of [[429, { message: 'Too many requests from this IP, please try again after 15 minutes' }], [500, { message: 'Internal Server Error' }], [0, undefined]] as const) {
        allValid();
        save.mockReturnValue(throwError(() => ({ status, error: body })));
        component.saveAndGoToTest();
        passPaypal();
        expect(component.alertModal()?.message).not.toMatch(/[A-Za-z]/);
      }
    });

    it('the PayPal email is not saved by the setup: after the setup is saved a code is requested and the confirm step opens (#33)', () => {
      allValid();
      vi.spyOn(component, 'goToStep').mockImplementation(() => {});
      component.saveAndGoToTest();
      http.expectNone(r => r.method === 'PUT' && r.url.endsWith('/profiles/update'));
      expect(save).toHaveBeenCalled();
      const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/profiles/paypal-email/change/request'));
      expect(req.request.body).toEqual({ paypalEmail: 'me@example.com' });
      req.flush({ data: { emailSent: true, emailHint: 'ow***@example.com' } });
      expect(component.pendingPaypalEmail()).toBe('me@example.com');
    });
  });
});
