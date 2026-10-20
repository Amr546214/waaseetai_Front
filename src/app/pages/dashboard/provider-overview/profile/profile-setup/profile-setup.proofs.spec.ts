import { ChangeDetectorRef, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService } from '../../../../../core/services/setup-test.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Step 5 (business models): every chosen sub-specialty needs a model FILE and a completed PROOF of ownership that is a different file. Missing / running / failed
// / reused-file proofs block both the step and the final submit, each with its own message UNDER the attachment; a stored proof counts through its marker.
const SPEC = 'تطوير مواقع';
describe('provider setup step 5: proof of ownership is required', () => {
  let fixture: ComponentFixture<ProfileSetupDashboard>;
  let c: ProfileSetupDashboard;
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
    c = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    // steps 1-4 valid, the sub-specialty chosen (selectedSpecs after the form patch: changing the main specialty resets it)
    c.setupForm.get('profData')!.patchValue({ jobTitle: 'مطور', expYears: '1 الى 3 سنوات', country: 'السعودية', city: 'الرياض', bio: 'نبذة' });
    c.setupForm.get('specialties')!.patchValue({ mainSpec: 'web', subSpecs: [SPEC] });
    c.selectedSpecs.set([SPEC]);
    c.setupForm.get('payout')!.patchValue({ paypalEmail: 'me@example.com' });
    c.uploadedFrontId.set('front-url');
    c.currentStep.set(5);
  });
  afterEach(() => { fixture.destroy(); });

  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const set = (item: object) => c.portfolioItems.set({ [SPEC]: [{ review: '', reviewDisplayName: '', proofs: [], proofDisplayNames: [], ...item }] });
  const text = (id: string) => el().querySelector(`[data-testid="${id}"]`)?.textContent || '';
  const next = () => { c.goToStep(6); render(); };
  const setState = (key: string, status: 'uploading' | 'uploaded' | 'error') => (c as any).setUploadState(key, { status, progress: 0, name: 'f' });

  it('model file but NO proof: the step is refused with the message under the proof slot, the slot is red-bordered and aria-invalid', () => {
    set({ review: 'r-url', reviewDisplayName: 'r.pdf' });
    next();
    expect(c.currentStep()).toBe(5);
    expect(text('pf-proof-error')).toContain('أرفق وثيقة إثبات ملكية واحدة على الأقل');
    expect(el().querySelector('.pw-col-proof')!.classList.contains('has-error')).toBe(true);
    expect(el().querySelector('.pw-col-proof input[type="file"]')!.getAttribute('aria-invalid')).toBe('true');
    expect(el().querySelector('.pw-col-proof input[type="file"]')!.getAttribute('aria-required')).toBe('true');
    expect(el().querySelector('[data-testid="portfolio-file-errors"]')).toBeNull();
  });

  it('a proof that is still uploading, or whose upload failed, is not a proof: each says so under the slot', () => {
    set({ review: 'r-url', reviewDisplayName: 'r.pdf', proofs: [''], proofDisplayNames: ['p.pdf'] });
    setState(`portfolio-proof-${SPEC}-0-0`, 'uploading');
    next();
    expect(c.currentStep()).toBe(5);
    expect(text('pf-proof-error')).toContain('انتظر اكتمال رفع وثيقة الإثبات');
    setState(`portfolio-proof-${SPEC}-0-0`, 'error');
    next();
    expect(text('pf-proof-error')).toContain('فشل رفع وثيقة الإثبات «p.pdf»');
  });

  it('the model file reused as its own proof is refused; the model file is never turned into a proof', () => {
    set({ review: 'same-url', reviewDisplayName: 'r.pdf', proofs: ['same-url'], proofDisplayNames: ['r.pdf'] });
    next();
    expect(c.currentStep()).toBe(5);
    expect(text('pf-proof-error')).toContain('ملفًا مختلفًا');
    expect((c as any).sanitizePortfolioForPayload(c.portfolioItems())[SPEC][0].proofs).toEqual(['same-url']);
  });

  it('a proof but no model file is refused under the model file slot', () => {
    set({ proofs: ['p-url'], proofDisplayNames: ['p.pdf'] });
    next();
    expect(c.currentStep()).toBe(5);
    expect(text('pf-review-error')).toContain('ارفع ملف نموذج العمل');
  });

  it('an extra model card with a file but no proof blocks too; an untouched extra card is ignored', () => {
    c.portfolioItems.set({ [SPEC]: [
      { review: 'r1', reviewDisplayName: 'a', proofs: ['p1'], proofDisplayNames: ['p'] },
      { review: 'r2', reviewDisplayName: 'b', proofs: [], proofDisplayNames: [] },
    ] });
    next();
    expect(c.currentStep()).toBe(5);
    expect(c.fileErr(`pf-proof-${SPEC}-1`)).toContain('أرفق وثيقة إثبات');
    c.portfolioItems.set({ [SPEC]: [
      { review: 'r1', reviewDisplayName: 'a', proofs: ['p1'], proofDisplayNames: ['p'] },
      { review: '', reviewDisplayName: '', proofs: [], proofDisplayNames: [] },
    ] });
    next();
    expect(c.currentStep()).toBe(6);
  });

  it('file + completed proof: the step passes, the errors are gone, and the final submit carries both', () => {
    set({ review: 'r-url', reviewDisplayName: 'r.pdf' });
    next();
    expect(c.fileErr(`pf-proof-${SPEC}-0`)).not.toBe('');
    set({ review: 'r-url', reviewDisplayName: 'r.pdf', proofs: ['p-url'], proofDisplayNames: ['p.pdf'] });
    next();
    expect(c.currentStep()).toBe(6);
    expect(c.fileErr(`pf-proof-${SPEC}-0`)).toBe('');
    c.setupForm.get('agreements.ackFinal')!.setValue(true);
    vi.spyOn(c, 'goToStep').mockImplementation(() => {});
    c.saveAndGoToTest();
    http.match(r => r.method === 'POST').forEach(r => r.flush({ data: { emailSent: true } }));
    expect(save.mock.calls[0][0].portfolio[SPEC]).toEqual([{ review: 'r-url', proofs: ['p-url'], keepProofs: [] }]);
  });

  it('the final submit is refused for a missing proof even when the step bar was skipped, and nothing is sent', () => {
    set({ review: 'r-url', reviewDisplayName: 'r.pdf' });
    c.setupForm.get('agreements.ackFinal')!.setValue(true);
    c.currentStep.set(6);
    c.saveAndGoToTest();
    expect(save).not.toHaveBeenCalled();
    expect(c.currentStep()).toBe(5);
  });

  it('a stored proof (kept marker) counts, and is sent as a keep flag with the row id, never as a link', () => {
    c.portfolioItems.set({ [SPEC]: [{ id: 'row-1', review: 'kept:review', reviewDisplayName: 'work.pdf', proofs: ['kept:proof:0', 'kept:proof:1'], proofDisplayNames: ['a', 'b'] }] });
    next();
    expect(c.currentStep()).toBe(6);
    expect((c as any).sanitizePortfolioForPayload(c.portfolioItems())[SPEC]).toEqual([{ id: 'row-1', keepReview: true, proofs: [], keepProofs: [0, 1] }]);
  });

  it('remove then attach the SAME file again: the input is reset so the change fires, the upload starts again and the proof error clears', () => {
    set({ review: 'r-url', reviewDisplayName: 'r.pdf' });
    next();
    expect(c.fileErr(`pf-proof-${SPEC}-0`)).not.toBe('');
    const file = new File([new Uint8Array(10)], 'proof.pdf', { type: 'application/pdf' });
    const input = { files: [file], value: 'C:\\fakepath\\proof.pdf' };
    c.onPortfolioProofsChange({ target: input }, SPEC, 0);
    expect(input.value).toBe(''); // the browser fires "change" again for the same file
    http.expectOne(r => r.url.endsWith('/documents/upload')).flush({ data: { url: 'p-url', name: 'proof.pdf' } });
    expect(c.getPortfolioItems(SPEC)[0].proofs).toEqual(['p-url']);
    expect(c.fileErr(`pf-proof-${SPEC}-0`)).toBe('');
    c.removePortfolioProof(SPEC, 0, 0);
    expect(c.getPortfolioItems(SPEC)[0].proofs).toEqual([]);
    const again = { files: [file], value: 'C:\\fakepath\\proof.pdf' };
    c.onPortfolioProofsChange({ target: again }, SPEC, 0);
    http.expectOne(r => r.url.endsWith('/documents/upload')).flush({ data: { url: 'p-url-2', name: 'proof.pdf' } });
    expect(c.getPortfolioItems(SPEC)[0].proofs).toEqual(['p-url-2']);
  });

  it('removing a proof moves the later proofs\' upload states with them (a failed one stays failed at its new position)', () => {
    set({ review: 'r', reviewDisplayName: 'r', proofs: ['a', '', 'c'], proofDisplayNames: ['a', 'b', 'c'] });
    setState(`portfolio-proof-${SPEC}-0-1`, 'error');
    c.removePortfolioProof(SPEC, 0, 0);
    expect(c.getPortfolioItems(SPEC)[0].proofs).toEqual(['', 'c']);
    expect(c.getUploadState(`portfolio-proof-${SPEC}-0-0`)?.status).toBe('error');
    next();
    expect(text('pf-proof-error')).toContain('فشل رفع وثيقة الإثبات «b»');
  });

  it('backend PROOF_REQUIRED for a sub-specialty is shown under that model on step 5; DOCUMENT_REQUIRED under the front ID on step 4; neither is a pop-up', () => {
    set({ review: 'r-url', reviewDisplayName: 'r.pdf', proofs: ['p-url'], proofDisplayNames: ['p'] });
    c.setupForm.get('agreements.ackFinal')!.setValue(true);
    c.currentStep.set(6);
    save.mockReturnValueOnce(throwError(() => ({ status: 400, error: { message: 'x', errors: [{ path: `portfolio.${SPEC}`, field: `portfolio.${SPEC}`, message: `أرفق وثيقة إثبات ملكية واحدة على الأقل لنموذج تخصص «${SPEC}»`, code: 'PROOF_REQUIRED' }] } })));
    c.saveAndGoToTest();
    render();
    expect(c.alertModal()).toBeNull();
    expect(c.currentStep()).toBe(5);
    expect(text('pf-proof-error')).toContain('أرفق وثيقة إثبات');
    c.currentStep.set(6);
    save.mockReturnValueOnce(throwError(() => ({ status: 400, error: { message: 'x', errors: [{ path: 'identity.frontId', field: 'identity.frontId', message: 'صورة الهوية (الوجه الأمامي) مطلوبة، ارفع ملف PDF أو JPG أو PNG', code: 'DOCUMENT_REQUIRED' }] } })));
    c.saveAndGoToTest();
    render();
    expect(c.currentStep()).toBe(4);
    expect(text('doc-file-error-frontId')).toContain('مطلوبة');
  });

  it('a double click / Enter on the final submit sends ONE request while it is in flight', () => {
    const pending = new Subject<any>();
    save.mockReturnValue(pending);
    set({ review: 'r-url', reviewDisplayName: 'r.pdf', proofs: ['p-url'], proofDisplayNames: ['p'] });
    c.setupForm.get('agreements.ackFinal')!.setValue(true);
    c.currentStep.set(6);
    c.saveAndGoToTest(); c.saveAndGoToTest(); c.saveAndGoToTest();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
