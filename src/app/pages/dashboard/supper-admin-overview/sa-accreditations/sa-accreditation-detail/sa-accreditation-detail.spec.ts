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

// J1 (D-B1..D-B4): proofs of both shapes, labels that never go blank, the page following the server state after a decision, the admin reason in its own section.
describe('SaAccreditationDetail — J1 admin review', () => {
	const upload = { key: 'u:up-1', source: 'UPLOAD', id: 'up-1', fileName: 'design.png', mimeType: 'image/png', bytes: 2048, createdAt: '2026-10-17T10:00:00.000Z', url: null, access: { document: 'accreditation_upload', id: 'up-1' }, available: true };
	const legacyUrl = { key: 'a:1', source: 'LEGACY_URL', id: null, fileName: 'old.png', mimeType: 'image/png', bytes: null, createdAt: null, url: 'https://res.cloudinary.com/x/old.png', access: null, available: null };
	const legacyPrivate = { key: 'a:2', source: 'LEGACY_PRIVATE', id: null, fileName: 'p.jpg', mimeType: 'image/jpeg', bytes: null, createdAt: null, url: null, access: { document: 'accreditation_sample_attachment', id: 'sample-1', index: 2 }, available: true };
	const inline = { key: 'a:3', source: 'LEGACY_INLINE', id: null, fileName: 'مرفق-4', mimeType: null, bytes: null, createdAt: null, url: null, access: null, available: null };
	const missing = { ...upload, key: 'u:up-2', id: 'up-2', fileName: 'gone.pdf', access: { document: 'accreditation_upload', id: 'up-2' }, available: false };

	/** A fake server: GET returns its current record; approve / reject change it and answer with the bare sample row (like the real backend). */
	async function boot(initial: Partial<AccreditationSample> = {}, opts: { failDecision?: boolean; failRefetch?: boolean } = {}) {
		const server: any = makeSample({ providerSpecialty: { id: 'ps-1', status: 'UNDER_AI_REVIEW', specialty: { id: 'sp-1', nameAr: 'برمجة' } } as any, ...initial });
		let gets = 0;
		const posts: { url: string; body: any }[] = [];
		const http = {
			get: vi.fn(() => { gets++; return gets > 1 && opts.failRefetch ? throwError(() => ({ status: 500 })) : of({ success: true, data: structuredClone(server) }); }),
			post: vi.fn((url: string, body: any) => {
				posts.push({ url, body });
				if (url.includes('/kyc-documents/access-link')) return of({ success: true, data: { url: 'https://signed.example/f', private: true, legacy: false } });
				if (opts.failDecision) return throwError(() => httpFail(500, { message: 'تعذر التنفيذ' }));
				if (url.endsWith('/approve')) { server.status = 'AI_VERIFIED'; server.providerSpecialty.status = 'APPROVED'; server.decidedAt = '2026-10-18T10:00:00.000Z'; }
				if (url.endsWith('/reject')) { server.status = 'REJECTED'; server.userNote = body.rejectionReason; server.decidedAt = '2026-10-18T10:00:00.000Z'; server.aiFeedbackAr = `${server.aiFeedbackAr || ''}\n[مراجعة الإدارة] سبب الرفض: ${body.rejectionReason}`; }
				const { providerSpecialty: _ps, ...bare } = server;
				return of({ success: true, data: bare });
			}),
		};
		TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'accreditations/:id', component: SaAccreditationDetail }]), { provide: HttpClient, useValue: http }] });
		const harness = await RouterTestingHarness.create();
		const component = await harness.navigateByUrl('/accreditations/sample-1', SaAccreditationDetail);
		harness.detectChanges();
		return { harness, component, el: harness.routeNativeElement as HTMLElement, http, posts, server };
	}
	const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	const qa = (el: HTMLElement, id: string) => Array.from(el.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];
	afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

	it('D-B1: renders proofs of every shape from the documented `proofs` list, with a real open control per openable proof', async () => {
		const { el } = await boot({ attachments: ['https://res.cloudinary.com/x/old.png'], proofs: [upload, legacyUrl, legacyPrivate, inline] as any });
		expect(qa(el, 'proof-row').length).toBe(4);
		expect(qa(el, 'proof-name').map(n => n.textContent!.trim())).toEqual(['design.png', 'old.png', 'p.jpg', 'مرفق-4']);
		expect(qa(el, 'proof-open').length).toBe(2);
		expect(q(el, 'proof-link')!.getAttribute('href')).toBe('https://res.cloudinary.com/x/old.png');
		expect(q(el, 'proof-noopen')!.textContent).toContain('لا يمكن فتحه');
		expect(q(el, 'proofs')!.textContent).toContain('(4)');
		expect(q(el, 'no-proofs')).toBeNull();
	});

	it('D-B1: the open control asks for a fresh short-lived link (upload and legacy-private keys) and opens it in a new tab', async () => {
		const { el, harness, posts } = await boot({ proofs: [upload, legacyPrivate] as any });
		const tab: any = { closed: false, document: { title: '' }, location: { href: '' }, close() {} };
		const open = vi.spyOn(window, 'open').mockReturnValue(tab);
		for (const host of qa(el, 'proof-open')) (host.querySelector('button') as HTMLButtonElement).click();
		harness.detectChanges();
		const calls = posts.filter(p => p.url.includes('/kyc-documents/access-link')).map(p => p.body);
		expect(calls).toEqual([{ document: 'accreditation_upload', id: 'up-1' }, { document: 'accreditation_sample_attachment', id: 'sample-1', index: 2 }]);
		expect(open).toHaveBeenCalledTimes(2);
		expect(tab.location.href).toBe('https://signed.example/f');
	});

	it('D-B1: a failed link request shows a clear failure next to the proof, not "no proof"', async () => {
		const { el, harness, http } = await boot({ proofs: [upload] as any });
		http.post.mockReturnValueOnce(throwError(() => ({ status: 404 })));
		vi.spyOn(window, 'open').mockReturnValue({ closed: false, document: {}, location: {}, close() {} } as any);
		(qa(el, 'proof-open')[0].querySelector('button') as HTMLButtonElement).click();
		harness.detectChanges();
		expect(qa(el, 'proof-open')[0].textContent).toContain('لا توجد وثيقة');
		expect(q(el, 'no-proofs')).toBeNull();
		expect(qa(el, 'proof-row').length).toBe(1);
	});

	it('D-B1: a file the storage no longer has shows «الملف غير متاح» (and no open button), still listed as a proof', async () => {
		const { el } = await boot({ proofs: [missing, upload] as any });
		const rows = qa(el, 'proof-row');
		expect(rows.length).toBe(2);
		expect(rows[0].querySelector('[data-testid="proof-unavailable"]')!.textContent).toContain('الملف غير متاح');
		expect(rows[0].querySelector('[data-testid="proof-open"]')).toBeNull();
		expect(rows[1].querySelector('[data-testid="proof-open"]')).not.toBeNull();
		expect(q(el, 'no-proofs')).toBeNull();
	});

	it('D-B1: an older server (no `proofs`, attachments:[null] + proofUploads) still renders and can open the upload', async () => {
		const { el } = await boot({ attachments: [null] as any, proofUploads: [{ id: 'up-1', fileName: 'design.png', mimeType: 'image/png', bytes: 2048 }] } as any);
		expect(qa(el, 'proof-name').map(n => n.textContent!.trim())).toEqual(['design.png']);
		expect(qa(el, 'proof-open').length).toBe(1);
	});

	it('D-B1: null-safety (secondary defence): null / empty / number / data-URI / bare-name attachments never throw and a null is never listed', async () => {
		const { el, component } = await boot({ attachments: [null, '', 7, 'data:image/png;base64,AAAA', 'bare.pdf', 'https://x.com/a%20b.png'] as any });
		expect(() => component.attachmentName(null, 0)).not.toThrow();
		expect(component.attachmentName(null, 0)).toBe('مرفق-1');
		expect(component.attachmentName('data:image/png;base64,AAAA', 1)).toBe('مرفق-2');
		expect(qa(el, 'proof-name').map(n => n.textContent!.trim())).toEqual(['مرفق-4', 'bare.pdf', 'a b.png']);
		expect(el.textContent).not.toContain('base64');
	});

	it('D-B1: a sample without any proof says so plainly', async () => {
		const { el } = await boot({ attachments: [], proofs: [] });
		expect(q(el, 'no-proofs')!.textContent).toContain('لا توجد ملفات إثبات');
	});

	it('D-B2: with a bad attachment present the decision buttons, templates and success banner still have text (cause was the aborted render)', async () => {
		const { harness, component, el } = await boot({ attachments: [null] as any });
		component.openRejectForm(); component.actionSuccess.set('رسالة'); harness.detectChanges();
		const labels = Array.from(el.querySelectorAll('button')).map(b => b.textContent!.trim());
		expect(labels.every(Boolean)).toBe(true);
		expect(labels).toContain('تأكيد الرفض');
		expect(el.querySelectorAll('.acc-rej-tmpl').length).toBe(5);
		expect(q(el, 'acc-action-success')!.textContent!.trim()).toBe('رسالة');
		component.cancelRejectForm(); component.openApproveConfirm(); harness.detectChanges();
		expect(q(el, 'approve-confirm-btn')!.textContent!.trim()).toBe('تأكيد الاعتماد');
	});

	it('D-B3: after approve the pill, banner and actions follow the server state, and no second decision is possible', async () => {
		const { harness, component, el, posts } = await boot();
		expect(el.querySelector('.acc-ai-pill')!.textContent).toContain('بانتظار المراجعة اليدوية');
		component.openApproveConfirm(); harness.detectChanges();
		(q(el, 'approve-confirm-btn') as HTMLButtonElement).click(); harness.detectChanges();
		expect(el.querySelector('.acc-ai-pill')!.textContent!.trim()).toBe('معتمد');
		expect(q(el, 'acc-action-success')!.textContent).toContain('تم اعتماد');
		expect(q(el, 'approve-btn')).toBeNull();
		expect(q(el, 'reject-btn')).toBeNull();
		expect(q(el, 'admin-decision')!.textContent).toContain('تم الاعتماد');
		component.submitApprove(); component.openRejectForm(); component.submitReject();
		expect(posts.filter(p => /\/(approve|reject)$/.test(p.url)).length).toBe(1);
	});

	it('D-B3: after reject the pill is «مرفوض», the banner is shown, the reject button is gone, and the form is closed', async () => {
		const { harness, component, el, posts } = await boot();
		component.openRejectForm(); harness.detectChanges();
		component.rejectionReason.set('الملفات غير واضحة'); harness.detectChanges();
		(q(el, 'reject-confirm-btn') as HTMLButtonElement).click(); harness.detectChanges();
		expect(el.querySelector('.acc-ai-pill')!.textContent!.trim()).toBe('مرفوض');
		expect(q(el, 'acc-action-success')!.textContent).toContain('تم رفض');
		expect(q(el, 'reject-btn')).toBeNull();
		expect(q(el, 'approve-btn')).toBeNull();
		expect(el.querySelector('.acc-resolve-form')).toBeNull();
		component.submitReject();
		expect(posts.filter(p => p.url.endsWith('/reject')).length).toBe(1);
	});

	it('D-B3: if the re-read after the decision fails, the applied state stays (no stale pill)', async () => {
		const { harness, component, el } = await boot({}, { failRefetch: true });
		component.submitApprove(); harness.detectChanges();
		expect(el.querySelector('.acc-ai-pill')!.textContent!.trim()).toBe('معتمد');
		expect(q(el, 'acc-action-success')).not.toBeNull();
	});

	it('D-B3: a failed decision shows the error, NO success state, keeps the actions and the pill', async () => {
		const { harness, component, el } = await boot({}, { failDecision: true });
		component.openRejectForm(); component.rejectionReason.set('سبب كافٍ'); harness.detectChanges();
		component.submitReject(); harness.detectChanges();
		expect(component.actionSuccess()).toBe('');
		expect(q(el, 'acc-action-success')).toBeNull();
		expect(component.decisionDone()).toBe(false);
		expect(q(el, 'acc-action-error')!.textContent!.trim().length).toBeGreaterThan(3);
		expect(el.querySelector('.acc-ai-pill')!.textContent).toContain('بانتظار المراجعة اليدوية');
		expect(q(el, 'reject-confirm-btn')).not.toBeNull();
	});

	it('D-B3: actions are disabled while a decision is in flight', async () => {
		const { harness, component, el } = await boot();
		component.openRejectForm(); component.rejectionReason.set('سبب كافٍ'); component.submittingAction.set(true); harness.detectChanges();
		expect((q(el, 'reject-confirm-btn') as HTMLButtonElement).disabled).toBe(true);
	});

	it('D-B4: the admin rejection reason has its own section and is not part of the AI evaluation card', async () => {
		const { el } = await boot({ status: 'REJECTED', decidedAt: '2026-10-18T10:00:00.000Z', userNote: 'الملفات غير واضحة', aiFeedbackAr: 'تحليل تقني\n[مراجعة الإدارة] سبب الرفض: الملفات غير واضحة' });
		const section = q(el, 'admin-decision')!;
		expect(section.textContent).toContain('قرار الإدارة / سبب الرفض');
		expect(q(el, 'admin-decision-reason')!.textContent!.trim()).toBe('الملفات غير واضحة');
		const ai = q(el, 'stored-ai')!;
		expect(ai.textContent).toContain('تحليل تقني');
		expect(ai.textContent).not.toContain('سبب الرفض');
		expect(ai.textContent).not.toContain('الملفات غير واضحة');
		expect(ai.contains(section)).toBe(false);
	});

	it('D-B4: an old rejection without userNote still gets the reason from the marked text, and an AI card that held only the reason disappears', async () => {
		const { el } = await boot({ status: 'REJECTED', userNote: null, aiScore: null, aiStrengths: [], aiRecommendations: [], aiFeedbackAr: '\n[مراجعة الإدارة] سبب الرفض: قصير' });
		expect(q(el, 'admin-decision-reason')!.textContent!.trim()).toBe('قصير');
		expect(q(el, 'stored-ai')).toBeNull();
	});

	it('D-B6: NEEDS_COMPLETION has a Arabic label (never the raw enum name)', async () => {
		const { el } = await boot({ status: 'NEEDS_COMPLETION' as any, userNote: 'أكمل الوصف' });
		expect(el.querySelector('.acc-ai-pill')!.textContent).toContain('بانتظار استكمال');
		expect(q(el, 'admin-decision')!.textContent).toContain('طلب استكمال');
	});
});
