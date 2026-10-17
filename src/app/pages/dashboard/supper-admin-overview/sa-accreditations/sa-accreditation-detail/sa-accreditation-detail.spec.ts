import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

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
    expect(component.actionSuccess()).toBe('تم رفض نموذج الاعتماد وإشعار مقدم الخدمة بالسبب');
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
    harness.detectChanges();
    component.rejectionReason.set('a');
    component.submitReject();
    await settleForm();
    expect(postSpy).not.toHaveBeenCalled();
    // explained under the reason box (not in a generic banner), and the box has focus
    const ta = (harness.routeNativeElement as HTMLElement).querySelector('#acc-reject-reason');
    expectFieldProblem(ta, 'سبب الرفض');
    expectFocused(ta);
  });

  it('reject: a 400 naming rejectionReason goes under the box; 429 / 500 / 403 / network are a generic alert; the reason is kept', async () => {
    await setup();
    component.openRejectForm(); harness.detectChanges();
    component.rejectionReason.set('سبب مكتوب'); harness.detectChanges();
    postSpy.mockReturnValueOnce(throwError(() => httpFail(400, { errors: [{ field: 'rejectionReason', message: 'السبب غير مقبول' }] })));
    component.submitReject(); await settleForm(); harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expectFieldProblem(el.querySelector('#acc-reject-reason'), 'غير مقبول');
    for (const st of [429, 500, 403, 0]) {
      postSpy.mockReturnValueOnce(throwError(() => httpFail(st, { message: 'x' })));
      component.submitReject(); await settleForm(); harness.detectChanges();
      expect(component.actionError(), String(st)).toBeTruthy();
      expectNoFieldProblem(el);
      expect(el.querySelector('[data-testid="acc-action-error"]')?.getAttribute('role')).toBe('alert');
    }
    expect(component.rejectionReason()).toBe('سبب مكتوب');
  });
});

// #20 — the advisory "للمراجعة" marks of the latest assessment attempt (never a change of score or status).
describe('SaAccreditationDetail — assessment review marks (#20)', () => {
  const review = (over: any = {}) => ({
    attemptId: 'a1', status: 'FAILED', score: 35, completedAt: '2026-01-02T10:00:00.000Z',
    review: {
      flagged: true,
      flags: [{ code: 'TOTAL_TIME_TOO_SHORT' }, { code: 'FAST_ANSWERS' }, { code: 'UNIFORM_ANSWERS' }, { code: 'REPEATING_PATTERN' }],
      measured: { totalSeconds: 57, answered: 20, fastAnswers: 5, topShare: 0.9, periodicCycle: 4 },
      thresholds: { minSecondsPerQuestion: 3, minTotalSeconds: 80, patternRatio: 0.9, fastAnswerMinCount: 3 },
      ...over,
    },
  });

  async function render(sample: Partial<AccreditationSample>) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'accreditations/:id', component: SaAccreditationDetail }]),
        { provide: HttpClient, useValue: { get: () => of({ success: true, data: makeSample(sample) }), post: () => of({}) } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/accreditations/sample-1', SaAccreditationDetail);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }
  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  afterEach(() => TestBed.resetTestingModule());

  it('a flagged attempt shows the «للمراجعة» mark, each flag in plain Arabic with its threshold, the measurements and the "advisory only" note', async () => {
    const el = await render({ assessmentReview: review() as any });
    expect(q(el, 'review-pill')!.textContent).toContain('للمراجعة');
    const flags = Array.from(el.querySelectorAll('[data-testid="review-flag"]')).map(f => f.textContent!.trim());
    expect(flags.length).toBe(4);
    expect(flags[0]).toContain('80 ثانية');
    expect(flags[1]).toContain('3 ثوانٍ');
    expect(flags[2]).toContain('90%');
    expect(flags[3]).toContain('نمطًا دوريًا');
    for (const f of flags) expect(f).toMatch(/[؀-ۿ]/);
    expect(q(el, 'review-measured')!.textContent).toContain('57 ثانية');
    expect(q(el, 'review-note')!.textContent).toContain('لم تغيّر الدرجة ولا حالة الاعتماد');
  });

  it('showing the marks changes nothing about the sample: the status label and AI score on the page are the same as without them', async () => {
    const withMarks = await render({ assessmentReview: review() as any });
    const status = withMarks.querySelector('.acc-ai-pill')!.textContent!.trim();
    const score = withMarks.querySelector('.acc-score-num')!.textContent!.trim();
    TestBed.resetTestingModule();
    const without = await render({ assessmentReview: null });
    expect(without.querySelector('.acc-ai-pill')!.textContent!.trim()).toBe(status);
    expect(without.querySelector('.acc-score-num')!.textContent!.trim()).toBe(score);
  });

  it('an attempt without flags says "no review marks"; an old attempt (no review data) says so; no attempt shows no panel', async () => {
    let el = await render({ assessmentReview: review({ flagged: false, flags: [] }) as any });
    expect(q(el, 'review-pill-ok')!.textContent).toContain('بلا علامات مراجعة');
    expect(q(el, 'review-pill')).toBeNull();
    TestBed.resetTestingModule();
    el = await render({ assessmentReview: { ...review(), review: null } as any });
    expect(q(el, 'review-none')!.textContent).toContain('قبل تسجيل التوقيت');
    TestBed.resetTestingModule();
    el = await render({ assessmentReview: null });
    expect(q(el, 'assessment-review')).toBeNull();
  });

  it('a single mark shows only that mark', async () => {
    const el = await render({ assessmentReview: review({ flags: [{ code: 'UNIFORM_ANSWERS' }] }) as any });
    expect(el.querySelectorAll('[data-testid="review-flag"]').length).toBe(1);
    expect(q(el, 'review-flag')!.getAttribute('data-code')).toBe('UNIFORM_ANSWERS');
  });
});

// D1: approval needs a confirmation step; nothing invented is shown; labels follow the backend truth.
describe('SaAccreditationDetail — honesty and confirmation', () => {
	async function render(sample: Partial<AccreditationSample> = {}, post: any = vi.fn(() => of({ success: true, data: makeSample() }))) {
		TestBed.configureTestingModule({
			providers: [
				provideRouter([{ path: 'accreditations/:id', component: SaAccreditationDetail }]),
				{ provide: HttpClient, useValue: { get: () => of({ success: true, data: makeSample(sample) }), post } },
			],
		});
		const harness = await RouterTestingHarness.create();
		const component = await harness.navigateByUrl('/accreditations/sample-1', SaAccreditationDetail);
		harness.detectChanges();
		return { harness, component, el: harness.routeNativeElement as HTMLElement, post };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('the approve button only opens a confirmation; the POST happens on confirm', async () => {
		const { harness, component, el, post } = await render();
		(el.querySelector('[data-testid="approve-btn"]') as HTMLButtonElement).click();
		harness.detectChanges();
		expect(post).not.toHaveBeenCalled();
		expect(el.querySelector('[data-testid="approve-confirm"]')).not.toBeNull();
		(el.querySelector('[data-testid="approve-confirm-btn"]') as HTMLButtonElement).click();
		expect(post.mock.calls[0][0]).toContain('/samples/sample-1/approve');
		expect(component.showApproveConfirm()).toBe(false);
	});

	it('shows no invented nationality / city / SLA / risk / SAMA / document-verification content', async () => {
		const { el } = await render();
		const t = el.textContent || '';
		for (const bad of ['الجنسية', 'المدينة', 'SLA', 'ساما', 'فحص المخاطر', 'AI Score: 82', 'DOC-']) expect(t).not.toContain(bad);
	});

	it('links to the provider profile and labels the stored AI result as such', async () => {
		const { el } = await render();
		expect(el.querySelector('[data-testid="provider-link"]')!.getAttribute('href')).toContain('/supper-admin-overview/users/u-1');
		expect(el.querySelector('[data-testid="stored-ai"]')!.textContent).toContain('تقييم AI المخزّن');
	});

	it('without a stored AI result it says the AI check is off instead of showing a score', async () => {
		const { el } = await render({ aiScore: null, aiFeedbackAr: null, aiStrengths: [], aiRecommendations: [] });
		expect(el.querySelector('[data-testid="stored-ai"]')).toBeNull();
		expect(el.querySelector('[data-testid="no-ai"]')!.textContent).toContain('متوقف');
	});

	it('status labels: MANUAL_REVIEW is waiting for manual review; AI_VERIFIED is "approved" only when the specialty really is approved', async () => {
		let { el } = await render({ status: 'MANUAL_REVIEW' });
		expect(el.querySelector('.acc-ai-pill')!.textContent).toContain('بانتظار المراجعة اليدوية');
		TestBed.resetTestingModule();
		({ el } = await render({ status: 'AI_VERIFIED', providerSpecialty: { id: 'ps-1', status: 'PENDING_AUDIT' } as any }));
		expect(el.querySelector('.acc-ai-pill')!.textContent).toContain('بانتظار قرار الإدارة');
		TestBed.resetTestingModule();
		({ el } = await render({ status: 'AI_VERIFIED', providerSpecialty: { id: 'ps-1', status: 'APPROVED' } as any }));
		expect(el.querySelector('.acc-ai-pill')!.textContent!.trim()).toBe('معتمد');
	});

	it('the reject confirm button is never silently disabled: a missing reason is explained under the box instead', async () => {
		const { harness, component, el, post } = await render();
		component.openRejectForm(); harness.detectChanges();
		const btn = () => Array.from(el.querySelectorAll('.acc-rf-actions button')).find(b => b.textContent!.includes('تأكيد الرفض')) as HTMLButtonElement;
		expect(btn().disabled).toBe(false);
		btn().click(); await settleForm(); harness.detectChanges();
		expectFieldProblem(el.querySelector('#acc-reject-reason'), 'سبب الرفض');
		expect(post).not.toHaveBeenCalled();
	});
});
