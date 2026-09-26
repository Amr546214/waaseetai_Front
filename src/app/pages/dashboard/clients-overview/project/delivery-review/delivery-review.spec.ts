import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';

import { DeliveryReview } from './delivery-review';

// Shape matches ProjectProgressService.getProjectProgress()'s real "workspace"
// response (waseetai-backend/src/services/project-progress.service.ts). Note
// `clientName`/`clientInitial` hold the *other party's* name from the caller's
// perspective — for a client caller that's the provider's name — this is the
// real (if confusingly named) backend field, not a bug in the frontend.
function makeWorkspace(stageOverrides: Record<string, any> = {}) {
  return {
    success: true,
    data: {
      id: 'contract-1',
      projectId: 'proj-1',
      title: 'مشروع تجريبي',
      clientName: 'نورة التصميم',
      contractRef: 'CT-ABC123',
      conversationId: 'conv-1',
      stages: [
        {
          id: 'stage-1',
          stageNumber: 2,
          title: 'الهوية الكاملة',
          amount: 1500,
          status: 'submitted',
          threads: [
            {
              id: 'delivery-1',
              date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              files: [{ name: 'الشعار-النهائي.ai', url: 'https://cdn.example.com/f/logo.ai', size: 204800 }]
            }
          ],
          ...stageOverrides
        }
      ]
    }
  };
}

describe('DeliveryReview', () => {
  let component: DeliveryReview;
  let fixture: ComponentFixture<DeliveryReview>;
  let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let router: Router;
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  async function setup(getImpl: () => any, postImpl: () => any = () => of({ success: true, data: { decision: 'approve', stageId: 'stage-1', pointsAwarded: 0 } })) {
    getSpy = vi.fn(getImpl);
    postSpy = vi.fn(postImpl);
    await TestBed.configureTestingModule({
      imports: [DeliveryReview],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), post: (...args: any[]) => postSpy(...args) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1', stageId: 'stage-1' }) } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DeliveryReview);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should create and load the workspace purely from route params (works on a direct/refreshed URL)', async () => {
    await setup(() => of(makeWorkspace()));
    expect(getSpy.mock.calls[0][0]).toContain('/client/my-requests/proj-1/workspace');
    expect(component.stage()?.id).toBe('stage-1');
  });

  it('renders the real stage title and stage number', async () => {
    await setup(() => of(makeWorkspace()));
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('تسليم المرحلة 2: الهوية الكاملة');
  });

  it('renders the real provider name from the workspace data', async () => {
    await setup(() => of(makeWorkspace()));
    expect(fixture.nativeElement.textContent).toContain('نورة التصميم');
  });

  it('renders the real contract reference', async () => {
    await setup(() => of(makeWorkspace()));
    expect(fixture.nativeElement.textContent).toContain('CT-ABC123');
  });

  it('renders the real stage amount', async () => {
    await setup(() => of(makeWorkspace()));
    expect(fixture.nativeElement.textContent).toContain('1,500');
  });

  it('renders the real submitted time from the latest delivery', async () => {
    await setup(() => of(makeWorkspace()));
    expect(fixture.nativeElement.textContent).toContain('قبل يوم');
  });

  it('renders the real file count and a real file link', async () => {
    await setup(() => of(makeWorkspace()));
    expect(fixture.nativeElement.textContent).toContain('1 ملفات');
    const fileLink: HTMLAnchorElement = fixture.nativeElement.querySelector('.dr-file');
    expect(fileLink.getAttribute('href')).toBe('https://cdn.example.com/f/logo.ai');
    expect(fileLink.textContent).toContain('الشعار-النهائي.ai');
  });

  it('shows an honest empty state when the delivery has no files', async () => {
    await setup(() => of(makeWorkspace({ threads: [{ id: 'd1', date: new Date().toISOString(), files: [] }] })));
    expect(fixture.nativeElement.textContent).toContain('لا توجد ملفات مرفقة');
    expect(fixture.nativeElement.querySelector('.dr-file')).toBeNull();
  });

  describe('AI advisory review (Batch 5, real & on-demand)', () => {
    const validReview = {
      summary: 'التسليم يغطي الهوية البصرية المطلوبة بشكل عام.',
      alignedPoints: ['الشعار النهائي مذكور صراحة في نص التسليم.'],
      potentialGaps: ['لم يُذكر دليل الاستخدام (brand guideline) صراحة.'],
      questionsForReviewer: ['هل تم تسليم كل الصيغ المطلوبة للشعار؟'],
      reviewedInputs: { deliveryText: true, stageRequirements: true, attachmentContent: false }
    };

    it('idle state shows the real advisory disclaimer and a request button, no fabricated data', async () => {
      await setup(() => of(makeWorkspace()));
      const text = fixture.nativeElement.textContent as string;
      expect(text).not.toMatch(/\d+\s*[%٪]/);
      expect(text).not.toContain('اجتاز فحص الذكاء');
      expect(fixture.nativeElement.querySelector('[data-testid="request-ai-review"]')).toBeTruthy();
      expect(postSpy).not.toHaveBeenCalled();
    });

    it('requesting a review calls the real ai-review endpoint with the real delivery id and shows a loading state', async () => {
      const subject = new Subject<any>();
      await setup(() => of(makeWorkspace()), () => subject.asObservable());
      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="request-ai-review"]');
      btn.click();
      fixture.detectChanges();
      expect(component.aiReviewState()).toBe('loading');
      expect(fixture.nativeElement.textContent).toContain('جارٍ إنشاء المراجعة الاستشارية');
      expect(postSpy.mock.calls.at(-1)?.[0]).toContain('/client/my-requests/proj-1/stages/stage-1/ai-review');
      subject.next({ success: true, data: validReview });
      subject.complete();
    });

    it('a second click while loading does not fire a duplicate request', async () => {
      const subject = new Subject<any>();
      await setup(() => of(makeWorkspace()), () => subject.asObservable());
      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="request-ai-review"]');
      btn.click();
      fixture.detectChanges();
      component.requestAiReview();
      expect(postSpy).toHaveBeenCalledTimes(1);
      subject.next({ success: true, data: validReview });
      subject.complete();
    });

    it('renders the real summary, aligned points, gaps, questions and reviewed-input disclosure on success', async () => {
      await setup(() => of(makeWorkspace()), () => of({ success: true, data: validReview }));
      fixture.nativeElement.querySelector('[data-testid="request-ai-review"]').click();
      await fixture.whenStable();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(validReview.summary);
      expect(text).toContain(validReview.alignedPoints[0]);
      expect(text).toContain(validReview.potentialGaps[0]);
      expect(text).toContain(validReview.questionsForReviewer[0]);
      expect(text).toContain('هذه مراجعة استشارية، والقرار النهائي للمستخدم');
      expect(text).not.toMatch(/\d+\s*[%٪]/);
      expect(text).not.toContain('اجتاز فحص الذكاء');
    });

    it('honestly discloses which inputs were actually reviewed, including attachmentContent staying false', async () => {
      await setup(() => of(makeWorkspace()), () => of({ success: true, data: validReview }));
      fixture.nativeElement.querySelector('[data-testid="request-ai-review"]').click();
      await fixture.whenStable();
      fixture.detectChanges();
      const inputsText = fixture.nativeElement.querySelector('.dr-ai-inputs').textContent as string;
      expect(inputsText).toContain('نص التسليم');
      expect(inputsText).toContain('متطلبات المرحلة');
      expect(inputsText).toContain('محتوى المرفقات');
    });

    it('a Gemini/backend failure shows an honest error, never a fabricated review result', async () => {
      await setup(() => of(makeWorkspace()), () => throwError(() => ({ error: { message: 'تعذر إنشاء المراجعة الاستشارية بالذكاء الاصطناعي حالياً.' } })));
      fixture.nativeElement.querySelector('[data-testid="request-ai-review"]').click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(component.aiReview()).toBeNull();
      expect(component.aiReviewState()).toBe('error');
      expect(fixture.nativeElement.textContent).toContain('تعذر إنشاء المراجعة الاستشارية بالذكاء الاصطناعي حالياً.');
      expect(fixture.nativeElement.querySelector('[data-testid="request-ai-review"]')).toBeTruthy();
    });

    it('the AI review never touches the manual accept/reject controls or the review endpoint', async () => {
      await setup(() => of(makeWorkspace()), () => of({ success: true, data: validReview }));
      fixture.nativeElement.querySelector('[data-testid="request-ai-review"]').click();
      await fixture.whenStable();
      fixture.detectChanges();
      // approveDelivery remains a fully separate action the AI review never calls or disables.
      const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.dr-btn-pri');
      expect(approveBtn.disabled).toBe(false);
      expect(postSpy.mock.calls.some(call => String(call[0]).endsWith('/review'))).toBe(false);
      expect(component.reviewNote).toBe('');
    });
  });

  it('renders "غير محدد" for the review deadline since no backend field exists', async () => {
    await setup(() => of(makeWorkspace()));
    expect(fixture.nativeElement.textContent).toContain('مهلة المراجعة');
    expect(fixture.nativeElement.textContent).toContain('غير محدد');
  });

  it('approve calls the real endpoint exactly once per click', async () => {
    await setup(() => of(makeWorkspace()));
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.dr-btn-pri');
    btn.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0][0]).toContain('/client/my-requests/proj-1/stages/stage-1/review');
    expect(postSpy.mock.calls[0][1]).toEqual(expect.objectContaining({ decision: 'approve' }));
  });

  it('disables the approve button while saving so a second click cannot fire another request', async () => {
    const subject = new Subject<any>();
    await setup(() => of(makeWorkspace()), () => subject.asObservable());
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.dr-btn-pri');
    btn.click();
    fixture.detectChanges();
    expect(component.saving()).toBe(true);
    expect(btn.disabled).toBe(true);

    // Guard also holds at the component level even if a disabled button were bypassed.
    component.approveDelivery();
    expect(postSpy).toHaveBeenCalledTimes(1);

    subject.next({ success: true, data: {} });
    subject.complete();
    await fixture.whenStable();
  });

  it('a failed approve shows an error and does not show a fake success state', async () => {
    await setup(() => of(makeWorkspace()), () => throwError(() => ({ error: { message: 'تعذر حفظ قرار المراجعة' } })));
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.dr-btn-pri');
    btn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.successData()).toBeNull();
    expect(component.saving()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('تعذر حفظ قرار المراجعة');
    expect(fixture.nativeElement.querySelector('.ac-ov')).toBeNull();
  });

  it('a successful approve shows the real success state with real known values, no fabricated transaction id', async () => {
    await setup(() => of(makeWorkspace()));
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.dr-btn-pri');
    btn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const sd = component.successData();
    expect(sd).toEqual({ amount: 1500, providerName: 'نورة التصميم', stageTitle: 'الهوية الكاملة', txnId: '', invoiceId: '' });
    const modalText = fixture.nativeElement.querySelector('.ac-ov').textContent as string;
    expect(modalText).toContain('1,500');
    expect(modalText).toContain('نورة التصميم');
    expect(modalText).not.toContain('رقم العملية'); // hidden when txnId is empty — never fabricated
  });

  it('a successful approve refreshes the real stage status in the background', async () => {
    let call = 0;
    await setup(() => {
      call++;
      return of(call === 1 ? makeWorkspace() : makeWorkspace({ status: 'completed' }));
    });
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.dr-btn-pri');
    btn.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(component.stage()?.status).toBe('completed');
  });

  it('hides the approve action and shows the real status once a stage is already approved (e.g. after refresh)', async () => {
    await setup(() => of(makeWorkspace({ status: 'completed' })));
    expect(fixture.nativeElement.querySelector('.dr-btn-pri')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('تم اعتماد هذا التسليم');
  });

  it('"فتح نقاش" navigates to Messages with the real conversationId and a DELIVERY context — never a fabricated decision:"revision"', async () => {
    await setup(() => of(makeWorkspace()));
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.dr-btn-secondary');
    btn.click();
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/client-overview/messages'],
      expect.objectContaining({
        queryParams: { conversationId: 'conv-1' },
        state: expect.objectContaining({ messageContext: expect.objectContaining({ type: 'DELIVERY', projectId: 'proj-1', stageId: 'stage-1' }) })
      })
    );
    // Approving is the only action allowed to change stage/escrow state; opening a
    // discussion must never itself call the review endpoint.
    expect(postSpy).not.toHaveBeenCalled();
  });
});
