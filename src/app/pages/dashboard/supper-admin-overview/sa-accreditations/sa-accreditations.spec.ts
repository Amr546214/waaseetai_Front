import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';

import { SaAccreditations } from './sa-accreditations';
import { AccreditationSample } from '../../../../core/models/accreditation.model';

// Implementation Batch 1 — real super-admin accreditations wiring.
// These tests prove the page now loads real GET /admin/accreditation/samples
// data (no hardcoded mock array), shows real AI fields only (aiScore,
// aiQualityRating, aiFeedbackAr, aiStrengths, aiRecommendations — never a
// fabricated confidence/percentage/note), and that the approve/reject
// actions call the real backend endpoints rather than mutating local state.

function makeSample(overrides: Partial<AccreditationSample> = {}): AccreditationSample {
  return {
    id: 'sample-1',
    providerProfileId: 'pp-1',
    providerSpecialtyId: 'ps-1',
    title: 'نظام إدارة المخزون',
    description: 'وصف تقني للنموذج',
    projectUrl: 'https://example.com/project',
    githubUrl: 'https://github.com/example/repo',
    technologiesUsed: ['Angular', 'NestJS'],
    attachments: ['https://cdn.example.com/proof1.png'],
    status: 'MANUAL_REVIEW',
    aiScore: 78.5,
    aiQualityRating: 'ACCEPTABLE',
    aiFeedbackAr: 'تحليل تقني حقيقي من الذكاء الاصطناعي',
    aiStrengths: ['بنية كود واضحة'],
    aiRecommendations: ['تحسين التوثيق'],
    aiAuditedAt: '2026-01-01T10:00:00.000Z',
    createdAt: '2026-01-01T09:00:00.000Z',
    providerProfile: {
      id: 'pp-1',
      userId: 'u-1',
      user: { id: 'u-1', firstName: 'محمد', lastName: 'العمري', email: 'm.omari@email.com' },
    },
    providerSpecialty: {
      id: 'ps-1',
      status: 'PENDING_AUDIT',
      isPassed: false,
      specialty: { id: 'sp-1', nameAr: 'برمجة تطبيقات' },
    },
    ...overrides,
  };
}

function makeListResponse(items: any[] = [makeSample()], total = items.length) {
  return {
    success: true,
    message: 'تم جلب قائمة نماذج الاعتماد بنجاح',
    data: {
      items,
      pagination: { page: 1, limit: 10, total, totalPages: Math.max(1, Math.ceil(total / 10)) },
    },
  };
}

describe('SaAccreditations', () => {
  let component: SaAccreditations;
  let fixture: ComponentFixture<SaAccreditations>;
  let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

  async function setup(getImpl: (...args: any[]) => any, postImpl: (...args: any[]) => any = () => of({ success: true, data: makeSample() })) {
    getSpy = vi.fn(getImpl);
    postSpy = vi.fn(postImpl);
    await TestBed.configureTestingModule({
      imports: [SaAccreditations],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), post: (...args: any[]) => postSpy(...args) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SaAccreditations);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loads real accreditation samples from GET /admin/accreditation/samples (no hardcoded mock array)', async () => {
    await setup(() => of(makeListResponse()));
    expect(getSpy.mock.calls.some((c) => String(c[0]).includes('/admin/accreditation/samples'))).toBe(true);
    expect(component.samples().length).toBe(1);
    expect(component.samples()[0].title).toBe('نظام إدارة المخزون');
  });

  it('shows a loading state while the real request is in flight, then clears it on response', async () => {
    const listSubject = new Subject<any>();
    getSpy = vi.fn(() => listSubject.asObservable());
    postSpy = vi.fn();
    await TestBed.configureTestingModule({
      imports: [SaAccreditations],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), post: (...args: any[]) => postSpy(...args) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SaAccreditations);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loading()).toBe(true);
    listSubject.next(makeListResponse());
    expect(component.loading()).toBe(false);
    expect(component.samples().length).toBe(1);
  });

  it('shows an empty state when the backend returns zero real records', async () => {
    await setup(() => of(makeListResponse([], 0)));
    expect(component.samples().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('لا توجد طلبات اعتماد');
  });

  it('shows an honest error state on API failure instead of fabricated data', async () => {
    await setup(() => throwError(() => ({ error: { message: 'تعذر الاتصال بالخادم' } })));
    expect(component.error()).toBe('تعذر الاتصال بالخادم');
    expect(component.samples().length).toBe(0);
  });

  it('displays only real AI fields returned by the backend (aiScore, aiQualityRating)', async () => {
    await setup(() => of(makeListResponse()));
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('78.5%');
  });

  it('never fabricates an AI score/confidence/percentage when the backend field is null', async () => {
    await setup(() => of(makeListResponse([makeSample({ aiScore: null, aiQualityRating: null, aiFeedbackAr: null })])));
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('غير متاح');
    // Confirms no hardcoded fallback like the old mock's 88/95 defaults leaks in.
    expect(text).not.toContain('88%');
    expect(text).not.toContain('95%');
  });

  it('never renders the old fictional KYC/identity-accreditation mock fields', async () => {
    await setup(() => of(makeListResponse()));
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('مخاطر الاحتيال');
    expect(text).not.toContain('تطابق الهوية');
    expect(text).not.toContain('اكتمال البيانات');
  });

  // Approve/reject action tests moved to sa-accreditation-detail/sa-accreditation-detail.spec.ts
  // (the review modal became the routed accreditations/:id page).

  // Phase 3 fix: F15 authority boundary — AI_VERIFIED on the sample now only
  // means "AI recommends approval, pending final confirmation". Eligibility
  // must be derived from the REAL linked ProviderSpecialty approval state,
  // never from the sample's own AI_VERIFIED label.
  it('canApprove: an AI_VERIFIED sample whose linked specialty is not yet approved can still be approved', async () => {
    await setup(() => of(makeListResponse()));
    const sample = makeSample({ status: 'AI_VERIFIED', providerSpecialty: { id: 'ps-1', status: 'TEST_REQUIRED', isPassed: false } });
    expect(component.canApprove(sample)).toBe(true);
  });

  it('canApprove: a sample whose linked specialty is already APPROVED cannot be approved again, even if the sample itself is not labeled AI_VERIFIED', async () => {
    await setup(() => of(makeListResponse()));
    const sample = makeSample({ status: 'MANUAL_REVIEW', providerSpecialty: { id: 'ps-1', status: 'APPROVED', isPassed: true } });
    expect(component.canApprove(sample)).toBe(false);
  });
});
