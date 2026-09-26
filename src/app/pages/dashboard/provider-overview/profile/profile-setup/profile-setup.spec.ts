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

// Real component/template + real API service with HttpTestingController.
// No real HTTP, SDK, socket, DB, auth-store or storage access.
describe('provider setup AI suggestions', () => {
  let fixture: ComponentFixture<ProfileSetupDashboard>;
  let component: ProfileSetupDashboard;
  let http: HttpTestingController;
  let save: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    save = vi.fn(() => of({ success: true }));
    await TestBed.configureTestingModule({
      imports: [ProfileSetupDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => null } },
        { provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data: { industry: 'مطور مواقع', bio: 'نبذتي الحالية', skills: [{ name: 'HTML' }] } }), saveProviderProfileSetup: save } },
        { provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: [] }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
        { provide: SetupTestService, useValue: { warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), isGenerating: signal(false), statusMsg: signal(''), disconnect: vi.fn() } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileSetupDashboard);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => { http.verify(); fixture.destroy(); });
  const request = (http: HttpTestingController, kind: string) => http.expectOne(req => req.url.endsWith(`/provider/profile/suggest-${kind}`));

  it('requests bio once, displays loading, then previews without overwriting or saving', () => {
    component.suggestBio();
    component.suggestBio();
    fixture.detectChanges();
    expect(component.isSuggestingBio()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('جاري إنشاء الاقتراح');
    const req = request(http, 'bio');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ jobTitle: 'مطور مواقع', mainSpecialty: undefined, experienceRange: undefined, existingSkills: ['HTML'] });
    expect(req.request.body.userId).toBeUndefined();
    req.flush({ success: true, data: { suggestedBio: 'أقدم خدمات تطوير المواقع.' } });
    fixture.detectChanges();
    expect(component.isSuggestingBio()).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="bio-preview"]').textContent).toContain('أقدم خدمات تطوير المواقع.');
    expect(component.setupForm.get('profData.bio')?.value).toBe('نبذتي الحالية');
    expect(save).not.toHaveBeenCalled();
  });

  it('applies bio only to the local form via the rendered apply button', () => {
    component.suggestBio();
    request(http, 'bio').flush({ success: true, data: { suggestedBio: 'نبذة جديدة' } });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="bio-preview"] button').click();
    expect(component.setupForm.get('profData.bio')?.value).toBe('نبذة جديدة');
    expect(component.suggestedBio()).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('dismisses preview and allows regeneration without changing bio', () => {
    component.suggestBio();
    request(http, 'bio').flush({ success: true, data: { suggestedBio: 'اقتراح أول' } });
    component.dismissBioSuggestion();
    expect(component.suggestedBio()).toBeNull();
    component.suggestBio();
    request(http, 'bio').flush({ success: true, data: { suggestedBio: 'اقتراح آخر' } });
    expect(component.suggestedBio()).toBe('اقتراح آخر');
    expect(component.setupForm.get('profData.bio')?.value).toBe('نبذتي الحالية');
  });

  it('Gemini failure clears preview, releases loading and never fabricates template content', () => {
    component.suggestedBio.set('اقتراح قديم');
    component.suggestBio();
    request(http, 'bio').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(component.suggestedBio()).toBeNull();
    expect(component.isSuggestingBio()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('تعذر إنشاء اقتراح بالذكاء الاصطناعي');
    expect(fixture.nativeElement.querySelector('[data-testid="bio-preview"]')).toBeNull();
    expect(component.setupForm.get('profData.bio')?.value).toBe('نبذتي الحالية');
    expect(fixture.nativeElement.textContent).not.toContain('اقتراح نموذج نبذة');
  });

  it('requests skills from the visible button, guards double submission and shows separate suggestions', () => {
    fixture.nativeElement.querySelector('[data-testid="suggest-skills"]').click();
    component.suggestSkills();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="suggest-skills"]').disabled).toBe(true);
    const req = request(http, 'skills');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.existingSkills).toEqual(['HTML']);
    req.flush({ success: true, data: { suggestedSkills: ['CSS', 'TypeScript'] } });
    fixture.detectChanges();
    expect(component.isSuggestingSkills()).toBe(false);
    expect(component.skillsList()).toEqual(['HTML']);
    expect(fixture.nativeElement.querySelectorAll('.ai-chips button').length).toBe(2);
    expect(save).not.toHaveBeenCalled();
  });

  it('adds only explicitly selected skills, preserves existing skills, prevents duplicates', () => {
    component.suggestSkills();
    request(http, 'skills').flush({ success: true, data: { suggestedSkills: ['html', 'CSS', 'css', 'TypeScript'] } });
    fixture.detectChanges();
    expect(component.aiSuggestedSkills()).toEqual(['CSS', 'TypeScript']);
    fixture.nativeElement.querySelector('.ai-chips button').click();
    component.addAiSkill('CSS');
    expect(component.skillsList()).toEqual(['HTML', 'CSS']);
    expect(component.aiSuggestedSkills()).toEqual(['TypeScript']);
    expect(save).not.toHaveBeenCalled();
  });

  it('a skill added while request is in flight is not suggested again', () => {
    component.suggestSkills();
    component.skillInput = 'CSS';
    component.addSkill(new Event('click'));
    request(http, 'skills').flush({ success: true, data: { suggestedSkills: ['CSS', 'TypeScript'] } });
    expect(component.aiSuggestedSkills()).toEqual(['TypeScript']);
    expect(component.skillsList()).toEqual(['HTML', 'CSS']);
  });

  it('shows skills error and preserves existing skills with no fallback', () => {
    component.suggestSkills();
    request(http, 'skills').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(component.isSuggestingSkills()).toBe(false);
    expect(component.aiSuggestedSkills()).toEqual([]);
    expect(component.skillsList()).toEqual(['HTML']);
    expect(fixture.nativeElement.textContent).toContain('تعذر إنشاء اقتراح بالذكاء الاصطناعي');
  });

  it('empty taxonomy result displays an honest empty state', () => {
    component.suggestSkills();
    request(http, 'skills').flush({ success: true, data: { suggestedSkills: [] } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('لا توجد اقتراحات مهارات جديدة');
  });

  it('normal save includes chosen skills; unselected suggestions are not sent', () => {
    component.aiSuggestedSkills.set(['CSS', 'TypeScript']);
    component.addAiSkill('CSS');
    component.setupForm.patchValue({ profData: { expYears: '1 الى 3 سنوات', city: 'الرياض' }, specialties: { mainSpec: 'web' }, bank: { bankName: 'بنك', accountOwner: 'اسم', iban: 'SA123' }, agreements: { ackFinal: true } });
    component.uploadedFrontId.set('existing-document');
    vi.spyOn(component, 'goToStep').mockImplementation(() => {});
    component.saveAndGoToTest();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ skills: ['HTML', 'CSS'] }));
  });
});
