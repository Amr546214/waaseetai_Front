import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
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

  it('approve action calls the real POST /admin/accreditation/samples/:id/approve endpoint', async () => {
    await setup(
      (url: string) => (String(url).includes('/samples/sample-1') ? of({ success: true, data: makeSample() }) : of(makeListResponse())),
      () => of({ success: true, message: 'تم اعتماد نموذج الاعتماد بنجاح', data: makeSample({ status: 'AI_VERIFIED' }) }),
    );
    component.openDetail(component.samples()[0]);
    fixture.detectChanges();
    component.submitApprove();
    expect(postSpy.mock.calls[0][0]).toContain('/admin/accreditation/samples/sample-1/approve');
    expect(component.actionSuccess()).toBe('تم اعتماد نموذج الاعتماد بنجاح');
  });

  it('approve action failure shows an honest error, not a fake success', async () => {
    await setup(
      () => of(makeListResponse()),
      () => throwError(() => ({ error: { message: 'تم اعتماد هذا النموذج مسبقاً' } })),
    );
    component.selected.set(makeSample());
    component.submitApprove();
    expect(component.actionError()).toBe('تم اعتماد هذا النموذج مسبقاً');
    expect(component.actionSuccess()).toBe('');
  });

  it('reject action requires a reason and calls the real POST .../reject endpoint with it', async () => {
    await setup(
      () => of(makeListResponse()),
      () => of({ success: true, message: 'تم رفض نموذج الاعتماد', data: makeSample({ status: 'REJECTED' }) }),
    );
    component.selected.set(makeSample());
    component.openRejectForm();
    component.rejectionReason.set('المستندات غير كافية');
    component.submitReject();
    expect(postSpy.mock.calls[0][0]).toContain('/admin/accreditation/samples/sample-1/reject');
    expect(postSpy.mock.calls[0][1]).toEqual({ rejectionReason: 'المستندات غير كافية' });
    expect(component.actionSuccess()).toBe('تم رفض نموذج الاعتماد');
  });

  it('reject action failure shows an honest error, not a fake success', async () => {
    await setup(
      () => of(makeListResponse()),
      () => throwError(() => ({ error: { message: 'تم رفض هذا النموذج مسبقاً' } })),
    );
    component.selected.set(makeSample());
    component.openRejectForm();
    component.rejectionReason.set('سبب الرفض');
    component.submitReject();
    expect(component.actionError()).toBe('تم رفض هذا النموذج مسبقاً');
    expect(component.actionSuccess()).toBe('');
  });

  it('does not submit a reject request with an empty/too-short reason (matches backend 2-char minimum)', async () => {
    await setup(() => of(makeListResponse()));
    postSpy.mockClear();
    component.selected.set(makeSample());
    component.openRejectForm();
    component.rejectionReason.set('a');
    component.submitReject();
    expect(postSpy).not.toHaveBeenCalled();
    expect(component.actionError()).toContain('سبب الرفض');
  });
});
