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

describe('provider setup wizard: photo, skills catalog, date of birth', () => {
  let fixture: ComponentFixture<ProfileSetupDashboard>;
  let component: ProfileSetupDashboard;
  let http: HttpTestingController;
  let save: ReturnType<typeof vi.fn>;

  const setup = async (stored: any) => {
    save = vi.fn(() => of({ success: true }));
    await TestBed.configureTestingModule({
      imports: [ProfileSetupDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => null } },
        { provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data: stored }), saveProviderProfileSetup: save } },
        { provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: CATEGORIES }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
        { provide: SetupTestService, useValue: { warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), isGenerating: signal(false), statusMsg: signal(''), disconnect: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileSetupDashboard);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  };
  afterEach(() => { http.match(r => r.url.includes('/skills/catalog')).forEach(r => r.flush({ success: true, data: { category: null, skills: [] } })); http.verify(); fixture.destroy(); });
  const catalog = (skills: string[]) => http.expectOne(r => r.url.includes('/skills/catalog')).flush({ success: true, data: { category: 'design-creative', skills } });
  const pick = (file: File) => component.onAvatarSelected({ target: { files: [file] } });
  const png = () => new File([new Uint8Array([1, 2, 3])], 'me.png', { type: 'image/png' });
  const completeAndSave = () => {
    component.setupForm.patchValue({ profData: { jobTitle: 'مصمم', expYears: '1 الى 3 سنوات', country: 'السعودية', city: 'الرياض', bio: 'x'.repeat(60) }, specialties: { mainSpec: 'design-creative', subSpecs: ['تصميم جرافيك'] }, payout: { paypalEmail: 'me@example.com' }, agreements: { ackFinal: true } });
    component.uploadedFrontId.set('existing-document');
    component.portfolioItems.set({ 'تصميم جرافيك': [{ review: 'sample-url', reviewDisplayName: 's.pdf', proofs: [], proofDisplayNames: [] }] });
    vi.spyOn(component, 'goToStep').mockImplementation(() => {});
    component.saveAndGoToTest();
  };

  it('a photo already stored on the account is shown again after a refresh and counts in the progress ring', async () => {
    await setup({ avatarUrl: STORED, skills: [] });
    expect(component.avatarPreview()).toBe(STORED);
    expect(component.avatarUrl()).toBe(STORED);
    expect(component.profileCompletionPct()).toBeGreaterThanOrEqual(50);
  });

  it('upload succeeded: the status says it is uploaded, and the setup SAVE carries the photo URL (so the account really stores it)', async () => {
    await setup({ skills: [] });
    pick(png());
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/provider/profile/documents/upload')).flush({ data: { url: STORED } });
    fixture.detectChanges();
    expect(component.avatarUrl()).toBe(STORED);
    expect(fixture.nativeElement.querySelector('[data-testid="avatar-status"]').textContent).toContain('تم رفع الصورة');
    expect(fixture.nativeElement.querySelector('[data-testid="avatar-error"]')).toBeNull();
    completeAndSave();
    http.match(r => r.url.includes('/profiles/paypal-email')).forEach(r => r.flush({ data: {} }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: STORED }));
  });

  it('upload FAILED: no "saved" message, an error is shown, the preview goes back to the stored photo and the save carries no photo', async () => {
    await setup({ skills: [] });
    pick(png());
    http.expectOne(r => r.url.endsWith('/provider/profile/documents/upload')).flush({ message: 'x' }, { status: 500, statusText: 'err' });
    fixture.detectChanges();
    expect(component.avatarUrl()).toBe('');
    expect(component.avatarPreview()).toBe('');
    expect(fixture.nativeElement.querySelector('[data-testid="avatar-error"]').textContent).toContain('تعذّر رفع الصورة');
    expect(fixture.nativeElement.querySelector('[data-testid="avatar-status"]')).toBeNull();
    expect(component.profileCompletionPct()).toBe(20); // the failed photo adds nothing
    completeAndSave();
    http.match(r => r.url.includes('/profiles/paypal-email')).forEach(r => r.flush({ data: {} }));
    expect(save.mock.calls[0][0]).not.toHaveProperty('avatarUrl');
  });

  it('a failed re-upload restores the previously stored photo instead of the failed one', async () => {
    await setup({ avatarUrl: STORED, skills: [] });
    pick(png());
    http.expectOne(r => r.url.endsWith('/provider/profile/documents/upload')).flush({}, { status: 500, statusText: 'err' });
    expect(component.avatarUrl()).toBe(STORED);
    expect(component.avatarPreview()).toBe(STORED);
  });

  it('the skills picker offers ONLY the catalog of the chosen main specialty, and picking adds a chip (no free text)', async () => {
    await setup({ mainSpecialty: 'design-creative', skills: [{ name: 'Figma' }] });
    catalog(DESIGN);
    component.currentStep.set(2); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(component.skillOptions()).toEqual(DESIGN);
    // step 1 («مهاراتي») and step 2 hold the same picker over the same state: read the step-2 one
    const step2 = el.querySelector('[formgroupname="specialties"]') as HTMLElement;
    expect([...step2.querySelectorAll('[data-testid="skills-options"] [data-skill]')].map(b => b.getAttribute('data-skill'))).toEqual(['Adobe Photoshop', 'تصميم الشعارات']); // Figma is already selected
    expect(el.querySelector('input.skills-input')).toBeNull(); // the old free-text box is gone
    (step2.querySelector('[data-skill="Adobe Photoshop"]') as HTMLElement).click();
    expect(component.skillsList()).toEqual(['Figma', 'Adobe Photoshop']);
  });

  it('the skills picker sits in the SAME step as the main specialty (step 2), after it: skills are chosen once the field is known', async () => {
    await setup({ skills: [] });
    const panel = fixture.nativeElement.querySelector('[formgroupname="specialties"]') as HTMLElement;
    expect(panel.querySelector('[data-testid="skills-picker"]')).not.toBeNull();
    const step1 = fixture.nativeElement.querySelector('[formgroupname="profData"]') as HTMLElement;
    // step 1 holds «مهاراتي» (the place that used to be «اللغات»): with no specialty chosen it only says to choose one, with no picker and no languages chips
    expect(step1.querySelector('[data-testid="my-skills-need-specialty"]')).not.toBeNull();
    expect(step1.querySelector('[data-testid="skills-picker"]')).toBeNull();
    expect(step1.textContent).not.toContain('اللغات');
    expect(panel.querySelector('#main-spec')!.compareDocumentPosition(panel.querySelector('[data-testid="skills-picker"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('with no main specialty chosen there are no options and the picker says to choose the field first', async () => {
    await setup({ skills: [] });
    component.currentStep.set(2); fixture.detectChanges();
    expect(component.skillOptions()).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-testid="skills-need-field"]').textContent).toContain('اختر التخصص الرئيسي');
  });

  it('changing the main specialty removes the skills that do not belong to the new field and tells the user', async () => {
    await setup({ mainSpecialty: 'programming-development', skills: [{ name: 'React' }, { name: 'Figma' }] });
    http.expectOne(r => r.url.includes('/skills/catalog')).flush({ success: true, data: { category: 'programming-development', skills: ['React', 'Node.js'] } });
    component.onMainSpecUserChange();
    component.setupForm.get('specialties.mainSpec')?.setValue('design-creative');
    catalog(DESIGN);
    expect(component.skillsList()).toEqual(['Figma']);
    expect(component.skillsNotice()).toContain('أُزيلت 1 مهارة');
  });

  it('the date of birth stored on the account is shown, and a changed one is sent with the save; an invalid one blocks', async () => {
    await setup({ dob: '1990-05-17T00:00:00.000Z', skills: [] });
    expect(component.setupForm.get('profData.dob')?.value).toBe('1990-05-17');
    component.setupForm.get('profData.dob')?.setValue('2999-01-01');
    expect(component.setupForm.get('profData.dob')?.invalid).toBe(true);
    component.setupForm.get('profData.dob')?.setValue('1992-02-03');
    expect(component.setupForm.get('profData.dob')?.valid).toBe(true);
    completeAndSave();
    http.match(r => r.url.includes('/profiles/paypal-email')).forEach(r => r.flush({ data: {} }));
    expect(save.mock.calls[0][0].details.dob).toBe('1992-02-03');
  });

  it('«مهاراتي» in step 1: with a main specialty the catalog picker shows the saved skills, and the save sends skills but NEVER languages', async () => {
    await setup({ mainSpecialty: 'design-creative', skills: [{ name: 'Figma' }] });
    catalog(DESIGN);
    fixture.detectChanges();
    const step1 = fixture.nativeElement.querySelector('[formgroupname="profData"]') as HTMLElement;
    expect(step1.querySelector('[data-testid="my-skills-step1"]')).not.toBeNull();
    expect(step1.querySelector('[data-testid="skills-picker"]')).not.toBeNull();
    expect(component.skillsList()).toEqual(['Figma']);
    expect(step1.textContent).toContain('مهاراتي');
    expect(JSON.stringify((component as any).setupForm.value)).not.toContain('العربية');
  });
});
