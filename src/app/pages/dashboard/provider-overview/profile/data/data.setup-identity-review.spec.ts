import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// The ID sent in the SETUP wizard (KYC review) is shown on the data page exactly like a DOCUMENTS request: under review / approved / refused, never "missing", never asked again.
const ITEM = (status: string, hint: string) => ({ key: 'idDocument', label: 'مستند إثبات الهوية', points: 10, status, tab: 'docs', hint });
const BASE = {
  headline: 'مصمم', mainSpecialty: 'design-creative', bio: 'x'.repeat(60), country: 'السعودية', city: 'الرياض', location: '', hourlyRate: null, yearsOfExperience: null,
  user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '501234567', alternativePhone: '', idDocumentUrl: null }, certUrls: [], skills: [{ name: 'Figma' }],
  portfolioItems: [], languages: [], paypalPayoutEmail: 'me@paypal.example', completionPercentage: 90,
  frontIdUrl: null, frontIdUrlAccess: { private: true, legacy: false },
};
const KYC_PENDING = { ...BASE, kycStatus: 'PENDING', missingItems: [ITEM('pending_review', 'مستند الهوية قيد المراجعة')], identityVerification: { status: 'PENDING_REVIEW', category: 'KYC', requestId: null, submittedAt: null, rejectionReason: null } };
const KYC_VERIFIED = { ...BASE, kycStatus: 'VERIFIED', completionPercentage: 100, missingItems: [], identityVerification: { status: 'VERIFIED', category: 'KYC', requestId: null, submittedAt: null, rejectionReason: null } };
const KYC_REJECTED = { ...BASE, kycStatus: 'REJECTED', missingItems: [ITEM('rejected', 'مرفوض — يحتاج تعديل')], identityVerification: { status: 'REJECTED', category: 'KYC', requestId: null, submittedAt: null, rejectionReason: 'الصورة غير واضحة' } };
const NOT_SENT = { ...BASE, frontIdUrlAccess: null, kycStatus: 'UNVERIFIED', missingItems: [ITEM('missing', 'ارفع مستند إثبات الهوية')], identityVerification: { status: 'NOT_SUBMITTED', category: null, requestId: null, submittedAt: null, rejectionReason: null } };

describe('provider data page: identity sent in the setup follows the review lifecycle', () => {
  let fixture: ComponentFixture<Data>;
  let component: Data;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };

  function setup(profile: any) {
    TestBed.configureTestingModule({
      imports: [Data],
      providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => null } },
        { provide: ProviderProfileService, useValue: {
          getProfile: () => of(profile), getSpecialtyCategories: () => of({ success: true, data: [] }), getSkillsCatalog: () => of({ success: true, data: { category: null, skills: [] } }),
          getActiveSessions: vi.fn(() => of({ data: [] })), getChangeRequests: vi.fn(() => of([])), initiateSensitiveChange: vi.fn(), verifySensitiveChange: vi.fn(),
          requestPaypalEmailChange: vi.fn(), confirmPaypalEmailChange: vi.fn(),
        } }],
    });
    fixture = TestBed.createComponent(Data); component = fixture.componentInstance;
    document.body.appendChild(el());
    fixture.detectChanges(); render();
    component.setTab('docs'); render();
  }
  afterEach(() => { el().remove(); fixture?.destroy(); TestBed.resetTestingModule(); });

  it('PENDING_REVIEW (sent in the setup): the checklist says "قيد المراجعة", not "ناقص"; the stored file is shown with a preview link; no new upload is asked or possible; the send button is blocked', () => {
    setup(KYC_PENDING);
    expect(q('[data-testid="miss-pending"]')!.textContent).toContain('قيد المراجعة');
    expect(q('[data-testid="miss-missing"]')).toBeNull();
    expect(q('#doc-card-idDocumentUrl')!.textContent).toContain('مستند الهوية المرسل');
    expect(q('#doc-card-idDocumentUrl app-kyc-document-link')).not.toBeNull();
    expect(q('#doc-card-idDocumentUrl')!.textContent).not.toContain('اختر ملفا للرفع');
    const pick = vi.spyOn(HTMLInputElement.prototype, 'click');
    (q('#doc-card-idDocumentUrl') as HTMLElement).click();
    expect(pick).not.toHaveBeenCalled();
    expect((q('[data-testid="save-docs-btn"]') as HTMLButtonElement).disabled).toBe(true);
    expect(component.identityVerification()!.category).toBe('KYC');
    pick.mockRestore();
  });

  it('VERIFIED (approved by the admin KYC review): "تم التحقق", off the checklist, still no upload prompt', () => {
    setup(KYC_VERIFIED);
    expect(q('[data-testid="missing-items"]')).toBeNull();
    expect(q('#doc-card-idDocumentUrl')!.textContent).not.toContain('اختر ملفا للرفع');
    expect(component.identityVerified()).toBe(true);
  });

  it('REJECTED (admin refused the identity from the setup): the reason is shown, the item says refused, and the user can pick a new file', () => {
    setup(KYC_REJECTED);
    expect(q('[data-testid="miss-rejected"]')!.textContent).toContain('مرفوض');
    expect(q('[data-testid="id-doc-rejected"]')!.textContent).toContain('الصورة غير واضحة');
    expect(q('#doc-card-idDocumentUrl')!.textContent).toContain('اختر ملفا للرفع');
    expect(component.documentState('idDocumentUrl')).toBeFalsy();
  });

  it('NOT_SUBMITTED: plainly missing and an upload is asked (nothing was sent)', () => {
    setup(NOT_SENT);
    expect(q('[data-testid="miss-missing"]')!.textContent).toContain('ناقص');
    expect(q('#doc-card-idDocumentUrl')!.textContent).toContain('اختر ملفا للرفع');
  });
});
