import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SaAccreditationDetail } from './sa-accreditation-detail';
import { AccreditationSample } from '../../../../../core/models/accreditation.model';

// Routed accreditations/:id review page (formerly the in-list review modal).
// Proves the page loads the real GET /admin/accreditation/samples/:id record
// and that approve/reject call the real backend endpoints.

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

describe('SaAccreditationDetail', () => {
  let component: SaAccreditationDetail;
  let harness: RouterTestingHarness;
  let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

  async function setup(
    getImpl: (...args: any[]) => any = () => of({ success: true, data: makeSample() }),
    postImpl: (...args: any[]) => any = () => of({ success: true, data: makeSample() }),
  ) {
    getSpy = vi.fn(getImpl);
    postSpy = vi.fn(postImpl);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'accreditations/:id', component: SaAccreditationDetail }]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), post: (...args: any[]) => postSpy(...args) } },
      ],
    });
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl('/accreditations/sample-1', SaAccreditationDetail);
    harness.detectChanges();
  }

  it('loads the real sample from GET /admin/accreditation/samples/:id', async () => {
    await setup();
    expect(getSpy.mock.calls[0][0]).toContain('/admin/accreditation/samples/sample-1');
    expect(component.selected()?.title).toBe('نظام إدارة المخزون');
    expect(harness.routeNativeElement?.textContent).toContain('78.5');
  });

  it('shows a not-found state on 404', async () => {
    await setup(() => throwError(() => ({ status: 404 })));
    expect(component.notFound()).toBe(true);
    expect(component.selected()).toBeNull();
  });

  it('shows an honest error state on other failures', async () => {
    await setup(() => throwError(() => ({ error: { message: 'تعذر الاتصال بالخادم' } })));
    expect(component.error()).toBe('تعذر الاتصال بالخادم');
  });

  it('approve action calls the real POST /admin/accreditation/samples/:id/approve endpoint', async () => {
    await setup(undefined, () => of({ success: true, message: 'تم اعتماد نموذج الاعتماد بنجاح', data: makeSample({ status: 'AI_VERIFIED' }) }));
    component.submitApprove();
    expect(postSpy.mock.calls[0][0]).toContain('/admin/accreditation/samples/sample-1/approve');
    expect(component.actionSuccess()).toBe('تم اعتماد نموذج الاعتماد بنجاح');
  });

  it('approve action failure shows an honest error, not a fake success', async () => {
    await setup(undefined, () => throwError(() => ({ error: { message: 'تم اعتماد هذا النموذج مسبقاً' } })));
    component.submitApprove();
    expect(component.actionError()).toBe('تم اعتماد هذا النموذج مسبقاً');
    expect(component.actionSuccess()).toBe('');
  });

  it('reject action requires a reason and calls the real POST .../reject endpoint with it', async () => {
    await setup(undefined, () => of({ success: true, message: 'تم رفض نموذج الاعتماد', data: makeSample({ status: 'REJECTED' }) }));
    component.openRejectForm();
    component.rejectionReason.set('المستندات غير كافية');
    component.submitReject();
    expect(postSpy.mock.calls[0][0]).toContain('/admin/accreditation/samples/sample-1/reject');
    expect(postSpy.mock.calls[0][1]).toEqual({ rejectionReason: 'المستندات غير كافية' });
    expect(component.actionSuccess()).toBe('تم رفض نموذج الاعتماد');
  });

  it('reject action failure shows an honest error, not a fake success', async () => {
    await setup(undefined, () => throwError(() => ({ error: { message: 'تم رفض هذا النموذج مسبقاً' } })));
    component.openRejectForm();
    component.rejectionReason.set('سبب الرفض');
    component.submitReject();
    expect(component.actionError()).toBe('تم رفض هذا النموذج مسبقاً');
    expect(component.actionSuccess()).toBe('');
  });

  it('does not submit a reject request with an empty/too-short reason (matches backend 2-char minimum)', async () => {
    await setup();
    postSpy.mockClear();
    component.openRejectForm();
    component.rejectionReason.set('a');
    component.submitReject();
    expect(postSpy).not.toHaveBeenCalled();
    expect(component.actionError()).toContain('سبب الرفض');
  });
});
