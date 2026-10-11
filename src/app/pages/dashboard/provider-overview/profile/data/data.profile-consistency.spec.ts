import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { messageForBackendCode } from '../../../../../core/forms/http-error';
import { AuthStore } from '../../../../../core/store/auth.store';

// Provider data page: what was saved comes back the same after a refresh (photo, specialty + sub-specialties + skills, phone, date of birth).
const STORED_AVATAR = 'https://res.cloudinary.com/demo/image/upload/v1/waseetai/users/u1/avatar/me.jpg';
const CATEGORIES = [
  { id: 'c1', slug: 'programming-development', nameAr: 'برمجة وتطوير', specialties: [{ id: 's1', nameAr: 'تطوير Python' }, { id: 's2', nameAr: 'تطوير الواجهات الأمامية' }] },
  { id: 'c2', slug: 'design-creative', nameAr: 'تصميم وإبداع', specialties: [{ id: 's3', nameAr: 'تصميم جرافيك' }] },
];
const BASE = {
  headline: 'مطور', mainSpecialty: 'programming-development', subSpecialties: ['تطوير Python'], bio: 'x'.repeat(60), country: 'السعودية', city: 'الرياض', location: '',
  hourlyRate: null, yearsOfExperience: null, avatarUrl: STORED_AVATAR, completionPercentage: 100, missingItems: [],
  user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneCountryCode: '+966', phoneNumber: '501234567', alternativePhone: '', idDocumentUrl: null },
  certUrls: [], skills: [{ id: 'k1', name: 'Python' }], portfolioItems: [], languages: [],
};

describe('provider data page: stored values come back consistently', () => {
  let fixture: ComponentFixture<Data>;
  let component: Data;
  let updateBasicInfo: ReturnType<typeof vi.fn>;
  let getSkillsCatalog: ReturnType<typeof vi.fn>;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };

  const setup = (over: any = {}, userOver: any = {}) => {
    const profile = { ...BASE, ...over, user: { ...BASE.user, ...userOver } };
    updateBasicInfo = vi.fn(() => of({}));
    getSkillsCatalog = vi.fn((slug: string) => of({ success: true, data: { category: slug, skills: slug === 'design-creative' ? ['Figma', 'تصميم الشعارات'] : ['Python', 'React', 'Node.js'] } }));
    TestBed.configureTestingModule({
      imports: [Data],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { currentUser: () => null } },
        { provide: ProviderProfileService, useValue: {
          getProfile: vi.fn(() => of(profile)), getActiveSessions: vi.fn(() => of({ data: [] })), getChangeRequests: vi.fn(() => of([])),
          getSpecialtyCategories: () => of({ success: true, data: CATEGORIES }), getSkillsCatalog, updateBasicInfo,
          updateSkills: vi.fn((names: string[]) => of({ skills: names.map((n, i) => ({ id: `k${i}`, name: n })) })),
          savePaypalPayoutEmail: vi.fn(() => of({})), requestPaypalEmailChange: vi.fn(() => of({})),
        } },
      ],
    });
    fixture = TestBed.createComponent(Data);
    component = fixture.componentInstance;
    fixture.detectChanges();
    render();
  };
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

  it('photo: the stored photo is shown after a refresh and, when stored, the photo is not listed among the missing items', () => {
    setup();
    expect(component.avatarUrl()).toBe(STORED_AVATAR);
    expect(q('[data-testid="missing-items"]')).toBeNull();
    const img = el().querySelector('img[src="' + STORED_AVATAR + '"]');
    expect(img).not.toBeNull();
  });

  it('photo missing in the backend answer: the item stays in the list the backend sent (the page never hides it)', () => {
    setup({ avatarUrl: null, completionPercentage: 90, missingItems: [{ key: 'avatar', label: 'الصورة الشخصية', points: 10, status: 'missing', tab: 'profile', hint: 'أضف صورة شخصية' }] });
    expect(component.avatarUrl()).toBeNull();
    expect(q('[data-key="avatar"]')).not.toBeNull();
  });

  it('specialty: a stored category slug is selected; its sub-specialties and the field\'s skills catalog are offered', () => {
    setup();
    const select = q('#pr-spec') as HTMLSelectElement;
    expect(select.value).toBe('programming-development');
    expect([...select.options].filter(o => !o.disabled).map(o => o.textContent!.trim())).toEqual(['برمجة وتطوير', 'تصميم وإبداع']);
    expect(component.subSpecOptions()).toEqual(['تطوير Python', 'تطوير الواجهات الأمامية']);
    expect(component.selectedSubSpecs()).toEqual(['تطوير Python']);
    expect(getSkillsCatalog).toHaveBeenCalledWith('programming-development');
    expect(component.skillOptions()).toEqual(['Python', 'React', 'Node.js']);
  });

  it('specialty: an older stored Arabic NAME is shown as the matching category; free text that is not a marketplace specialty is flagged and must be re-picked', () => {
    setup({ mainSpecialty: 'تصميم وإبداع', subSpecialties: [] });
    expect((q('#pr-spec') as HTMLSelectElement).value).toBe('design-creative');
    TestBed.resetTestingModule(); fixture.destroy();
    setup({ mainSpecialty: 'مثال: تصميم الهوية البصرية' });
    expect((q('#pr-spec') as HTMLSelectElement).value).toBe('');
    expect(q('[data-testid="specialty-legacy"]')!.textContent).toContain('مثال: تصميم الهوية البصرية');
    expect(component.profileForm.get('specialty')?.valid).toBe(false);
  });

  it('changing the specialty swaps the sub-specialties and skills options, and warns what will be removed on save', () => {
    setup();
    const select = q('#pr-spec') as HTMLSelectElement;
    select.value = 'design-creative';
    select.dispatchEvent(new Event('change'));
    render();
    expect(component.subSpecOptions()).toEqual(['تصميم جرافيك']);
    expect(component.skillOptions()).toEqual(['Figma', 'تصميم الشعارات']);
    expect(component.selectedSubSpecs()).toEqual([]);
    expect(q('[data-testid="specialty-warning"]')!.textContent).toContain('1 تخصص فرعي و1 مهارة');
  });

  it('saving sends the category slug and the picked sub-specialties', () => {
    setup();
    component.toggleSubSpec('تطوير الواجهات الأمامية');
    component.saveProfile();
    const body = updateBasicInfo.mock.calls[0][0];
    expect(body.mainSpecialty).toBe('programming-development');
    expect(body.subSpecialties).toEqual(['تطوير Python', 'تطوير الواجهات الأمامية']);
  });

  it('skills: the picker saves every pick at once through the catalog-only endpoint', () => {
    setup();
    expect(component.skillNames()).toEqual(['Python']);
    component.onSkillsChange(['Python', 'React']);
    expect((TestBed.inject(ProviderProfileService) as any).updateSkills).toHaveBeenCalledWith(['Python', 'React']);
  });

  it('phone: +966 shows the code once and the national digits (no doubled code, no lost +)', () => {
    setup({}, { phoneCountryCode: '+966', phoneNumber: '+966501234567' });
    expect(q('[data-testid="phone-cc"]')!.textContent!.trim()).toBe('+966');
    expect((q('[data-testid="phone-input"]') as HTMLInputElement).value).toBe('501234567');
  });

  it('phone: Egypt +20 with a leading zero, and a legacy local Saudi number', () => {
    setup({}, { phoneCountryCode: '+20', phoneNumber: '01012345678' });
    expect(q('[data-testid="phone-cc"]')!.textContent!.trim()).toBe('+20');
    expect((q('[data-testid="phone-input"]') as HTMLInputElement).value).toBe('1012345678');
    TestBed.resetTestingModule(); fixture.destroy();
    setup({}, { phoneCountryCode: '+966', phoneNumber: '0500000000' });
    expect((q('[data-testid="phone-input"]') as HTMLInputElement).value).toBe('500000000');
  });

  it('date of birth: shown with its own clear label (not mixed with the ID expiry), editable, and sent with the save', () => {
    setup({ dob: '1990-05-17T00:00:00.000Z', kycStatus: 'UNVERIFIED' });
    const input = q('[data-testid="dob-input"]') as HTMLInputElement;
    expect(input.value).toBe('1990-05-17');
    expect(el().querySelector('label[for="pr-dob"]')!.textContent).toContain('تاريخ الميلاد');
    expect(el().textContent).not.toContain('الانتهاء/الميلاد');
    component.profileForm.get('dob')?.setValue('1991-01-02');
    component.saveProfile();
    expect(updateBasicInfo.mock.calls[0][0].dob).toBe('1991-01-02');
  });

  it('date of birth: a verified account sees it read-only and it is never sent', () => {
    setup({ dob: '1990-05-17T00:00:00.000Z', kycStatus: 'VERIFIED' });
    const input = q('[data-testid="dob-input"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('1990-05-17');
    expect(q('[data-testid="dob-hint"]')!.textContent).toContain('موثّق');
    component.saveProfile();
    expect(updateBasicInfo.mock.calls[0][0]).not.toHaveProperty('dob');
  });

  it('phone: a "+" number of another country gets its own Arabic message on the phone field', () => {
    expect(messageForBackendCode('INVALID_PHONE_COUNTRY')).toContain('رمز الدولة');
  });
});
