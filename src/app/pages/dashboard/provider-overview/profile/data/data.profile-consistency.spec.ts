import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
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

  const phoneView = () => ({
    flag: q('[data-testid="contact-phone-flag"] img')?.getAttribute('src'), emoji: q('[data-testid="contact-phone-flag"]')?.textContent?.trim(), country: q('[data-testid="contact-phone-country"]')?.textContent?.trim(),
    code: q('[data-testid="contact-phone-code"]')?.textContent?.trim(), number: q('[data-testid="contact-phone-number"]')?.textContent?.trim(),
  });

  it('phone (read-only): the stored pair is shown as SVG flag (never an emoji) + country + code + LOCAL number, after a refresh: مصر / +20 / 1025073026', () => {
    setup({}, { phoneCountryCode: '+20', phoneNumber: '1025073026' });
    expect(phoneView()).toEqual({ flag: 'assets/flags/EG.svg', emoji: '', country: 'مصر', code: '+20', number: '1025073026' });
  });

  it('phone (read-only): Saudi Arabia is shown with +966', () => {
    setup({}, { phoneCountryCode: '+966', phoneNumber: '501234567' });
    expect(phoneView()).toEqual({ flag: 'assets/flags/SA.svg', emoji: '', country: 'المملكة العربية السعودية', code: '+966', number: '501234567' });
  });

  it('phone (read-only): an Egyptian number saved next to +966 (with or without a +) is shown as Egypt +20, never as a Saudi number', () => {
    for (const stored of ['201025073026', '+201025073026']) {
      setup({}, { phoneCountryCode: '+966', phoneNumber: stored });
      expect(phoneView()).toMatchObject({ flag: 'assets/flags/EG.svg', code: '+20', number: '1025073026' });
      TestBed.resetTestingModule(); fixture.destroy();
    }
  });

  it('phone (read-only): legacy shapes (leading zero, a full +CC number) show the local number only', () => {
    setup({}, { phoneCountryCode: '+966', phoneNumber: '0500000000' });
    expect(phoneView()).toMatchObject({ code: '+966', number: '500000000' });
    TestBed.resetTestingModule(); fixture.destroy();
    setup({}, { phoneCountryCode: '+966', phoneNumber: '+966501234567' });
    expect(phoneView()).toMatchObject({ code: '+966', number: '501234567' });
  });

  it('D4: the contact part has no emoji flag anywhere; the primary phone and the WhatsApp number use the local SVG flags with a visible LTR dial code', () => {
    setup({}, { phoneCountryCode: '+20', phoneNumber: '1025073026', alternativePhone: '+971501234567' });
    const contact = q('[data-testid="contact-readonly"]')!;
    expect(/[\u{1F1E6}-\u{1F1FF}]/u.test(contact.textContent || '')).toBe(false);
    expect(q('[data-testid="contact-phone-flag"] img')?.getAttribute('src')).toBe('assets/flags/EG.svg');
    expect(q('[data-testid="contact-whatsapp-flag"] img')?.getAttribute('src')).toBe('assets/flags/AE.svg');
    const code = q('[data-testid="contact-whatsapp-code"]') as HTMLElement;
    expect(code.textContent!.trim()).toBe('+971');
    expect(code.closest('[dir="ltr"]')).not.toBeNull();
  });

  it('D4: a shared dial code (+1) with no deciding digits is not given a guessed flag: globe + the dial code', () => {
    setup({}, { phoneCountryCode: '+1', phoneNumber: '999999', alternativePhone: '+1999999' });
    expect(q('[data-testid="contact-phone-flag"] img')).toBeNull();
    expect(q('[data-testid="contact-phone-flag"] [data-testid="flag-globe"]')).not.toBeNull();
    expect(q('[data-testid="contact-whatsapp-flag"] img')).toBeNull();
    expect(q('[data-testid="contact-whatsapp-code"]')!.textContent!.trim()).toBe('+1');
  });

  it('phone (read-only): no phone saved says "غير مضاف"; the e-mail is shown as stored', () => {
    setup({}, { phoneCountryCode: '+966', phoneNumber: '' });
    expect(q('[data-testid="contact-phone"]')!.textContent).toContain('غير مضاف');
    expect(q('[data-testid="contact-email"]')!.textContent!.trim()).toBe('a@b.co');
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
});
