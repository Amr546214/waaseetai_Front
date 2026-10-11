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

// Coming back to the wizard after the identity was sent (or decided): the wizard says so, never asks for the same file again, and cannot send a second one while it is waiting.
const FRONT = { private: true, legacy: false };
const iv = (status: string, rejectionReason: string | null = null) => ({ status, category: 'KYC', requestId: null, submittedAt: null, rejectionReason });

describe('provider setup wizard: identity review state', () => {
  let fixture: ComponentFixture<ProfileSetupDashboard>;
  let component: ProfileSetupDashboard;
  let http: HttpTestingController;

  const setup = async (stored: any) => {
    await TestBed.configureTestingModule({
      imports: [ProfileSetupDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => null } },
        { provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data: stored }), saveProviderProfileSetup: vi.fn(() => of({ success: true })) } },
        { provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: [] }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
        { provide: SetupTestService, useValue: { warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), isGenerating: signal(false), statusMsg: signal(''), disconnect: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileSetupDashboard);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    component.currentStep.set(4); fixture.detectChanges();
  };
  afterEach(() => { http.match(r => r.url.includes('/skills/catalog')).forEach(r => r.flush({ success: true, data: { category: null, skills: [] } })); http.verify(); fixture.destroy(); });
  const q = (s: string) => fixture.nativeElement.querySelector(s) as HTMLElement | null;
  const frontInput = () => q('input[aria-label="رفع صورة الهوية، وجه"]') as HTMLInputElement | null;

  it('PENDING_REVIEW: the waiting note shows, the stored file is listed, the uploads are disabled and step 4 does not demand the file again', async () => {
    await setup({ frontIdUrlAccess: FRONT, kycStatus: 'PENDING', identityVerification: iv('PENDING_REVIEW') });
    expect(q('[data-testid="kyc-pending-note"]')!.textContent).toContain('قيد المراجعة');
    expect(q('[data-testid="kyc-verified-note"]')).toBeNull();
    expect(q('.uploaded-file')!.textContent).toContain('يوجد مستند مرفوع سابقًا');
    expect(frontInput()!.disabled).toBe(true);
    component.currentStep.set(4);
    (component as any).goToStep(5);
    expect(component.currentStep()).toBe(5); // not blocked by "ID required"
  });

  it('the state comes from the backend identityVerification even when only a DOCUMENTS request (profile page) is waiting (no stored front, kycStatus untouched)', async () => {
    await setup({ kycStatus: 'UNVERIFIED', identityVerification: { ...iv('PENDING_REVIEW'), category: 'DOCUMENTS', requestId: 'r1', submittedAt: '2026-10-10T10:00:00Z' } });
    expect(component.kycPending()).toBe(true);
    expect(q('[data-testid="kyc-pending-note"]')).not.toBeNull();
    component.currentStep.set(4);
    (component as any).goToStep(5);
    expect(component.currentStep()).toBe(5);
  });

  it('VERIFIED: "تم التحقق" note, nothing to send, uploads disabled', async () => {
    await setup({ frontIdUrlAccess: FRONT, kycStatus: 'VERIFIED', identityVerification: iv('VERIFIED') });
    expect(q('[data-testid="kyc-verified-note"]')!.textContent).toContain('تم التحقق');
    expect(q('[data-testid="kyc-pending-note"]')).toBeNull();
    expect(frontInput()!.disabled).toBe(true);
  });

  it('REJECTED: the admin reason is shown and the uploads are open again', async () => {
    await setup({ frontIdUrlAccess: FRONT, kycStatus: 'REJECTED', kycRejectionReason: 'ignored', identityVerification: iv('REJECTED', 'الصورة غير واضحة') });
    expect(q('[data-testid="kyc-rejected-note"]')!.textContent).toContain('الصورة غير واضحة');
    expect(q('[data-testid="kyc-pending-note"]')).toBeNull();
    expect(frontInput()!.disabled).toBe(false);
  });

  it('NOT_SUBMITTED: no note, the front is required and uploads are open', async () => {
    await setup({ kycStatus: 'UNVERIFIED', identityVerification: iv('NOT_SUBMITTED') });
    expect(q('[data-testid="kyc-pending-note"]')).toBeNull();
    expect(q('[data-testid="kyc-rejected-note"]')).toBeNull();
    expect(frontInput()!.disabled).toBe(false);
    (component as any).goToStep(5);
    expect(component.currentStep()).toBe(4); // blocked: the front of the ID is required
  });

  it('an older backend answer without identityVerification still works from kycStatus', async () => {
    await setup({ frontIdUrlAccess: FRONT, kycStatus: 'PENDING' });
    expect(component.kycPending()).toBe(true);
  });
});
