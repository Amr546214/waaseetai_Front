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

  it('setup-test result without a correct-answers count shows the score only — no invented correct/wrong boxes', () => {
    const svc = TestBed.inject(SetupTestService) as any;
    svc.result.set({ score: 73.3, total: 15, message: 'تم' });
    component.currentStep.set(7);
    component.isTestStarted.set(true);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('73.3%');
    expect(text).toContain('في اختبار من 15 أسئلة');
    expect(text).not.toContain('إجابات صحيحة');
    expect(text).not.toContain('إجابات خاطئة');
    expect(text).not.toContain('بشكل صحيح');
  });

  it('setup-test result that carries a real correct count still shows it', () => {
    const svc = TestBed.inject(SetupTestService) as any;
    svc.result.set({ score: 80, total: 10, correct: 8, message: 'تم' });
    component.currentStep.set(7);
    component.isTestStarted.set(true);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('إجابات صحيحة');
    expect(text).toContain('إجابات خاطئة');
    expect(text).toContain('أديت 8 من أصل 10');
  });

  it('bio suggestion is disabled with an honest message and never calls the backend', () => {
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('[data-testid="bio-suggest-disabled"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('اقتراح النبذة غير متاح حاليًا');
    btn.click();
    http.expectNone((r) => r.url.includes('suggest-bio'));
    expect(fixture.nativeElement.querySelector('[data-testid="bio-preview"]')).toBeNull();
    // manual bio editing is untouched
    expect(component.setupForm.get('profData.bio')?.value).toBe('نبذتي الحالية');
    component.setupForm.get('profData.bio')?.setValue('نبذة مكتوبة يدويًا');
    expect(component.setupForm.get('profData.bio')?.value).toBe('نبذة مكتوبة يدويًا');
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
    component.setupForm.patchValue({ profData: { expYears: '1 الى 3 سنوات', country: 'السعودية', city: 'الرياض' }, specialties: { mainSpec: 'web' }, bank: { bankName: 'بنك', accountOwner: 'اسم', iban: 'SA123' }, agreements: { ackFinal: true } });
    component.uploadedFrontId.set('existing-document');
    vi.spyOn(component, 'goToStep').mockImplementation(() => {});
    component.saveAndGoToTest();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ skills: ['HTML', 'CSS'] }));
  });
});
