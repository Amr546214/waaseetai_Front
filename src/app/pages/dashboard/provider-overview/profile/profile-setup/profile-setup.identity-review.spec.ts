import { IdentityGateService } from '../../../../../core/services/identity-gate.service';
import { FakeIdentityGate } from '../../../../../core/services/identity-gate.testing';
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

// Updated for the identity gate: the identity step shows the server's review state in place and the next step opens only on APPROVED; uploads stay open so a changed image/data re-locks.
// Coming back to the wizard after the identity was sent (or decided): the wizard says so, never asks for the same file again, and cannot send a second one while it is waiting.
const FRONT = { private: true, legacy: false };
const iv = (status: string, rejectionReason: string | null = null) => ({ status, category: 'KYC', requestId: null, submittedAt: null, rejectionReason });

describe('provider setup wizard: identity review state', () => {
  let fixture: ComponentFixture<ProfileSetupDashboard>;
  let component: ProfileSetupDashboard;
  let http: HttpTestingController;

  const setup = async (stored: any, gate: 'NOT_SUBMITTED' | 'UNDER_REVIEW' | 'REJECTED' | 'APPROVED' = 'NOT_SUBMITTED', reason: string | null = null) => {
    FakeIdentityGate.reset(gate); FakeIdentityGate.reason = reason;
    await TestBed.configureTestingModule({
      imports: [ProfileSetupDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => null } },
        { provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data: stored }), saveProviderProfileSetup: vi.fn(() => of({ success: true })) } },
        { provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: [] }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
        { provide: SetupTestService, useValue: { warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), isGenerating: signal(false), statusMsg: signal(''), disconnect: vi.fn() } },
      ],
    }).compileComponents();
    fixture = (TestBed.overrideComponent(ProfileSetupDashboard, { set: { providers: [{ provide: IdentityGateService, useClass: FakeIdentityGate }] } }), TestBed.createComponent(ProfileSetupDashboard));
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    component.currentStep.set(4); fixture.detectChanges();
  };
  afterEach(() => { http.match(r => r.url.includes('/skills/catalog')).forEach(r => r.flush({ success: true, data: { category: null, skills: [] } })); http.verify(); fixture.destroy(); });
  const q = (s: string) => fixture.nativeElement.querySelector(s) as HTMLElement | null;
  const frontInput = () => q('input[aria-label="رفع صورة الهوية، وجه"]') as HTMLInputElement | null;

  it('UNDER_REVIEW: «الوثيقة قيد المراجعة» in place, the stored file is listed and the next step stays closed', async () => {
    await setup({ frontIdUrlAccess: FRONT, kycStatus: 'PENDING', identityVerification: iv('PENDING_REVIEW') }, 'UNDER_REVIEW');
    fixture.detectChanges();
    expect(q('[data-testid="identity-gate-under-review"]')!.textContent).toContain('الوثيقة قيد المراجعة');
    expect(q('.uploaded-file')!.textContent).toContain('يوجد مستند مرفوع سابقًا');
    expect((q('[data-testid="identity-next"]') as HTMLButtonElement).disabled).toBe(true);
    (component as any).goToStep(5);
    expect(component.currentStep()).toBe(4);
    fixture.detectChanges();
    expect(q('[data-testid="identity-gate-problem"]')!.textContent).toContain('قيد المراجعة');
  });

  it('a DOCUMENTS request waiting (no stored front) is still the under-review state', async () => {
    await setup({ kycStatus: 'UNVERIFIED', identityVerification: { ...iv('PENDING_REVIEW'), category: 'DOCUMENTS', requestId: 'r1', submittedAt: '2026-10-10T10:00:00Z' } }, 'UNDER_REVIEW');
    fixture.detectChanges();
    expect(component.kycPending()).toBe(true);
    expect(q('[data-testid="identity-gate-under-review"]')).not.toBeNull();
    (component as any).goToStep(5);
    expect(component.currentStep()).toBe(4);
  });

  it('APPROVED: the approved panel shows and the next step opens', async () => {
    await setup({ frontIdUrlAccess: FRONT, kycStatus: 'VERIFIED', identityVerification: iv('VERIFIED') }, 'APPROVED');
    fixture.detectChanges();
    expect(q('[data-testid="identity-gate-approved"]')!.textContent).toContain('تم اعتماد الوثيقة');
    expect((q('[data-testid="identity-next"]') as HTMLButtonElement).disabled).toBe(false);
    (component as any).goToStep(5);
    expect(component.currentStep()).toBe(5);
  });

  it('REJECTED: the reason shows beside the upload, uploads stay open and the data stays', async () => {
    await setup({ frontIdUrlAccess: FRONT, kycStatus: 'REJECTED', idNumber: 'A1234567', identityVerification: iv('REJECTED', 'الصورة غير واضحة') }, 'REJECTED', 'الصورة غير واضحة');
    fixture.detectChanges();
    expect(q('[data-testid="identity-gate-reason"]')!.textContent).toContain('الصورة غير واضحة');
    expect(frontInput()!.disabled).toBe(false);
    expect(component.setupForm.get('docs.idNumber')!.value).toBe('A1234567');
    (component as any).goToStep(5);
    expect(component.currentStep()).toBe(4);
  });

  it('NOT_SUBMITTED: asks for the document, uploads are open, step 5 stays closed', async () => {
    await setup({ kycStatus: 'UNVERIFIED', identityVerification: iv('NOT_SUBMITTED') });
    fixture.detectChanges();
    expect(q('[data-testid="identity-gate-not-submitted"]')).not.toBeNull();
    expect(frontInput()!.disabled).toBe(false);
    (component as any).goToStep(5);
    expect(component.currentStep()).toBe(4);
  });

  it('an older backend answer without identityVerification still works from kycStatus', async () => {
    await setup({ frontIdUrlAccess: FRONT, kycStatus: 'PENDING' }, 'UNDER_REVIEW');
    expect(component.kycPending()).toBe(true);
  });
});
