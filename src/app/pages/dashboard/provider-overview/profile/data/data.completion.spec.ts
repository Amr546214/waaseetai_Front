import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// The provider edit page shows ONLY the backend's completion (percentage + missingItems); the old local formula is gone.
const BASE = {
  headline: 'مصمم', mainSpecialty: 'تصميم', bio: 'x'.repeat(60), country: 'السعودية', city: 'الرياض', location: '',
  hourlyRate: null, yearsOfExperience: null,
  user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '+966501234567', alternativePhone: '', idDocumentUrl: null },
  certUrls: [], skills: [{ name: 'Figma' }], portfolioItems: [], languages: [],
};
const MISSING_PAYPAL = { ...BASE, completionPercentage: 80, missingItems: [
  { key: 'payout', label: 'حساب PayPal لاستلام المدفوعات', points: 10, status: 'missing', tab: 'payout', hint: 'أضف بريد PayPal لاستلام المدفوعات' },
  { key: 'idDocument', label: 'مستند إثبات الهوية', points: 10, status: 'missing', tab: 'docs', hint: 'ارفع مستند إثبات الهوية' },
] };
const PENDING_ID = { ...BASE, completionPercentage: 90, missingItems: [
  { key: 'idDocument', label: 'مستند إثبات الهوية', points: 10, status: 'pending_review', tab: 'docs', hint: 'مستند الهوية قيد المراجعة' },
] };
const FULL = { ...BASE, completionPercentage: 100, missingItems: [], user: { ...BASE.user, idDocumentUrl: 'https://x.test/id.pdf' } };

describe('provider edit page: backend completion + missing items', () => {
  let fixture: ComponentFixture<Data>;
  let component: Data;
  let getProfile: ReturnType<typeof vi.fn>;

  const setup = (profile: any) => {
    getProfile = vi.fn(() => of(profile));
    TestBed.configureTestingModule({
      imports: [Data],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { currentUser: () => null } },
        { provide: ProviderProfileService, useValue: {
          getProfile, getActiveSessions: vi.fn(() => of({ data: [] })), getChangeRequests: vi.fn(() => of([])),
          updateSkills: vi.fn(() => of({ skills: [{ name: 'Figma' }, { name: 'Sketch' }] })), savePaypalPayoutEmail: vi.fn(() => of({})), requestPaypalEmailChange: vi.fn(() => of({ emailSent: true, emailHint: 'ow***@example.com' })),
        } },
      ],
    });
    fixture = TestBed.createComponent(Data);
    component = fixture.componentInstance;
    fixture.detectChanges();
    render();
  };
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const all = (s: string) => Array.from(el().querySelectorAll(s)) as HTMLElement[];

  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

  it('shows the backend percentage and the "complete your profile" box with every missing item', () => {
    setup(MISSING_PAYPAL);
    expect(q('#prog-pct')!.textContent).toContain('80%');
    expect(q('.miss-title')!.textContent).toContain('لإكمال ملفك إلى 100%، أكمل التالي:');
    expect(all('.miss-item').map(i => i.getAttribute('data-key'))).toEqual(['payout', 'idDocument']);
    expect(all('[data-testid="miss-missing"]').length).toBe(2);
    expect(q('[data-testid="miss-missing"]')!.textContent).toContain('+10%');
    expect(q('[data-testid="miss-pending"]')).toBeNull();
  });

  it('does NOT use the old local formula: no hourlyRate/yearsOfExperience dependency and no 75% from local data', () => {
    // Backend says 100 although hourlyRate / yearsOfExperience are empty (the old local formula would have lost 10 points).
    setup(FULL);
    expect(q('#prog-pct')!.textContent).toContain('100%');
    expect((component as any).calculateCompletion).toBeUndefined();
    expect(q('[data-testid="missing-items"]')).toBeNull();
    expect(q('[data-testid="prog-hint"]')!.textContent).toContain('مكتمل 100%');
  });

  it('a pending ID review is shown as "قيد المراجعة", not as missing', () => {
    setup(PENDING_ID);
    expect(q('#prog-pct')!.textContent).toContain('90%');
    expect(q('.miss-item')!.getAttribute('data-status')).toBe('pending_review');
    expect(q('[data-testid="miss-pending"]')!.textContent).toContain('قيد المراجعة');
    expect(q('[data-testid="miss-missing"]')).toBeNull();
    expect(q('.miss-title')!.textContent).not.toContain('أكمل التالي');
  });

  it('each item opens the matching tab', () => {
    setup(MISSING_PAYPAL);
    (q('.miss-link[data-tab="payout"]') as HTMLButtonElement).click(); render();
    expect(component.currentTab()).toBe('payout');
    (q('.miss-link[data-tab="docs"]') as HTMLButtonElement).click(); render();
    expect(component.currentTab()).toBe('docs');
  });

  it('item tabs map to the profile / contact / payout / docs tabs', () => {
    setup({ ...BASE, completionPercentage: 40, missingItems: [
      { key: 'bio', label: 'الوصف المهني', points: 15, status: 'missing', tab: 'profile', hint: 'h' },
      { key: 'contact', label: 'البريد ورقم الجوال', points: 10, status: 'missing', tab: 'contact', hint: 'h' },
    ] });
    (q('.miss-link[data-tab="contact"]') as HTMLButtonElement).click(); render();
    expect(component.currentTab()).toBe('contact');
    (q('.miss-link[data-tab="profile"]') as HTMLButtonElement).click(); render();
    expect(component.currentTab()).toBe('profile');
  });

  it('after confirming the PayPal email (e-mailed code) or adding a skill the completion is re-read from the backend', () => {
    setup(MISSING_PAYPAL);
    getProfile.mockReturnValue(of(PENDING_ID));
    component.payoutForm.patchValue({ paypalPayoutEmail: 'pay@example.com' });
    component.savePaypal();
    expect(component.pendingPaypalEmail()).toBe('pay@example.com'); // not saved yet: the code step is open
    component.onPaypalConfirmed('pay@example.com'); render();
    expect(q('#prog-pct')!.textContent).toContain('90%');
    expect(all('.miss-item').length).toBe(1);
  });
});
