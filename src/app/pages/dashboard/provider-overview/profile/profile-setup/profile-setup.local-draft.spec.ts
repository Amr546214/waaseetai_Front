import { signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService } from '../../../../../core/services/setup-test.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Setup wizard: the photo is persisted (and never reported as there when the upload failed), skills come from the chosen field's catalog, the date of birth round-trips.
const STORED = 'https://res.cloudinary.com/demo/image/upload/v1/waseetai/users/u1/avatar/me.jpg';
const DESIGN = ['Figma', 'Adobe Photoshop', 'تصميم الشعارات'];
const CATEGORIES = [
  { id: 'c1', slug: 'programming-development', nameAr: 'برمجة وتطوير' },
  { id: 'c2', slug: 'design-creative', nameAr: 'تصميم وإبداع' },
];

describe('provider setup wizard: local draft (refresh keeps the step and the answers)', () => {
  let fixture: ComponentFixture<ProfileSetupDashboard>;
  let component: ProfileSetupDashboard;
  let http: HttpTestingController;
  let save: ReturnType<typeof vi.fn>;
  const setup = async (stored: any) => {
    save = vi.fn(() => of({ success: true }));
    await TestBed.configureTestingModule({
      imports: [ProfileSetupDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => ({ id: 'u1', accountType: 'PROVIDER_INDIVIDUAL' }), updateUser: () => {} } },
        { provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data: stored }), saveProviderProfileSetup: save } },
        { provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: CATEGORIES }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
        { provide: SetupTestService, useValue: { needsExamEnvironment: signal(false), warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), isGenerating: signal(false), statusMsg: signal(''), disconnect: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileSetupDashboard);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  };
  afterEach(() => { http.match(r => r.url.includes('/legal-name')).forEach(r => r.flush({ success: true, data: { status: 'PROVIDED', legalName: 'اسم حقيقي كامل', changeNeedsReview: false, pendingRequest: null } })); http.match(r => r.url.includes('/public/geo-suggestion')).forEach(r => r.flush({ success: true, data: { source: 'none' } })); http.match(r => r.url.includes('/skills/catalog')).forEach(r => r.flush({ success: true, data: { category: null, skills: [] } })); http.verify(); fixture.destroy(); });

  beforeEach(() => localStorage.clear());

  it('after a refresh the wizard returns to the step the person was on, with the typed answers, even though nothing was saved on the server', async () => {
    localStorage.setItem('waseet.provider-setup-draft.v1.u1', JSON.stringify({ v: 1, at: 1, step: 3, form: { profData: { jobTitle: 'مطور ويب', bio: 'نبذة محفوظة محليًا' }, payout: { paypalEmail: 'me@x.co' } }, skills: ['HTML'], specs: [], portfolio: {}, avatarUrl: '' }));
    await setup({ skills: [] });
    expect(component.currentStep()).toBe(3);
    expect(component.setupForm.get('profData.jobTitle')?.value).toBe('مطور ويب');
    expect(component.setupForm.get('payout.paypalEmail')?.value).toBe('me@x.co');
    expect(component.skillsList()).toEqual(['HTML']);
  });

  it('typing is written to the draft of THIS account only, and a draft of another account is not used', async () => {
    localStorage.setItem('waseet.provider-setup-draft.v1.other', JSON.stringify({ v: 1, at: 1, step: 5, form: {}, skills: [], specs: [], portfolio: {}, avatarUrl: '' }));
    await setup({ skills: [] });
    expect(component.currentStep()).toBe(1);
    component.skillsList.set(['CSS']); fixture.detectChanges(); TestBed.flushEffects?.();
    const stored = JSON.parse(localStorage.getItem('waseet.provider-setup-draft.v1.u1') || 'null');
    expect(stored?.skills).toEqual(['CSS']);
  });

  it('a successful final save erases the draft', async () => {
    localStorage.setItem('waseet.provider-setup-draft.v1.u1', JSON.stringify({ v: 1, at: 1, step: 1, form: {}, skills: [], specs: [], portfolio: {}, avatarUrl: '' }));
    await setup({ skills: [] });
    component.setupForm.patchValue({ profData: { jobTitle: 'مصمم', expYears: '1 الى 3 سنوات', country: 'السعودية', city: 'الرياض', bio: 'x'.repeat(60) }, specialties: { mainSpec: 'design-creative', subSpecs: ['تصميم جرافيك'] }, payout: { paypalEmail: 'me@example.com' }, agreements: { ackFinal: true } });
    component.uploadedFrontId.set('existing-document');
    component.portfolioItems.set({ 'تصميم جرافيك': [{ review: 'sample-url', reviewDisplayName: 's.pdf', proofs: ['proof-url'], proofDisplayNames: ['p.pdf'] }] });
    vi.spyOn(component, 'goToStep').mockImplementation(() => {});
    component.saveAndGoToTest();
    expect(save).toHaveBeenCalled();
    http.match(r => r.url.includes('paypal-email')).forEach(r => r.flush({ success: true, data: { emailSent: false } }));
    expect(localStorage.getItem('waseet.provider-setup-draft.v1.u1')).toBeNull();
  });

  it('the document number is required until the identity has been sent or approved', async () => {
    await setup({ skills: [] });
    const c = component.setupForm.get('docs.idNumber')!;
    c.setValue(''); c.markAsTouched(); fixture.detectChanges();
    expect(c.hasError('required')).toBe(true);
    expect(component.documentError('idNumber')).toBe('أدخل رقم الوثيقة');
    component.kycPending.set(true); fixture.detectChanges(); TestBed.flushEffects?.();
    expect(c.hasError('required')).toBe(false);
  });
});
